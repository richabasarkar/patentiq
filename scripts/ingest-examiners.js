'use strict';

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { parse } = require('csv-parse');

// ─── Config ───────────────────────────────────────────────────────────────────
const EXAMINER_PATH = path.join(process.env.HOME, 'Desktop/PatentIQ/g_examiner_not_disambiguated.tsv');
const APPLICATION_PATH = path.join(process.env.HOME, 'Desktop/PatentIQ/g_application.tsv');
const BATCH_SIZE = 500;
const LOG_EVERY = 100000;

const { NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase env vars. Check .env.local.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function parseTSV(filePath, onRecord, label) {
  return new Promise((resolve, reject) => {
    console.log(`Reading: ${filePath}`);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    let rowCount = 0;
    const stream = fs.createReadStream(filePath);
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter: '\t',
      relax_column_count: true,
      relax_quotes: true,
      quote: '"',
    });
    parser.on('readable', () => {
      let record;
      while ((record = parser.read()) !== null) {
        rowCount++;
        if (rowCount % LOG_EVERY === 0) console.log(`  ${label}: ${rowCount.toLocaleString()} rows processed`);
        onRecord(record);
      }
    });
    parser.on('error', reject);
    parser.on('end', () => { console.log(`  ${label}: done — ${rowCount.toLocaleString()} total rows`); resolve(rowCount); });
    stream.pipe(parser);
  });
}

async function main() {
  console.log('=================================================');
  console.log(' PatentIQ — Ingest from new USPTO ODP format');
  console.log('=================================================');
  console.log(`Started: ${new Date().toISOString()}\n`);

  const startTime = Date.now();

  // ── Step 1: Load all granted patent_ids from g_application.tsv ─────────────
  // In the new format, every row in g_application has a patent_id if granted
  console.log('STEP 1: Loading granted patent IDs from g_application.tsv...');
  const grantedPatentIds = new Set();
  const applicationFiling = new Map(); // patent_id → filing_date

  await parseTSV(APPLICATION_PATH, (record) => {
    const patentId = record['patent_id']?.trim();
    const filingDate = record['filing_date']?.trim();
    if (patentId && patentId !== '' && patentId !== '0') {
      grantedPatentIds.add(patentId);
      if (filingDate) applicationFiling.set(patentId, filingDate);
    }
  }, 'g_application');

  console.log(`  Granted patent IDs loaded: ${grantedPatentIds.size.toLocaleString()}\n`);

  // ── Step 2: Process examiner file ──────────────────────────────────────────
  console.log('STEP 2: Processing examiner data...');
  const examinerMap = new Map();

  await parseTSV(EXAMINER_PATH, (record) => {
    const firstName = record['raw_examiner_name_first']?.trim() ?? '';
    const lastName = record['raw_examiner_name_last']?.trim() ?? '';
    const role = record['examiner_role']?.trim().toLowerCase() ?? '';
    const artGroup = record['art_group']?.trim() ?? '';
    const patentId = record['patent_id']?.trim() ?? '';

    if (!firstName && !lastName) return;
    // Only count primary examiners
    if (role && role !== 'primary') return;

    const fullName = toTitleCase(`${firstName} ${lastName}`.trim());
    if (!fullName) return;

    const key = fullName.toUpperCase();
    const isGranted = grantedPatentIds.has(patentId);

    if (!examinerMap.has(key)) {
      examinerMap.set(key, {
        name: fullName,
        art_unit_number: artGroup || null,
        total: 0,
        granted: 0,
      });
    }

    const ex = examinerMap.get(key);
    ex.total++;
    if (isGranted) ex.granted++;
    // Update art unit to latest
    if (artGroup && !ex.art_unit_number) ex.art_unit_number = artGroup;

  }, 'g_examiner');

  console.log(`  Unique examiners found: ${examinerMap.size.toLocaleString()}\n`);

  // ── Step 3: Calculate rates and upsert ─────────────────────────────────────
  console.log('STEP 3: Upserting to Supabase...');
  const rows = [];

  for (const [, ex] of examinerMap) {
    // Only include examiners with at least 1 application
    if (ex.total === 0) continue;

    const grant_rate_3yr = Math.round((ex.granted / ex.total) * 10000) / 100;

    rows.push({
      name: ex.name,
      art_unit_number: ex.art_unit_number,
      grant_rate_3yr,
      total_applications: ex.total,
      updated_at: new Date().toISOString(),
    });
  }

  console.log(`  Rows to upsert: ${rows.length.toLocaleString()}`);

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    try {
      const { error } = await supabase.from('examiners').upsert(batch, { onConflict: 'name', ignoreDuplicates: false });
      if (error) throw error;
      processed += batch.length;
      if (processed % 5000 === 0) console.log(`  Upserted ${processed.toLocaleString()} / ${rows.length.toLocaleString()}`);
    } catch (err) {
      failed += batch.length;
      console.error(`  ERROR on batch ${i}: ${err.message}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n=================================================');
  console.log(' Summary');
  console.log('=================================================');
  console.log(`  Unique examiners   : ${examinerMap.size.toLocaleString()}`);
  console.log(`  Records upserted   : ${processed.toLocaleString()}`);
  console.log(`  Records failed     : ${failed}`);
  console.log(`  Time elapsed       : ${elapsed}s`);
  console.log(`  Finished           : ${new Date().toISOString()}`);
  console.log('=================================================\n');
}

main().catch(err => { console.error('Unhandled error:', err); process.exit(1); });