'use strict';

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { parse } = require('csv-parse');

const APP_DATA_PATH = path.join(process.env.HOME, 'Desktop/PatentIQ/application_data.csv');
const TRANSACTIONS_PATH = path.join(process.env.HOME, 'Desktop/PatentIQ/transactions.csv');
const LOOKUP_PATH = path.join(process.env.HOME, 'Desktop/PatentIQ/app_lookup.csv');
const BATCH_SIZE = 500;

const { NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Event codes
const NON_FINAL = new Set(['CTNF', 'MCTNF']);
const ALLOWANCE = new Set(['NAIL', 'N/=.', 'MN/=.', 'N084']);
const RESPONSE  = new Set(['WIDS', 'A...', 'AF/D', 'AFWC', 'A.NE', 'A.PE']);

function daysBetween(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round(Math.abs(b - a) / (1000 * 60 * 60 * 24));
}

// ─── Step 1: Load lookup ──────────────────────────────────────────────────────

async function loadLookup() {
  console.log('Step 1: Loading app_lookup.csv...');
  const map = new Map();
  await new Promise((res, rej) => {
    const parser = parse({ columns: true, skip_empty_lines: true, trim: true });
    parser.on('readable', () => {
      let r;
      while ((r = parser.read()) !== null) map.set(r.app_number, r.examiner_name);
    });
    parser.on('error', rej);
    parser.on('end', res);
    fs.createReadStream(LOOKUP_PATH).pipe(parser);
  });
  console.log(`  ${map.size.toLocaleString()} mappings loaded.\n`);
  return map;
}

// ─── Step 2: Load filing dates from application_data.csv ─────────────────────

async function loadFilingDates() {
  console.log('Step 2: Loading filing dates from application_data.csv...');
  const map = new Map(); // app_number → filing_date string
  let rows = 0;
  await new Promise((res, rej) => {
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
    });
    parser.on('readable', () => {
      let r;
      while ((r = parser.read()) !== null) {
        rows++;
        if (rows % 2000000 === 0) console.log(`  ${rows.toLocaleString()} rows read...`);
        const app = r['application_number']?.trim();
        // filing_date column — try common column names
        const date = r['filing_date']?.trim()
          || r['application_filing_date']?.trim()
          || r['filing_dt']?.trim();
        if (app && date) map.set(app, date);
      }
    });
    parser.on('error', rej);
    parser.on('end', res);
    fs.createReadStream(APP_DATA_PATH).pipe(parser);
  });
  console.log(`  ${map.size.toLocaleString()} filing dates loaded.\n`);
  return map;
}

// ─── Step 3: Stream transactions and compute timing per app ───────────────────

async function processTransactions(appToExaminer, appToFilingDate) {
  console.log('Step 3: Streaming transactions.csv for timing data...');
  console.log('  This will take 20-35 minutes.\n');

  // Per-app compact tracking:
  // { ex, filingDate, firstOADate, firstResponseDate, allowanceDate }
  const appState = new Map();

  let rows = 0;
  let matched = 0;

  await new Promise((res, rej) => {
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    parser.on('readable', () => {
      let r;
      while ((r = parser.read()) !== null) {
        rows++;
        if (rows % 10000000 === 0) {
          const pct = ((rows / 507000000) * 100).toFixed(1);
          console.log(`  ${rows.toLocaleString()} rows (${pct}%) — ${matched.toLocaleString()} matched`);
        }

        const app = r['application_number']?.trim();
        const code = r['event_code']?.trim().toUpperCase();
        const date = r['recorded_date']?.trim();

        if (!app || !code || !date) continue;

        const examiner = appToExaminer.get(app);
        if (!examiner) continue;

        matched++;

        let s = appState.get(app);
        if (!s) {
          s = {
            ex: examiner,
            filingDate: appToFilingDate.get(app) || null,
            firstOADate: null,
            firstResponseDate: null,
            allowanceDate: null,
          };
          appState.set(app, s);
        }

        // Track first OA date
        if (NON_FINAL.has(code) && !s.firstOADate) {
          s.firstOADate = date;
        }

        // Track first applicant response after first OA
        if (RESPONSE.has(code) && s.firstOADate && !s.firstResponseDate) {
          s.firstResponseDate = date;
        }

        // Track allowance date
        if (ALLOWANCE.has(code) && !s.allowanceDate) {
          s.allowanceDate = date;
        }
      }
    });

    parser.on('error', rej);
    parser.on('end', res);
    fs.createReadStream(TRANSACTIONS_PATH).pipe(parser);
  });

  console.log(`\n  Done. ${rows.toLocaleString()} rows, ${appState.size.toLocaleString()} apps tracked.\n`);
  return appState;
}

