'use strict';

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// ─── Config ───────────────────────────────────────────────────────────────────

const USPTO_SEARCH_URL = 'https://api.uspto.gov/api/v1/patent/applications/search';
const PAGE_SIZE = 100;
const DELAY_MS = 600;
const LOG_EVERY = 50;
const MAX_RECORDS = 5000;

const {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  USPTO_API_KEY,
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

function buildHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (USPTO_API_KEY) headers['X-API-KEY'] = USPTO_API_KEY;
  return headers;
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// ─── Fetch one page ───────────────────────────────────────────────────────────

async function fetchPage(start) {
    const params = new URLSearchParams({
        q: '*:*',
        rows: PAGE_SIZE,
        offset: start,
    });

  const url = `${USPTO_SEARCH_URL}?${params.toString()}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '(no body)');
    throw new Error(`USPTO API returned ${res.status}: ${text.slice(0, 300)}`);
  }

const json = await res.json();

  console.log('Raw API response (first page):');
  console.log(JSON.stringify(json, null, 2).slice(0, 2000));

  const docs =
    json?.response?.docs ??
    json?.results ??
    json?.docs ??
    json?.data ??
    json?.patents ??
    json?.applications ??
    [];

  const numFound =
    json?.response?.numFound ??
    json?.totalCount ??
    json?.numFound ??
    json?.total ??
    json?.count ??
    0;

  return { docs, numFound };
}

// ─── Fetch all records ────────────────────────────────────────────────────────

async function fetchAllRecords() {
  console.log('Fetching first page from Patent File Wrapper API...');

  const firstPage = await fetchPage(0);
  const { numFound } = firstPage;
  const allDocs = [...firstPage.docs];

  console.log(`Total records available: ${numFound.toLocaleString()}`);
  console.log(`Will fetch up to ${MAX_RECORDS.toLocaleString()} records.\n`);

  if (allDocs.length > 0) {
    console.log('Sample raw record (first result):');
    console.log(JSON.stringify(allDocs[0], null, 2));
    console.log('\n');
  }

  const limit = Math.min(numFound, MAX_RECORDS);
  const totalPages = Math.ceil(limit / PAGE_SIZE);

  for (let page = 1; page < totalPages; page++) {
    const start = page * PAGE_SIZE;
    await delay(DELAY_MS);

    let docs;
    try {
      ({ docs } = await fetchPage(start));
    } catch (err) {
      console.warn(`  Warning: page ${page + 1} failed (${err.message}) — skipping`);
      continue;
    }

    allDocs.push(...docs);

    const fetched = Math.min(start + PAGE_SIZE, limit);
    if (page % 5 === 0 || page === totalPages - 1) {
      console.log(`  Fetched ${fetched.toLocaleString()} / ${limit.toLocaleString()} records`);
    }
  }

  return allDocs;
}

// ─── Group by examiner ────────────────────────────────────────────────────────

function groupByExaminer(allRecords) {
  const examiners = new Map();

  for (const r of allRecords) {
    const rawName = r.examinerNameText?.trim();
    if (!rawName) continue;

    const artUnit = r.groupArtUnitNumber?.toString().trim() ?? '';
    const key = rawName.toUpperCase();

    if (!examiners.has(key)) {
      examiners.set(key, {
        name: rawName,
        art_unit_number: artUnit,
        records: [],
      });
    }

    examiners.get(key).records.push(r);
  }

  return examiners;
}

// ─── Calculate stats ──────────────────────────────────────────────────────────

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function monthsBetween(a, b) {
  if (!a || !b) return null;
  return Math.abs(
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  );
}

function calculateStats(records) {
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

  let granted = 0;
  let withinWindow = 0;
  let totalPendency = 0;
  let pendencyCount = 0;

  const GRANTED_CODES = new Set(['160', '161', '162', '163', '164', '165', '166', '167']);

  for (const r of records) {
    const filingDate = parseDate(r.filingDate);
    const issueDate = parseDate(r.patentIssueDate);
    const statusDate = parseDate(r.applicationStatusDate);
    const statusCode = r.applicationStatusCode?.toString().trim();

    const isGranted = GRANTED_CODES.has(statusCode) || !!r.patentIssueDate;

    if (filingDate && filingDate >= threeYearsAgo) {
      withinWindow++;
      if (isGranted) granted++;
    }

    const endDate = issueDate ?? statusDate;
    const pendency = monthsBetween(filingDate, endDate);
    if (pendency !== null && pendency < 120) {
      totalPendency += pendency;
      pendencyCount++;
    }
  }

  const grant_rate_3yr =
    withinWindow > 0
      ? Math.round((granted / withinWindow) * 10000) / 100
      : null;

  const pendency_months =
    pendencyCount > 0
      ? Math.round((totalPendency / pendencyCount) * 10) / 10
      : null;

  return {
    grant_rate_3yr,
    avg_office_actions: null,
    pendency_months,
    top_rejection_codes: null,
    total_applications: records.length,
  };
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

async function upsertExaminer(row) {
  const { error } = await supabase
    .from('examiners')
    .upsert(
      { ...row, updated_at: new Date().toISOString() },
      { onConflict: 'name', ignoreDuplicates: false }
    );
  if (error) throw error;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=================================================');
  console.log(' USPTO Patent Examiner Statistics - Ingest Job  ');
  console.log('=================================================');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Supabase URL: ${SUPABASE_URL}\n`);

  const startTime = Date.now();

  let allRecords;
  try {
    allRecords = await fetchAllRecords();
  } catch (err) {
    console.error('Fatal: could not fetch records from USPTO API:', err.message);
    process.exit(1);
  }

  console.log(`Fetched ${allRecords.length.toLocaleString()} total records.`);

  const examinerMap = groupByExaminer(allRecords);
  console.log(`Found ${examinerMap.size.toLocaleString()} unique examiners with names.\n`);

  if (examinerMap.size === 0) {
    console.log('No examiners found — the API returned records but none had examinerNameText.');
    console.log('Check the sample record printed above to see what fields are available.');
    process.exit(1);
  }

  let processed = 0;
  let failed = 0;
  const errors = [];

  for (const [, examinerData] of examinerMap) {
    const { records, ...examinerInfo } = examinerData;

    try {
      const stats = calculateStats(records);
      const row = { ...examinerInfo, ...stats };
      await upsertExaminer(row);
      processed++;

      if (processed % LOG_EVERY === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  Progress: ${processed} processed, ${failed} failed — ${elapsed}s`);
      }
    } catch (err) {
      failed++;
      const msg = `"${examinerInfo.name}": ${err.message}`;
      console.error(`  ERROR: ${msg}`);
      errors.push(msg);
    }

    await delay(10);
  }

  const totalSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n=================================================');
  console.log(' Summary');
  console.log('=================================================');
  console.log(`  Records fetched       : ${allRecords.length.toLocaleString()}`);
  console.log(`  Unique examiners      : ${examinerMap.size.toLocaleString()}`);
  console.log(`  Records processed     : ${processed}`);
  console.log(`  Records failed        : ${failed}`);
  console.log(`  Time elapsed          : ${totalSeconds}s`);
  console.log(`  Finished at           : ${new Date().toISOString()}`);
  console.log('=================================================\n');

  if (errors.length > 0) {
    console.log('Errors:');
    errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
    if (errors.length > 10) console.log(`  ... and ${errors.length - 10} more`);
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});