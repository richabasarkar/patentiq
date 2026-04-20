'use strict';

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { parse } = require('csv-parse');
const readline = require('readline');

const APP_DATA_PATH = path.join(process.env.HOME, 'Desktop/PatentIQ/application_data.csv');
const TRANSACTIONS_PATH = path.join(process.env.HOME, 'Desktop/PatentIQ/transactions.csv');
const LOOKUP_PATH = path.join(process.env.HOME, 'Desktop/PatentIQ/app_lookup.csv');
const BATCH_SIZE = 500;

const { NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('Missing env vars'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const NON_FINAL = new Set(['CTNF', 'MCTNF']);
const FINAL_REJ = new Set(['CTFR', 'MCTFR']);
const ALLOWANCE = new Set(['NAIL', 'N/=.', 'N/.']);
const ABANDON   = new Set(['ABN', 'ABNF', 'MABN', 'MABND']);
const RCE       = new Set(['RCE', 'RCEX', 'MRCE']);

function formatName(raw) {
  if (!raw?.trim()) return null;
  const cleaned = raw.replace(/^"|"$/g, '').trim();
  const i = cleaned.indexOf(',');
  if (i === -1) return cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  const last = cleaned.slice(0, i).trim();
  const first = cleaned.slice(i + 1).trim();
  return `${first} ${last}`.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// ─── Step 1: Build lookup if needed ──────────────────────────────────────────

async function buildLookupIfNeeded() {
  if (fs.existsSync(LOOKUP_PATH)) {
    console.log('Step 1: app_lookup.csv exists — skipping.\n');
    return;
  }
  console.log('Step 1: Building app_lookup.csv...');
  const ws = fs.createWriteStream(LOOKUP_PATH);
  ws.write('app_number,examiner_name\n');
  let n = 0;
  await new Promise((res, rej) => {
    const parser = parse({ columns: true, skip_empty_lines: true, trim: true, relax_column_count: true, relax_quotes: true });
    parser.on('readable', () => {
      let r;
      while ((r = parser.read()) !== null) {
        const app = r['application_number']?.trim();
        const name = formatName(r['examiner_full_name']?.trim());
        if (!app || !name) continue;
        ws.write(`${app},${name.includes(',') ? `"${name}"` : name}\n`);
        n++;
        if (n % 1000000 === 0) console.log(`  ${n.toLocaleString()} written...`);
      }
    });
    parser.on('error', rej);
    parser.on('end', () => { ws.end(); res(); });
    fs.createReadStream(APP_DATA_PATH).pipe(parser);
  });
  console.log(`  Done. ${n.toLocaleString()} entries.\n`);
}

// ─── Step 2: Load lookup ─────────────────────────────────────────────────────

async function loadLookup() {
  console.log('Step 2: Loading lookup into memory...');
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

// ─── Step 3: Stream transactions — aggregate per app, then fold into examiner ─
// Key insight: instead of storing all events, we keep only a tiny summary per app:
// { examiner, nf, fr, al, ab, rce } — just 6 integers per app ~= 14M * ~60 bytes = ~840MB manageable

async function processTransactions(appToExaminer) {
  console.log('Step 3: Streaming transactions.csv...');
  console.log('  Tracking outcome per application (compact representation).\n');

  // appSummary: Map<appNum, { ex, nf, al, ab, rce }>
  // nf = non-final count, al = got allowance (0/1), ab = abandoned (0/1), rce = filed RCE (0/1)
  const appSummary = new Map();

  let rows = 0, matched = 0;

  await new Promise((res, rej) => {
    const parser = parse({ columns: true, skip_empty_lines: true, trim: true, relax_column_count: true });
    parser.on('readable', () => {
      let r;
      while ((r = parser.read()) !== null) {
        rows++;
        if (rows % 10000000 === 0) {
          const pct = ((rows / 507000000) * 100).toFixed(1);
          console.log(`  ${rows.toLocaleString()} rows (${pct}%) — ${matched.toLocaleString()} matched — ${appSummary.size.toLocaleString()} apps tracked`);
        }

        const app = r['application_number']?.trim();
        const code = r['event_code']?.trim().toUpperCase();
        if (!app || !code) continue;

        const ex = appToExaminer.get(app);
        if (!ex) continue;

        matched++;

        let s = appSummary.get(app);
        if (!s) {
          s = { ex, nf: 0, al: 0, ab: 0, rce: 0 };
          appSummary.set(app, s);
        }

        if (NON_FINAL.has(code)) s.nf++;
        else if (ALLOWANCE.has(code) && !s.al && !s.ab) s.al = 1;
        else if (ABANDON.has(code) && !s.al && !s.ab) s.ab = 1;
        else if (RCE.has(code)) s.rce = 1;
      }
    });
    parser.on('error', rej);
    parser.on('end', res);
    fs.createReadStream(TRANSACTIONS_PATH).pipe(parser);
  });

  console.log(`\n  Done. ${rows.toLocaleString()} rows processed, ${appSummary.size.toLocaleString()} apps tracked.\n`);
  return appSummary;
}

// ─── Step 4: Fold app outcomes into examiner stats ───────────────────────────

function foldIntoExaminerStats(appSummary) {
  console.log('Step 4: Aggregating app outcomes into examiner stats...');

  const ex = new Map();

  const get = (name) => {
    if (!ex.has(name)) ex.set(name, {
      total: 0, completed: 0, abandoned: 0, rce: 0,
      // apps that received >= N non-finals and were allowed
      nf1_total: 0, nf1_allowed: 0,   // got >=1 NF, how many allowed after exactly 1
      nf2_total: 0, nf2_allowed: 0,   // got >=2 NF, how many allowed by 2nd
      nf3_total: 0, nf3_allowed: 0,
      oa_to_al_sum: 0, oa_to_al_count: 0,
    });
    return ex.get(name);
  };

  for (const [, s] of appSummary) {
    const e = get(s.ex);
    e.total++;
    if (s.al || s.ab) e.completed++;
    if (s.ab) e.abandoned++;
    if (s.rce) e.rce++;

    if (s.al) {
      // OAs to allowance
      e.oa_to_al_sum += s.nf;
      e.oa_to_al_count++;

      // Allowance after N office actions
      if (s.nf >= 1) {
        e.nf1_total++;
        if (s.nf === 1) e.nf1_allowed++;  // allowed after exactly 1
      }
      if (s.nf >= 2) {
        e.nf2_total++;
        if (s.nf <= 2) e.nf2_allowed++;  // allowed after 1 or 2
      }
      if (s.nf >= 3) {
        e.nf3_total++;
        if (s.nf <= 3) e.nf3_allowed++;
      }
    }
  }

  console.log(`  ${ex.size.toLocaleString()} examiners aggregated.\n`);
  return ex;
}

// ─── Step 5: Upsert ──────────────────────────────────────────────────────────

async function upsertStats(examinerStats) {
  console.log('Step 5: Upserting to Supabase...');

  const rows = [];
  for (const [name, e] of examinerStats) {
    const allowance_after_1_oa = e.nf1_total >= 5
      ? Math.round((e.nf1_allowed / e.nf1_total) * 10000) / 100 : null;
    const allowance_after_2_oa = e.nf2_total >= 5
      ? Math.round((e.nf2_allowed / e.nf2_total) * 10000) / 100 : null;
    const abandonment_rate = e.completed >= 5
      ? Math.round((e.abandoned / e.completed) * 10000) / 100 : null;
    const rce_rate = e.total >= 5
      ? Math.round((e.rce / e.total) * 10000) / 100 : null;
    const avg_oas_to_allowance = e.oa_to_al_count >= 5
      ? Math.round((e.oa_to_al_sum / e.oa_to_al_count) * 100) / 100 : null;

    if (allowance_after_1_oa === null && abandonment_rate === null) continue;

    rows.push({ name, allowance_after_1_oa, allowance_after_2_oa, abandonment_rate, rce_rate, avg_oas_to_allowance });
  }

  console.log(`  ${rows.length.toLocaleString()} rows to upsert...`);
  let ok = 0, fail = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('examiners').upsert(batch, { onConflict: 'name' });
    if (error) { fail += batch.length; if (fail <= 3) console.error(`  ERR: ${error.message}`); }
    else {
      ok += batch.length;
      if (ok % 5000 === 0 || ok === rows.length) console.log(`  ${ok.toLocaleString()} / ${rows.length.toLocaleString()}`);
    }
  }
  return { ok, fail };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=================================================');
  console.log(' PatentIQ — Prosecution Outcome Enrichment v2   ');
  console.log('=================================================');
  console.log(`Started: ${new Date().toISOString()}\n`);

  const t0 = Date.now();
  await buildLookupIfNeeded();
  const appToExaminer = await loadLookup();
  const appSummary = await processTransactions(appToExaminer);
  const examinerStats = foldIntoExaminerStats(appSummary);
  const { ok, fail } = await upsertStats(examinerStats);

  console.log('\n=================================================');
  console.log(` Done in ${((Date.now() - t0) / 60000).toFixed(1)} minutes`);
  console.log(` Upserted: ${ok.toLocaleString()} | Failed: ${fail}`);
  console.log('=================================================\n');
}

main().catch(e => { console.error(e); process.exit(1); });