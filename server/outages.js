// INTSUM internet-outage collector (Georgia Tech IODA public API, no key). Run from repo root: node server/outages.js
// Writes data/outages.json: top countries by outage score over the last 24 h. Keeps old data on failure.
const fs = require('fs');
const OUT = 'data/outages.json';
const BASE = 'https://api.ioda.inetintel.cc.gatech.edu/v2/outages/summary';

// Tiny territories and micro-states: IODA's relative score ranks them first on routine blips, which drowns real national events.
const SMALL = new Set('AQ AS AI AW BM BQ CC CK CW CX FK FO GI GL GU IM JE GG KY MP MS NC NF NU PF PM PN PR SH SX TC TK VG VI WF YT MF BL GF GP MQ RE AX SJ TV NR PW MH FM KI VA MC LI SM AD'.split(' '));
function parse(j) {
  if (!j || !Array.isArray(j.data)) return null;
  const rows = j.data.filter(x => x && x.entity && x.entity.name && !SMALL.has(String(x.entity.code || '').toUpperCase()) && Number(x.event_cnt) > 0 && x.scores && Number(x.scores.overall) > 0)
    .sort((a, b) => b.scores.overall - a.scores.overall).slice(0, 6)
    .map(x => ({ code: String(x.entity.code || ''), name: String(x.entity.name), events: Number(x.event_cnt) }));
  return rows;
}
module.exports = { parse };

async function main() {
  const now = Math.floor(Date.now() / 1000), checkedAt = new Date().toISOString();
  const url = BASE + '?entityType=country&from=' + (now - 86400) + '&until=' + now + '&limit=30';
  let res, err;
  for (let i = 0; i < 2 && !res; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'intsum-dashboard/1.0', Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const rows = parse(await r.json());
      if (!rows) throw new Error('unrecognised format');
      res = { ok: true, checkedAt, countries: rows };
    } catch (e) { err = String(e.message || e); await new Promise(s => setTimeout(s, 3000)); }
  }
  if (!res) {
    let old = null; try { old = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { /* none */ }
    res = Object.assign(old || { countries: [] }, { ok: false, checkedAt, error: err });
  }
  fs.writeFileSync(OUT + '.tmp', JSON.stringify(res)); fs.renameSync(OUT + '.tmp', OUT); fs.chmodSync(OUT, 0o644);
  console.log(checkedAt + ' outages ' + (res.ok ? 'OK n=' + res.countries.length + ' ' + res.countries.map(c => c.code).join(',') : 'FAIL ' + err));
}
if (require.main === module) main().catch(e => { console.error('outages failed: ' + e); process.exit(1); });
