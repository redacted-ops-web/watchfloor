// Usage: node apply-patch.js <live.json> <patch.json> <out.json>
// Merges a small patch written by the light refresh into the full data file, stamps the time, and writes <out.json>.
// The model never rewrites the whole data file: it only lists what changed.
const fs = require('fs');
const [, , liveF, patchF, outF] = process.argv;
function die(m) { console.error('PATCH: ' + m); process.exit(1); }
function load(f, what) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { die('cannot read ' + what + ' (' + f + '): ' + e.message); } }
const live = load(liveF, 'data file');
const patch = load(patchF, 'patch');
if (!patch || typeof patch !== 'object' || Array.isArray(patch)) die('patch is not an object');

const LISTS = ['hotspots', 'chokepoints', 'incidents'];
const SETTABLE = ['summary', 'sev', 'trend', 'asof', 'bullets', 'sources', 'metric', 'metricNote'];
const goodSources = s => Array.isArray(s) && s.length > 0 && s.every(x => x && /^https?:\/\//.test(x.u || ''));
let upd = 0, added = 0, skipped = 0;

(Array.isArray(patch.updates) ? patch.updates : []).forEach(u => {
  const it = u && LISTS.includes(u.list) && u.set && typeof u.set === 'object'
    ? (live[u.list] || []).find(x => x.id === u.id) : null;
  if (!it) { skipped++; return; }
  Object.keys(u.set).forEach(k => {
    if (!SETTABLE.includes(k)) return;
    const v = u.set[k];
    if (k === 'sev' && !(v >= 1 && v <= 5)) return;
    if (k === 'sources' && !goodSources(v)) return;
    if (k === 'bullets' && !Array.isArray(v)) return;
    it[k] = v;
  });
  upd++;
});

(Array.isArray(patch.adds) ? patch.adds : []).forEach(a => {
  const it = a && a.item;
  if (!a || !LISTS.includes(a.list) || !it || typeof it.id !== 'string' || !goodSources(it.sources)) { skipped++; return; }
  if (LISTS.some(l => (live[l] || []).some(x => x.id === it.id))) { skipped++; return; }
  live[a.list].push(it); added++;
});

live.meta = live.meta || {};
if (Array.isArray(patch.indicators) && patch.indicators.length >= 3 && patch.indicators.every(x => x && typeof x === 'object')) live.meta.indicators = patch.indicators;

const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
live.generatedAt = now;
live.meta.updatedAt = now;
live.meta.updatedBy = 'Server refresh (light)';
fs.writeFileSync(outF, JSON.stringify(live, null, 2) + '\n');
console.log('PATCH applied: ' + upd + ' updated, ' + added + ' added, ' + skipped + ' skipped' + (typeof patch.note === 'string' ? ' - ' + patch.note.slice(0, 200) : ''));
