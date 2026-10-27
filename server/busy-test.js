// Test 4: launch plain Chrome, attach over CDP. Run: node busy-test.js
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const Q = 'Extreme Pizza 1419 S Fern St Arlington VA';
const CANDIDATES = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'];
(async () => {
  const exe = CANDIDATES.find(p => fs.existsSync(p));
  if (!exe) { console.log('chrome.exe not found'); return; }
  const proc = spawn(exe, ['--remote-debugging-port=9222', '--user-data-dir=C:\\watchfloor\\chrome-profile2', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 4000));
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0] || await ctx.newPage();
  const gl = await page.evaluate(() => { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); });
  console.log('webgl: ' + gl);
  for (let n = 1; n <= 2; n++) {
    await page.goto('https://www.google.com/maps/search/' + encodeURIComponent(Q) + '?hl=en', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    const text = await page.evaluate(() => document.body.innerText);
    const i = text.indexOf('Popular times');
    console.log('visit ' + n + ' | limited view: ' + /limited view/i.test(text) + ' | Popular times: ' + (i >= 0) + ' | LIVE: ' + /LIVE/.test(text));
    if (i >= 0) console.log('  snippet: ' + text.slice(i, i + 120).replace(/\n+/g, ' | '));
  }
  await browser.close().catch(() => {});
  proc.kill();
})().catch(e => console.log('error: ' + e.message));
