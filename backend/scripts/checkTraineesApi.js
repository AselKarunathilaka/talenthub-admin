#!/usr/bin/env node
// Simple checker for the external trainees API
// Usage (PowerShell):
//   $env:TRAINEES_API_SECRET_KEY="..."; node scripts/checkTraineesApi.js

const axios = require('axios');

const BASE_URL = process.env.TRAINEES_API_BASE_URL || 'https://prohub.slt.com.lk/ProhubTrainees/api/MainApi/AllActiveTrainees';
const SECRET = process.env.TRAINEES_API_SECRET_KEY || '';
const TIMEOUT = Number(process.env.TRAINEES_API_TIMEOUT_MS || 15000);

if (!SECRET) {
  console.error('Missing TRAINEES_API_SECRET_KEY env var.');
  process.exit(1);
}

const client = axios.create({ baseURL: BASE_URL, timeout: TIMEOUT, headers: { 'Content-Type': 'application/json' } });

const mapOne = (ext) => ({
  traineeId: String(ext.Trainee_ID ?? '').trim(),
  traineeName: String(ext.Trainee_Name ?? '').trim(),
  homeAddress: String(ext.Trainee_HomeAddress ?? '').trim(),
  trainingStartDate: ext.Training_StartDate || null,
  trainingEndDate: ext.Training_EndDate || null,
  email: String(ext.Trainee_Email ?? '').trim(),
  institute: String(ext.Institute ?? '').trim(),
  fieldOfSpecialization: String(ext.field_of_spec_name ?? '').trim(),
});

(async () => {
  const started = Date.now();
  try {
    const { data } = await client.post('', { secretKey: SECRET });
    const elapsed = Date.now() - started;

    let rows = null;
    if (Array.isArray(data)) {
      rows = data;
    } else if (data && typeof data === 'object') {
      if (data.isSuccess === false) {
        throw new Error(data.errorMessage || 'API indicated failure');
      }
      const bundle = data.dataBundle;
      if (Array.isArray(bundle)) {
        rows = bundle;
      } else if (bundle && typeof bundle === 'object') {
        const firstArray = Object.values(bundle).find(v => Array.isArray(v));
        if (Array.isArray(firstArray)) rows = firstArray;
      }
    }

    if (!Array.isArray(rows)) {
      console.error('Unexpected response shape:', typeof data, data && Object.keys(data));
      process.exit(2);
    }
    console.log(`OK: received ${rows.length} trainees in ${elapsed}ms`);

    const sample = rows.slice(0, Math.min(5, rows.length));
    console.log('\nRaw sample (first up to 5):');
    for (const r of sample) {
      console.log(`- ${r.Trainee_ID} | ${r.Trainee_Name} | ${r.field_of_spec_name} | ${r.Trainee_Email ?? ''}`);
    }

    console.log('\nMapped sample:');
    for (const r of sample.map(mapOne)) {
      console.log(r);
    }

    // Show quick counts by specialization (top 5)
    const counts = {};
    for (const r of rows) {
      const k = (r.field_of_spec_name || 'Unknown').trim();
      counts[k] = (counts[k] || 0) + 1;
    }
    const top = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,5);
    console.log('\nTop specializations:', top);

  } catch (err) {
    const status = err.response?.status;
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error(`Request failed${status ? ` (${status})` : ''}: ${detail}`);
    process.exit(3);
  }
})();