// ─── Step 4: Fold into examiner timing stats ──────────────────────────────────

function computeExaminerTiming(appState) {
  console.log('Step 4: Computing timing stats per examiner...');

  const examinerData = new Map();

  const get = (name) => {
    if (!examinerData.has(name)) {
      examinerData.set(name, {
        daysToFirstOA: [],
        daysResponseToNext: [],
        daysTotalProsecution: [],
      });
    }
    return examinerData.get(name);
  };

  for (const [, s] of appState) {
    const ex = get(s.ex);

    // Days from filing to first OA
    if (s.filingDate && s.firstOADate) {
      const d = daysBetween(s.filingDate, s.firstOADate);
      if (d != null && d >= 30 && d <= 3650) { // sanity: 1 month to 10 years
        ex.daysToFirstOA.push(d);
      }
    }

    // Days from first response to allowance (proxy for examiner processing speed)
    if (s.firstResponseDate && s.allowanceDate) {
      const d = daysBetween(s.firstResponseDate, s.allowanceDate);
      if (d != null && d >= 1 && d <= 1825) { // up to 5 years
        ex.daysResponseToNext.push(d);
      }
    }

    // Total prosecution: filing to allowance
    if (s.filingDate && s.allowanceDate) {
      const d = daysBetween(s.filingDate, s.allowanceDate);
      if (d != null && d >= 90 && d <= 5475) { // 3 months to 15 years
        ex.daysTotalProsecution.push(d);
      }
    }
  }

  console.log(`  ${examinerData.size.toLocaleString()} examiners computed.\n`);
  return examinerData;
}

// ─── Step 5: Upsert ──────────────────────────────────────────────────────────

async function upsertStats(examinerData) {
  console.log('Step 5: Upserting timing stats to Supabase...');

  const avg = (arr) => arr.length >= 5
    ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
    : null;

  const rows = [];
  for (const [name, data] of examinerData) {
    const avg_days_to_first_oa = avg(data.daysToFirstOA);
    const avg_days_response_to_next_action = avg(data.daysResponseToNext);
    const avg_total_prosecution_days = avg(data.daysTotalProsecution);

    if (avg_days_to_first_oa === null && avg_total_prosecution_days === null) continue;

    rows.push({
      name,
      avg_days_to_first_oa,
      avg_days_response_to_next_action,
      avg_total_prosecution_days,
    });
  }

  console.log(`  ${rows.length.toLocaleString()} rows to upsert...`);

  let ok = 0, fail = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('examiners').upsert(batch, { onConflict: 'name' });
    if (error) {
      fail += batch.length;
      if (fail <= 3) console.error(`  ERR: ${error.message}`);
    } else {
      ok += batch.length;
      if (ok % 5000 === 0 || ok === rows.length) {
        console.log(`  ${ok.toLocaleString()} / ${rows.length.toLocaleString()}`);
      }
    }
  }
  return { ok, fail };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=================================================');
  console.log(' PatentIQ — Prosecution Timing Enrichment       ');
  console.log('=================================================');
  console.log(`Started: ${new Date().toISOString()}\n`);

  // First peek at application_data.csv columns
  console.log('Checking application_data.csv columns...');
  const firstLine = await new Promise((res) => {
    const stream = fs.createReadStream(APP_DATA_PATH);
    let header = '';
    stream.on('data', chunk => { header += chunk.toString(); if (header.includes('\n')) { stream.destroy(); res(header.split('\n')[0]); } });
    stream.on('close', () => res(header.split('\n')[0]));
  });
  console.log(`  Columns: ${firstLine.slice(0, 300)}\n`);

  const t0 = Date.now();
  const appToExaminer = await loadLookup();
  const appToFilingDate = await loadFilingDates();
  const appState = await processTransactions(appToExaminer, appToFilingDate);
  const examinerData = computeExaminerTiming(appState);
  const { ok, fail } = await upsertStats(examinerData);

  console.log('\n=================================================');
  console.log(` Done in ${((Date.now() - t0) / 60000).toFixed(1)} minutes`);
  console.log(` Upserted: ${ok.toLocaleString()} | Failed: ${fail}`);
  console.log('=================================================\n');
}

main().catch(e => { console.error(e); process.exit(1); });