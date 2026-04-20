'use strict';

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');
const { parse } = require('csv-parse');
const { stringify } = require('csv-stringify/sync');

// ─── Config ───────────────────────────────────────────────────────────────────

const APP_DATA_PATH = path.join(process.env.HOME, 'Desktop/PatentIQ/application_data.csv');
const TRANSACTIONS_PATH = path.join(process.env.HOME, 'Desktop/PatentIQ/transactions.csv');
const LOOKUP_PATH = path.join(process.env.HOME, 'Desktop/PatentIQ/app_lookup.csv');
const BATCH_SIZE = 500;

const {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase env vars. Check .env.local.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatName(raw) {
  if (!raw || raw.trim() === '') return null;
  const cleaned = raw.replace(/^"|"$/g, '').trim();
  const commaIdx = cleaned.indexOf(',');
  if (commaIdx === -1) return toTitleCase(cleaned);
  const last = cleaned.slice(0, commaIdx).trim();
  const first = cleaned.slice(commaIdx + 1).trim();
  return toTitleCase(`${first} ${last}`);
}

function toTitleCase(str) {
  return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ─── Step 1: Build small lookup file on disk ──────────────────────────────────

async function buildLookupFile() {
  console.log('Step 1: Building app_lookup.csv from application_data.csv...');
  console.log('  (This writes app_number,examiner_name,filing_year,is_granted to disk)\n');

  const GRANTED_STATUSES = new Set([
    'patented case',
    'patent granted',
    'patented file - (old case added for file tracking purposes)',
  ]);

  const writeStream = fs.createWriteStream(LOOKUP_PATH);
  writeStream.write('app_number,examiner_name,filing_year,is_granted\n');

  let rowCount = 0;
  let written = 0;

  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(APP_DATA_PATH);
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
    });

    parser.on('readable', () => {
      let record;
      while ((record = parser.read()) !== null) {
        rowCount++;

        const appNum = record['application_number']?.trim();
        const rawName = record['examiner_full_name']?.trim();
        const filingDate = record['filing_date']?.trim();
        const patentNumber = record['patent_number']?.trim();
        const statusDesc = record['appl_status_desc']?.toLowerCase().trim();

        if (!appNum || !rawName) continue;
        const name = formatName(rawName);
        if (!name) continue;

        const year = filingDate ? filingDate.substring(0, 4) : '';
        const isGranted = GRANTED_STATUSES.has(statusDesc) || (patentNumber && patentNumber !== '0' && patentNumber !== '') ? '1' : '0';

        // Escape commas in name
        const safeName = name.includes(',') ? `"${name}"` : name;
        writeStream.write(`${appNum},${safeName},${year},${isGranted}\n`);
        written++;

        if (rowCount % 1000000 === 0) {
          console.log(`  Read ${rowCount.toLocaleString()} rows, wrote ${written.toLocaleString()} lookup entries...`);
        }
      }
    });

    parser.on('error', reject);
    parser.on('end', () => {
      writeStream.end();
      resolve();
    });
    stream.pipe(parser);
  });

  console.log(`\n  Done. Wrote ${written.toLocaleString()} entries to app_lookup.csv.\n`);
}

// ─── Step 2: Stream both files and aggregate stats using a rolling window ─────

