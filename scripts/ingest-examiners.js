'use strict';

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { parse } = require('csv-parse');

// ─── Config ───────────────────────────────────────────────────────────────────

const APP_DATA_PATH = path.join(process.env.HOME, 'Desktop/PatentIQ/application_data.csv');
const BATCH_SIZE = 500;
const LOG_EVERY = 5000;

const {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase env vars. Check .env.local.');
  process.exit(1);
}

// ─── Supabase ─────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDate(str) {
  if (!str || str.trim() === '') return null;
  const d = new Date(str.trim());
  return isNaN(d.getTime()) ? null : d;
}

function monthsBetween(a, b) {
  if (!a || !b) return null;
  return Math.abs(
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  );
}

// Convert "LATEEF, MARVIN M" → "Marvin M Lateef"
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
  return str
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Stream and process CSV ───────────────────────────────────────────────────

async function processCSV() {
  console.log(`Reading: ${APP_DATA_PATH}`);

  if (!fs.existsSync(APP_DATA_PATH)) {
    console.error(`File not found: ${APP_DATA_PATH}`);
    console.error('Make sure application_data.csv is in ~/Desktop/PatentIQ/');
    process.exit(1);
  }

  const examinerMap = new Map();

  const GRANTED_STATUSES = new Set([
    'patented case',
    'patent granted',
    'patented file - (old case added for file tracking purposes)',
  ]);

  let rowCount = 0;
  let skipped = 0;

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

        if (rowCount % LOG_EVERY === 0) {
          console.log(`  Processed ${rowCount.toLocaleString()} rows — ${examinerMap.size.toLocaleString()} unique examiners so far`);
        }

        const rawName = record['examiner_full_name'];
        const formattedName = formatName(rawName);

        if (!formattedName) {
          skipped++;
          continue;
        }

        const key = formattedName.toUpperCase();
        const artUnit = record['examiner_art_unit']?.trim() ?? '';
        const filingDate = parseDate(record['filing_date']);
        const issueDate = parseDate(record['patent_issue_date']);
        const statusDate = parseDate(record['appl_status_date']);
        const statusDesc = record['appl_status_desc']?.toLowerCase().trim() ?? '';
        const patentNumber = record['patent_number']?.trim() ?? '';

        const isGranted =
          GRANTED_STATUSES.has(statusDesc) ||
          (patentNumber !== '' && patentNumber !== '0');

        if (!examinerMap.has(key)) {
          examinerMap.set(key, {
            name: formattedName,
            art_unit_number: artUnit,
            total: 0,
            granted: 0,
            totalPendency: 0,
            pendencyCount: 0,
          });
        }

        const ex = examinerMap.get(key);
        ex.total++;

        // Update art unit to latest non-empty value
        if (artUnit && !ex.art_unit_number) {
          ex.art_unit_number = artUnit;
        }

        // Grant rate: all applications ever handled
        ex.total++;
        if (isGranted) ex.granted++;

        // Pendency: filing → issue or status date
        const endDate = issueDate ?? statusDate;
        const pendency = monthsBetween(filingDate, endDate);
        if (pendency !== null && pendency > 0 && pendency < 120) {
          ex.totalPendency += pendency;
          ex.pendencyCount++;
        }
      }
    });

    parser.on('error', reject);
    parser.on('end', resolve);
    stream.pipe(parser);
  });

  console.log(`\nFinished reading CSV.`);
  console.log(`  Total rows processed  : ${rowCount.toLocaleString()}`);
  console.log(`  Rows skipped (no name): ${skipped.toLocaleString()}`);
  console.log(`  Unique examiners found: ${examinerMap.size.toLocaleString()}\n`);

  return examinerMap;
}

// ─── Upsert to Supabase in batches ────────────────────────────────────────────

async function upsertBatch(rows) {
  const { error } = await supabase
    .from('examiners')
    .upsert(rows, { onConflict: 'name', ignoreDuplicates: false });
  if (error) throw error;
}

async function upsertAllExaminers(examinerMap) {
  const rows = [];

  for (const [, ex] of examinerMap) {
    // grant_rate_3yr is now full historical grant rate
    const grant_rate_3yr =
      ex.total > 0
        ? Math.round((ex.granted / ex.total) * 10000) / 100
        : null;

    const pendency_months =
      ex.pendencyCount > 0
        ? Math.round((ex.totalPendency / ex.pendencyCount) * 10) / 10
        : null;

    rows.push({
      name: ex.name,
      art_unit_number: ex.art_unit_number || null,
      grant_rate_3yr,
      pendency_months,
      total_applications: ex.total,
      avg_office_actions: null,
      top_rejection_codes: null,
      updated_at: new Date().toISOString(),
    });
  }

  console.log(`Upserting ${rows.length.toLocaleString()} examiners to Supabase...`);

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    try {
      await upsertBatch(batch);
      processed += batch.length;
      console.log(`  Upserted ${processed.toLocaleString()} / ${rows.length.toLocaleString()}`);
    } catch (err) {
      failed += batch.length;
      console.error(`  ERROR on batch ${i}–${i + BATCH_SIZE}: ${err.message}`);
    }
  }

  return { processed, failed };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=================================================');
  console.log(' USPTO Patent Examiner Statistics - Ingest Job  ');
  console.log('=================================================');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Supabase URL: ${SUPABASE_URL}\n`);

  const startTime = Date.now();

  const examinerMap = await processCSV();
  const { processed, failed } = await upsertAllExaminers(examinerMap);

  const totalSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n=================================================');
  console.log(' Summary');
  console.log('=================================================');
  console.log(`  Unique examiners found : ${examinerMap.size.toLocaleString()}`);
  console.log(`  Records upserted       : ${processed.toLocaleString()}`);
  console.log(`  Records failed         : ${failed}`);
  console.log(`  Time elapsed           : ${totalSeconds}s`);
  console.log(`  Finished at            : ${new Date().toISOString()}`);
  console.log('=================================================\n');
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});