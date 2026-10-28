// Decides whether a light data refresh is worth running now, using the free news feeds the PC proxy already collects.
// Prints "run: reason" or "skip: reason". State is kept in /root/smart-state.json (the claude-refresh folder).
const fs = require('fs');
const FEEDS = process.env.FEEDS_URL || 'http://192.168.1.64:8787/feeds';
const STATE = '/root/smart-state.json', LIVE = 'data/live.json';
const MIN_GAP_MIN = Number(process.env.MIN_GAP_MIN) || 60, MAX_AGE_H = Number(process.env.MAX_AGE_H) || 6, MAX_PER_DAY = Number(process.env.MAX_PER_DAY) || 8;
const HIGH = /\b(breaking|killed|dead|death toll|missile|missiles|airstrike|air strike|strikes on|drone attack|explosion|explosions|nuclear|invasion|invade|ceasefire|truce|shot down|sinking|sunk|hostage|coup|assassinat\w*|blackout|cyberattack|cyber attack|ransomware|zero-day|mobiliz\w*|evacuat\w*|martial law)\b/i;
const MED = /\b(attack|attacks|troops|sanctions|tanker|tankers|hormuz|red sea|suez|taiwan|iran|ukraine|russia|israel|gaza|houthi|houthis|hezbollah|china|north korea|breach|outage|vulnerability|exploit|escalat\w*)\b/i;
const score = t => (HIGH.test(t) ? 3 : 0) + (MED.test(t) ? 1 : 0);
(async () => {
  let st = { seen: {}, lastRun: 0, day: '', n: 0 };
  try { st = Object.assign(st, JSON.parse(fs.readFileSync(STATE, 'utf8'))); } catch (e) { /* first run */ }
  const now = Date.now(), today = new Date(now).toISOString().slice(0, 10);
  if (st.day !== today) { st.day = today; st.n = 0; }
  let liveAt = 0; try { liveAt = Date.parse(JSON.parse(fs.readFileSync(LIVE, 'utf8')).meta.updatedAt) || 0; } catch (e) { /* none */ }
  const last = Math.max(st.lastRun || 0, liveAt), ageMin = (now - last) / 60000;
  let items = [];
  try { const r = await fetch(FEEDS, { signal: AbortSignal.timeout(15000) }); items = (await r.json()).items || []; } catch (e) { /* proxy unreachable */ }
  items = items.filter(i => i.kind !== 'video' && i.cat !== 'Video' && i.url && now - (i.ts || 0) < 6 * 3600e3);
  let total = 0, top = 0, fresh = 0, topTitle = '';
  for (const i of items) {
    if (st.seen[i.url]) continue;
    st.seen[i.url] = now; fresh++;
    const sc = score((i.title || '') + ' ' + (i.text || ''));
    total += sc; if (sc > top) { top = sc; topTitle = i.title || ''; }
  }
  Object.keys(st.seen).forEach(u => { if (now - st.seen[u] > 2 * 864e5) delete st.seen[u]; });
  let out;
  if (ageMin > MAX_AGE_H * 60) out = 'run: data is ' + Math.round(ageMin / 60) + ' h old';
  else if (ageMin < MIN_GAP_MIN) out = 'skip: last refresh ' + Math.round(ageMin) + ' min ago';
  else if (st.n >= MAX_PER_DAY) out = 'skip: daily limit of ' + MAX_PER_DAY + ' reached';
  else if (total >= 10 || top >= 4) out = 'run: ' + fresh + ' new headlines, score ' + total + (topTitle ? ', top: ' + topTitle.slice(0, 70) : '');
  else out = 'skip: ' + fresh + ' new headlines, score ' + total;
  if (out.startsWith('run')) { st.lastRun = now; st.n++; }
  fs.writeFileSync(STATE, JSON.stringify(st));
  console.log(out);
})();
