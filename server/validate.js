// Usage: node validate.js <file> <full|light>. Exit 0 if the refreshed data file looks sane.
const fs = require('fs');
const f = process.argv[2], mode = process.argv[3] || 'light';
function bad(m) { console.error('INVALID: ' + m); process.exit(1); }
let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { bad('not valid JSON: ' + e.message); }
for (const k of ['hotspots', 'chokepoints', 'incidents']) if (!Array.isArray(j[k])) bad(k + ' missing');
if (j.hotspots.length < 8) bad('too few hotspots: ' + j.hotspots.length);
if (j.chokepoints.length < 4) bad('too few chokepoints');
const m = j.meta || {};
if (typeof m.brief !== 'string' || m.brief.length < 1500) bad('brief missing or too short');
if (!Array.isArray(m.questions) || m.questions.length < 3) bad('questions missing');
if (!Array.isArray(m.feeds)) bad('feeds missing');
if (!m.updatedAt || isNaN(Date.parse(m.updatedAt))) bad('updatedAt missing');
for (const k of ['hotspots', 'chokepoints', 'incidents'])
  for (const it of j[k]) {
    if (!it.id || typeof it.id !== 'string') bad(k + ' item without id');
    if (it.sev != null && !(it.sev >= 1 && it.sev <= 5)) bad(k + '/' + it.id + ' bad sev');
    if (!Array.isArray(it.sources) || !it.sources.every(s => s && /^https?:\/\//.test(s.u || ''))) bad(k + '/' + it.id + ' bad sources');
  }
if (mode === 'full' && !/Russia and Ukraine/.test(m.brief)) bad('brief lacks the Russia and Ukraine section');
console.log('OK ' + j.hotspots.length + ' hotspots, ' + j.chokepoints.length + ' chokepoints, ' + j.incidents.length + ' incidents');