async function processWithLookup() {
  console.log('Step 2: Processing transactions.csv using lookup file...');
  console.log('  Loading lookup into memory in chunks...\n');

  // Load lookup into a Map — but only app_number -> {name, year, isGranted}
  // This is much smaller than before since we dropped all the extra fields
  const appLookup = new Map();

  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(LOOKUP_PATH);
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    parser.on('readable', () => {
      let record;
      while ((record = parser.read()) !== null) {
        appLookup.set(record.app_number, {
          name: record.examiner_name,
          year: record.filing_year,
          isGranted: record.is_granted === '1',
        });
      }
    });
    parser.on('error', reject);
    parser.on('end', resolve);
    stream.pipe(parser);
  });

  console.log(`  Loaded ${appLookup.size.toLocaleString()} app lookup entries.\n`);

  // Initialize examiner stats — minimal structure
  const examinerStats = new Map();

  const getStats = (name) => {
    if (!examinerStats.has(name)) {
      examinerStats.set(name, {
        nonFinalRejections: 0,
        finalRejections: 0,
        interviews: 0,
        interviewAllowances: 0,
        appsByYear: {},
        grantsByYear: {},
        oaByApp: {},
        lastInterviewApp: new Set(),
      });
    }
    return examinerStats.get(name);
  };

  // First populate year/grant data from lookup
  for (const [, info] of appLookup) {
    const stats = getStats(info.name);
    const year = info.year;
    if (year >= '2010' && year <= '2023') {
      stats.appsByYear[year] = (stats.appsByYear[year] || 0) + 1;
      if (info.isGranted) {
        stats.grantsByYear[year] = (stats.grantsByYear[year] || 0) + 1;
      }
    }
  }

  console.log(`  Initialized stats for ${examinerStats.size.toLocaleString()} examiners from lookup.`);
  console.log('  Now streaming transactions.csv (this will take 20-40 minutes)...\n');

  let rowCount = 0;
  let matched = 0;
  const pendingInterviews = new Map(); // appNum -> examinerName

  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(TRANSACTIONS_PATH);
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    parser.on('readable', () => {
      let record;
      while ((record = parser.read()) !== null) {
        rowCount++;

        if (rowCount % 10000000 === 0) {
          const pct = ((rowCount / 507000000) * 100).toFixed(1);
          console.log(`  ${rowCount.toLocaleString()} rows (${pct}%) — ${matched.toLocaleString()} matched — ${examinerStats.size.toLocaleString()} examiners`);
        }

        const appNum = record['application_number']?.trim();
        const eventCode = record['event_code']?.trim().toUpperCase();

        if (!appNum || !eventCode) continue;

        const info = appLookup.get(appNum);
        if (!info) continue;

        matched++;
        const stats = getStats(info.name);

        if (eventCode === 'CTNF' || eventCode === 'MCTNF') {
          stats.nonFinalRejections++;
          stats.oaByApp[appNum] = (stats.oaByApp[appNum] || 0) + 1;
        }

        if (eventCode === 'CTFR' || eventCode === 'MCTFR') {
          stats.finalRejections++;
        }

        if (eventCode === 'EXIN') {
          stats.interviews++;
          pendingInterviews.set(appNum, info.name);
        }

        if (eventCode === 'NAIL' || eventCode === 'N/=.' || eventCode === 'N/.') {
          if (pendingInterviews.has(appNum)) {
            stats.interviewAllowances++;
            pendingInterviews.delete(appNum);
          }
        }

        if (eventCode === 'ABN' || eventCode === 'ABNF' || eventCode === 'MABN') {
          pendingInterviews.delete(appNum);
        }
      }
    });

    parser.on('error', reject);
    parser.on('end', resolve);
    stream.pipe(parser);
  });

  console.log(`\n  Done. Processed ${rowCount.toLocaleString()} transaction rows.\n`);
  return examinerStats;
}

// ─── Step 3: Upsert enriched stats ────────────────────────────────────────────

async function upsertEnrichedStats(examinerStats) {
  console.log('Step 3: Computing final stats and upserting to Supabase...');

  const rows = [];

  for (const [name, stats] of examinerStats) {
    const grant_rate_by_year = {};
    for (const year of Object.keys(stats.appsByYear).sort()) {
      const apps = stats.appsByYear[year];
      const grants = stats.grantsByYear[year] || 0;
      if (apps >= 3) {
        grant_rate_by_year[year] = Math.round((grants / apps) * 10000) / 100;
      }
    }

    const rejection_codes = {
      non_final: stats.nonFinalRejections,
      final: stats.finalRejections,
      total: stats.nonFinalRejections + stats.finalRejections,
    };

    const interview_allowance_rate = stats.interviews > 0
      ? Math.round((stats.interviewAllowances / stats.interviews) * 10000) / 100
      : null;

    const oaApps = Object.values(stats.oaByApp);
    const avg_office_actions_actual = oaApps.length > 0
      ? Math.round((oaApps.reduce((a, b) => a + b, 0) / oaApps.length) * 100) / 100
      : null;

    rows.push({
      name,
      rejection_codes,
      interview_count: stats.interviews,
      interview_allowance_rate,
      grant_rate_by_year: Object.keys(grant_rate_by_year).length > 0 ? grant_rate_by_year : null,
      avg_office_actions_actual,
    });
  }

  console.log(`  Upserting ${rows.length.toLocaleString()} enriched examiner records...`);

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('examiners')
      .upsert(batch, { onConflict: 'name', ignoreDuplicates: false });

    if (error) {
      failed += batch.length;
      console.error(`  ERROR on batch ${i}: ${error.message}`);
    } else {
      processed += batch.length;
      if (processed % 5000 === 0 || processed === rows.length) {
        console.log(`  Upserted ${processed.toLocaleString()} / ${rows.length.toLocaleString()}`);
      }
    }
  }

  return { processed, failed };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=================================================');
  console.log(' PatentIQ Examiner Enrichment Script v2         ');
  console.log('=================================================');
  console.log(`Started at: ${new Date().toISOString()}\n`);
  console.log('This script uses a disk-based approach to avoid running out of memory.');
  console.log('Total estimated time: 25-45 minutes. Do not close your terminal.\n');

  const startTime = Date.now();

  // Skip step 1 if lookup file already exists
  if (fs.existsSync(LOOKUP_PATH)) {
    console.log('Step 1: app_lookup.csv already exists — skipping.\n');
  } else {
    await buildLookupFile();
  }

  const examinerStats = await processWithLookup();
  const { processed, failed } = await upsertEnrichedStats(examinerStats);

  const totalMinutes = ((Date.now() - startTime) / 60000).toFixed(1);

  console.log('\n=================================================');
  console.log(' Summary');
  console.log('=================================================');
  console.log(`  Examiners enriched : ${processed.toLocaleString()}`);
  console.log(`  Failed             : ${failed}`);
  console.log(`  Total time         : ${totalMinutes} minutes`);
  console.log(`  Finished at        : ${new Date().toISOString()}`);
  console.log('=================================================\n');
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});