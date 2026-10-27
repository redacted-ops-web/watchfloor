// Test: read Google Maps "LIVE" busyness for the Pentagon-area pizza places.
// Run: node busy-test.js   (needs playwright-core and Google Chrome installed)
const { chromium } = require('playwright-core');
const PLACES = [
  'Extreme Pizza 1419 S Fern St Arlington VA',
  'District Pizza Palace Arlington VA',
  'We, The Pizza Crystal City Arlington VA',
  'Papa Johns Pizza Arlington VA 22202',
  'Pizzato Pizza Arlington VA',
  "Domino's Pizza Pentagon Arlington VA"
];
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ locale: 'en-US', viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  for (const q of PLACES) {
    try {
      await page.goto('https://www.google.com/maps/search/' + encodeURIComponent(q) + '?hl=en', { waitUntil: 'domcontentloaded', timeout: 30000 });
      const agree = page.locator('button:has-text("Reject all")');
      if (await agree.count()) { await agree.first().click().catch(() => {}); }
      await page.waitForTimeout(3500);
      if (!(await page.locator('h1').count())) {
        const first = page.locator('a.hfpxzc').first();
        if (await first.count()) { await first.click(); await page.waitForTimeout(3500); }
      }
      const text = await page.evaluate(() => document.body.innerText);
      const name = (await page.locator('h1').first().innerText().catch(() => '?')).trim();
      const live = text.match(/LIVE\s*\n?\s*([^\n]+)/i);
      const usual = text.match(/(Usually[^\n]+|Currently[^\n]+|(?:\d+% )?(?:busier|less busy)[^\n]*)/i);
      const closed = /Closed/.test(text.split('Popular times')[0] || '') ? 'closed?' : '';
      console.log(q + '\n   -> ' + name + ' | live: ' + (live ? live[1] : 'none') + ' | ' + (usual ? usual[1] : '') + ' ' + closed);
    } catch (e) { console.log(q + '\n   -> error: ' + String(e.message).slice(0, 100)); }
  }
  await browser.close();
})();
