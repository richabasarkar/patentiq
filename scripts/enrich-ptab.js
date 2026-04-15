'use strict';

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const { NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, USPTO_API_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !USPTO_API_KEY) {
  console.error('Missing env vars. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, USPTO_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const BASE_URL = 'https://api.uspto.gov/api/v1/patent/appeals/decisions/search';
const PAGE_SIZE = 50;
const DELAY_MS = 250;
const BATCH_SIZE = 300;
const TOTAL_DECISIONS = 163175;

// ─── Extract examiner name from OCR text ──────────────────────────────────────
// OCR text contains patterns like:
// "EXAMINER\n\nSMITH, JOHN" or "EXAMINER\n\nSMITH, JOHN A"
// or "EXAMINER SMITH, JOHN" etc.

function extractExaminerName(ocrText) {
  if (!ocrText) return null;

  // Pattern 1: EXAMINER followed by newlines then LASTNAME, FIRSTNAME
  const patterns = [
    /EXAMINER\s*\n+\s*([A-Z][A-Z\s\-']+,\s*[A-Z][A-Z\s\-'.]+)/,
    /EXAMINER\s+([A-Z][A-Z\s\-']+,\s*[A-Z][A-Z\s\-'.]+)/,
    /EXAMINER\s*:\s*([A-Z][A-Z\s\-']+,\s*[A-Z][A-Z\s\-'.]+)/,
  ];

  for (const pattern of patterns) {
    const match = ocrText.match(pattern);
    if (match) {
      const raw = match[1].trim();
      // Convert "LASTNAME, FIRSTNAME" → "Firstname Lastname"
      const commaIdx = raw.indexOf(',');
      if (commaIdx === -1) return toTitleCase(raw);
      const last = raw.slice(0, commaIdx).trim();
      const first = raw.slice(commaIdx + 1).trim();
      // Remove middle initials artifacts and clean up
      const firstName = first.split(/\s+/)[0]; // take only first name, not middle
      return toTitleCase(`${firstName} ${last}`);
    }
  }
  return null;
}

function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Fetch one page of decisions ─────────────────────────────────────────────

async function fetchPage(offset) {
  const url = `${BASE_URL}?limit=${PAGE_SIZE}&offset=${offset}`;
  const res = await fetch(url, {
    headers: {
      'X-API-KEY': USPTO_API_KEY,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} at offset ${offset}`);
  }

  const data = await res.json();
  return data.patentAppealDataBag || [];
}

// ─── Main processing ──────────────────────────────────────────────────────────

async function main() {
  console.log('=================================================');
  console.log(' PatentIQ — PTAB Appeal Enrichment              ');
  console.log('=================================================');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`Total decisions to process: ~${TOTAL_DECISIONS.toLocaleString()}`);
  console.log(`Estimated time: ~${Math.ceil(TOTAL_DECISIONS / PAGE_SIZE * DELAY_MS / 60000)} minutes\n`);

  const t0 = Date.now();

  // examinerData: Map<examinerName, { total, affirmed, reversed, remanded }>
  const examinerData = new Map();

  const get = (name) => {
    if (!examinerData.has(name)) {
      examinerData.set(name, { total: 0, affirmed: 0, reversed: 0, remanded: 0 });
    }
    return examinerData.get(name);
  };

  let offset = 0;
  let totalProcessed = 0;
  let totalMatched = 0;
  let errors = 0;

  while (offset < TOTAL_DECISIONS) {
    try {
      const decisions = await fetchPage(offset);

      if (decisions.length === 0) break;

      for (const d of decisions) {
        totalProcessed++;

        const outcome = d.decisionData?.appealOutcomeCategory;
        if (!outcome) continue;

        // Try to get examiner from OCR text
        const ocrText = d.documentData?.documentOCRText;
        const examinerName = extractExaminerName(ocrText);

        if (!examinerName) continue;

        totalMatched++;
        const stats = get(examinerName);
        stats.total++;

        const outcomeLower = outcome.toLowerCase();
        if (outcomeLower.includes('affirm')) stats.affirmed++;
        else if (outcomeLower.includes('revers')) stats.reversed++;
        else if (outcomeLower.includes('remand')) stats.remanded++;
      }

      offset += decisions.length;

      if (offset % 1000 === 0 || offset >= TOTAL_DECISIONS) {
        const pct = Math.min(100, ((offset / TOTAL_DECISIONS) * 100)).toFixed(1);
        const elapsed = ((Date.now() - t0) / 60000).toFixed(1);
        console.log(`  ${offset.toLocaleString()} / ${TOTAL_DECISIONS.toLocaleString()} (${pct}%) — ${totalMatched.toLocaleString()} matched — ${elapsed} min elapsed`);
      }

      await sleep(DELAY_MS);

    } catch (err) {
      errors++;
      console.error(`  Error at offset ${offset}: ${err.message}`);
      if (errors > 20) {
        console.error('Too many errors — stopping.');
        break;
      }
      await sleep(2000);
      // don't advance offset on error — retry same page
    }
  }

  console.log(`\n  Fetching complete. ${totalProcessed.toLocaleString()} decisions, ${totalMatched.toLocaleString()} matched to examiners.`);
  console.log(`  ${examinerData.size.toLocaleString()} unique examiners found.\n`);

  // ─── Upsert to Supabase ───────────────────────────────────────────────────

  console.log('Upserting to Supabase...');

  const rows = [];
  for (const [name, stats] of examinerData) {
    if (stats.total < 2) continue;

    const overturnRate = Math.round(
      ((stats.reversed + stats.remanded) / stats.total) * 10000
    ) / 100;
    const affirmRate = Math.round(
      (stats.affirmed / stats.total) * 10000
    ) / 100;

    rows.push({
      name,
      appeal_count: stats.total,
      appeal_overturn_rate: overturnRate,
      appeal_affirm_rate: affirmRate,
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
      if (ok % 1000 === 0 || ok === rows.length) {
        console.log(`  ${ok.toLocaleString()} / ${rows.length.toLocaleString()}`);
      }
    }
  }

  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  console.log('\n=================================================');
  console.log(` Done in ${mins} minutes`);
  console.log(` Decisions processed : ${totalProcessed.toLocaleString()}`);
  console.log(` Examiners matched   : ${totalMatched.toLocaleString()}`);
  console.log(` Upserted            : ${ok.toLocaleString()} | Failed: ${fail}`);
  console.log('=================================================\n');
}

main().catch(e => { console.error(e); process.exit(1); });