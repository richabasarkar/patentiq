'use strict';

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { parse } = require('csv-parse');

const EXAMINER_PATH = path.join(process.env.HOME, 'Desktop/PatentIQ/g_examiner_not_disambiguated.tsv');
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
    parser.on('end', () => {
      console.log(`  ${label}: done — ${rowCount.toLocaleString()} total rows`);
      resolve(rowCount);
    });
    stream.pipe(parser);
  });
}

async function main() {
  console.log('=================================================');
  console.log(' PatentIQ — Add New Examiners (TSV, no overwrite)');
  console.log('=================================================');
  console.log(`Started: ${new Date().toISOString()}\n`);

  const startTime = Date.now();

  // ── Step 1: Load existing examiner names from Supabase ───────────────────
  console.log('STEP 1: Loading existing examiner names from Supabase...');
  const existingNames = new Set();
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('examiners')
      .select('name')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) { console.error('Error fetching examiners:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    for (const row of data) existingNames.add(row.name.toUpperCase());
    page++;
    if (data.length < pageSize) break;
  }

  console.log(`  Existing examiners in DB: ${existingNames.size.toLocaleString()}\n`);

  // ── Step 2: Parse TSV and collect NEW examiners only ─────────────────────
  console.log('STEP 2: Scanning TSV for new examiners not in database...');
  const newExaminers = new Map();

  await parseTSV(EXAMINER_PATH, (record) => {
    const firstName = record['raw_examiner_name_first']?.trim() ?? '';
    const lastName = record['raw_examiner_name_last']?.trim() ?? '';
    const role = record['examiner_role']?.trim().toLowerCase() ?? '';
    const artGroup = record['art_group']?.trim() ?? '';

    if (!firstName && !lastName) return;
    if (role && role !== 'primary') return;

    const fullName = toTitleCase(`${firstName} ${lastName}`.trim());
    if (!fullName) return;

    const key = fullName.toUpperCase();

    // Skip if already in database
    if (existingNames.has(key)) return;

    if (!newExaminers.has(key)) {
      newExaminers.set(key, {
        name: fullName,
        art_unit_number: artGroup || null,
      });
    }
  }, 'g_examiner');

  console.log(`  New examiners to add: ${newExaminers.size.toLocaleString()}\n`);

  if (newExaminers.size === 0) {
    console.log('No new examiners to add. Database is up to date.');
    return;
  }

  // ── Step 3: Insert new examiners only ────────────────────────────────────
  console.log('STEP 3: Inserting new examiners into Supabase...');
  const rows = Array.from(newExaminers.values()).map(ex => ({
    name: ex.name,
    art_unit_number: ex.art_unit_number,
    // No grant_rate — insufficient data
    // All other fields left null — will show "Limited data available" in UI
    updated_at: new Date().toISOString(),
  }));

  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    try {
      const { error } = await supabase
        .from('examiners')
        .insert(batch);
      if (error) throw error;
      inserted += batch.length;
      if (inserted % 5000 === 0) console.log(`  Inserted ${inserted.toLocaleString()} / ${rows.length.toLocaleString()}`);
    } catch (err) {
      failed += batch.length;
      console.error(`  ERROR on batch ${i}: ${err.message}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n=================================================');
  console.log(' Summary');
  console.log('=================================================');
  console.log(`  Existing examiners (unchanged) : ${existingNames.size.toLocaleString()}`);
  console.log(`  New examiners added            : ${inserted.toLocaleString()}`);
  console.log(`  Failed                         : ${failed}`);
  console.log(`  Total in DB now                : ~${(existingNames.size + inserted).toLocaleString()}`);
  console.log(`  Time elapsed                   : ${elapsed}s`);
  console.log(`  Finished                       : ${new Date().toISOString()}`);
  console.log('=================================================\n');
}

main().catch(err => { console.error('Unhandled error:', err); process.exit(1); });