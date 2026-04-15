'use strict';

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { parse } = require('csv-parse');

const OA_PATH = path.join(process.env.HOME, 'Desktop/PatentIQ/oa_allrej_2007_2025.csv');
const LOOKUP_PATH = path.join(process.env.HOME, 'Desktop/PatentIQ/app_lookup.csv');
const BATCH_SIZE = 500;

const { NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ─── Step 1: Load app → examiner lookup ──────────────────────────────────────

async function loadLookup() {
  console.log('Step 1: Loading app_lookup.csv into memory...');
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
  console.log(`  ${map.size.toLocaleString()} app→examiner mappings loaded.\n`);
  return map;
}

// ─── Step 2: Stream OA CSV and aggregate rejection types per examiner ─────────

async function processOARejections(appToExaminer) {
  console.log('Step 2: Streaming oa_allrej_2007_2025.csv...');

  // Per-examiner accumulators
  const examinerStats = new Map();

  const get = (name) => {
    if (!examinerStats.has(name)) {
      examinerStats.set(name, { total: 0, r101: 0, r102: 0, r103: 0, r112: 0 });
    }
    return examinerStats.get(name);
  };

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
        if (rows % 1000000 === 0) {
          const pct = ((rows / 10400000) * 100).toFixed(1);
          console.log(`  ${rows.toLocaleString()} rows (${pct}%) — ${matched.toLocaleString()} matched`);
        }

        // app number is in patentApplicationNumber column
        // strip leading zeros and normalize
        const rawApp = r['patentApplicationNumber']?.trim();
        if (!rawApp) continue;

        // Try direct lookup first, then with leading zeros stripped
        let examiner = appToExaminer.get(rawApp);
        if (!examiner) {
          // Try without leading zeros
          const stripped = rawApp.replace(/^0+/, '');
          examiner = appToExaminer.get(stripped);
        }
        if (!examiner) continue;

        matched++;
        const stats = get(examiner);
        stats.total++;
        if (r['hasrej101'] === '1') stats.r101++;
        if (r['hasrej102'] === '1') stats.r102++;
        if (r['hasrej103'] === '1') stats.r103++;
        if (r['hasrej112'] === '1') stats.r112++;
      }
    });

    parser.on('error', rej);
    parser.on('end', res);
    fs.createReadStream(OA_PATH).pipe(parser);
  });

  console.log(`\n  Done. ${rows.toLocaleString()} rows, ${matched.toLocaleString()} matched, ${examinerStats.size.toLocaleString()} examiners.\n`);
  return examinerStats;
}

// ─── Step 3: Upsert to Supabase ───────────────────────────────────────────────

async function upsertStats(examinerStats) {
  console.log('Step 3: Computing percentages and upserting to Supabase...');

  const rows = [];

  for (const [name, stats] of examinerStats) {
    if (stats.total < 5) continue; // skip low sample size

    rows.push({
      name,
      pct_101: Math.round((stats.r101 / stats.total) * 10000) / 100,
      pct_102: Math.round((stats.r102 / stats.total) * 10000) / 100,
      pct_103: Math.round((stats.r103 / stats.total) * 10000) / 100,
      pct_112: Math.round((stats.r112 / stats.total) * 10000) / 100,
      total_oas_analyzed: stats.total,
    });
  }

  console.log(`  ${rows.length.toLocaleString()} examiners to upsert...`);

  let ok = 0, fail = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('examiners').upsert(batch, { onConflict: 'name' });
    if (error) {
      fail += batch.length;
      if (fail <= 3) console.error(`  ERR: ${error.message}`);
    } else {
      ok += batch.length;
      if (ok % 2000 === 0 || ok === rows.length) {
        console.log(`  ${ok.toLocaleString()} / ${rows.length.toLocaleString()}`);
      }
    }
  }

  return { ok, fail };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=================================================');
  console.log(' PatentIQ — Rejection Type Enrichment           ');
  console.log('=================================================');
  console.log(`Started: ${new Date().toISOString()}\n`);

  const t0 = Date.now();
  const appToExaminer = await loadLookup();
  const examinerStats = await processOARejections(appToExaminer);
  const { ok, fail } = await upsertStats(examinerStats);

  console.log('\n=================================================');
  console.log(` Done in ${((Date.now() - t0) / 60000).toFixed(1)} minutes`);
  console.log(` Upserted: ${ok.toLocaleString()} | Failed: ${fail}`);
  console.log('=================================================\n');
}

main().catch(e => { console.error(e); process.exit(1); });