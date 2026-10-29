// INTSUM ship counter (AISstream websocket, free key). Run from repo root: AISSTREAM_KEY=... node server/ships.js
// Listens for ~90 s and counts distinct vessels that broadcast AIS position reports in each watch box.
// Terrestrial AIS is volunteer-fed and ships can switch off or spoof, so counts are a floor; the baseline shows change over time.
const fs = require('fs');
const OUT = 'data/ships.json', HIST = 'data/ships-history.json', KEY = process.env.AISSTREAM_KEY;
const LISTEN_MS = 90000;
const REGIONS = [
  { id: 'hormuz', name: 'Strait of Hormuz', box: [25, 54, 27.6, 57.6] },
  { id: 'gulf', name: 'Persian Gulf', box: [24, 48, 30.2, 56] },
  { id: 'babel', name: 'Bab el-Mandeb', box: [11.4, 41.8, 14.6, 45.6] },
  { id: 'suez', name: 'Suez and north Red Sea', box: [27, 32, 31.4, 34.6] },
  { id: 'blacksea', name: 'Black Sea', box: [41, 28, 46.6, 41.6] },
  { id: 'baltic', name: 'Baltic', box: [54, 12, 60, 25] },
  { id: 'taiwan', name: 'Taiwan Strait', box: [22, 117, 26.4, 121.4] }
];
const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
module.exports = { REGIONS, median };

async function main() {
  if (!KEY) { console.log(new Date().toISOString() + ' ships skipped (no key)'); return; }
  if (typeof WebSocket === 'undefined') { console.log(new Date().toISOString() + ' ships FAIL no WebSocket in this Node'); return; }
  const now = Date.now(), checkedAt = new Date(now).toISOString(), seen = {}; REGIONS.forEach(r => { seen[r.id] = new Set(); });
  let msgs = 0, raw = 0, err = null, firstRaw = '', opened = false, closeInfo = '';
  await new Promise(resolve => {
    const ws = new WebSocket('wss://stream.aisstream.io/v0/stream'); ws.binaryType = 'arraybuffer';
    const done = () => { try { ws.close(); } catch (e) { /* ignore */ } resolve(); };
    const t = setTimeout(done, LISTEN_MS);
    ws.onopen = () => { opened = true; ws.send(JSON.stringify({ APIKey: KEY, BoundingBoxes: REGIONS.map(r => [[r.box[0], r.box[1]], [r.box[2], r.box[3]]]), FilterMessageTypes: ['PositionReport'] })); };
    ws.onmessage = ev => {
      try {
        raw++; const txt = typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data); if (!firstRaw) firstRaw = txt.slice(0, 160).replace(/"APIKey"[^,}]*/g, '');
        const m = JSON.parse(txt);
        if (m.error) { err = String(m.error); clearTimeout(t); return done(); }
        const p = m.Message && m.Message.PositionReport, mm = m.MetaData; if (!p || !mm) return;
        const lat = Number(p.Latitude != null ? p.Latitude : mm.latitude), lon = Number(p.Longitude != null ? p.Longitude : mm.longitude), id = mm.MMSI || p.UserID;
        if (!isFinite(lat) || !isFinite(lon) || !id) return; msgs++;
        REGIONS.forEach(r => { const b = r.box; if (lat >= b[0] && lat <= b[2] && lon >= b[1] && lon <= b[3]) seen[r.id].add(id); });
      } catch (e) { /* skip bad frame */ }
    };
    ws.onerror = e => { err = err || 'websocket error ' + String((e && e.message) || ''); clearTimeout(t); done(); };
    ws.onclose = e => { closeInfo = 'close ' + (e && e.code) + ' ' + (e && e.reason || ''); clearTimeout(t); resolve(); };
  });
  let old = null; try { old = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { /* none */ }
  let hist = []; try { hist = JSON.parse(fs.readFileSync(HIST, 'utf8')); } catch (e) { /* none */ }
  let res;
  if (!err && msgs > 0) {
    hist = hist.filter(x => x && now - Date.parse(x.t) < 7 * 864e5); hist.push({ t: checkedAt, r: Object.fromEntries(REGIONS.map(r => [r.id, seen[r.id].size])) });
    const base = {}; REGIONS.forEach(r => { const v = hist.map(h => h.r && h.r[r.id]).filter(v => typeof v === 'number'); base[r.id] = v.length >= 24 ? median(v) : null; });
    res = { ok: true, checkedAt, msgs, regions: REGIONS.map(r => ({ id: r.id, name: r.name, n: seen[r.id].size, usual: base[r.id] })) };
    fs.writeFileSync(HIST + '.tmp', JSON.stringify(hist)); fs.renameSync(HIST + '.tmp', HIST); fs.chmodSync(HIST, 0o644);
  } else res = Object.assign(old || { regions: [] }, { ok: false, checkedAt, error: err || ('no messages received (opened=' + opened + ' raw=' + raw + ' ' + closeInfo + ' first=' + firstRaw + ')') });
  fs.writeFileSync(OUT + '.tmp', JSON.stringify(res)); fs.renameSync(OUT + '.tmp', OUT); fs.chmodSync(OUT, 0o644);
  console.log(checkedAt + ' ships ' + (res.ok ? 'OK msgs=' + msgs + ' ' + res.regions.map(r => r.id + '=' + r.n).join(' ') : 'FAIL ' + res.error));
}
if (require.main === module) main().catch(e => { console.error('ships failed: ' + e); process.exit(1); });
