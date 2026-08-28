import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

try {
  await page.goto('http://127.0.0.1:8888/', { waitUntil: 'networkidle' });
  await page.click('[data-case="single-parent-main"]');
  await page.waitForSelector('#v1-result:not(.hidden)');
  await page.waitForSelector('#v1-authority-preview');
  await page.click('#v1-authority-preview');
  await page.waitForURL('**/authority.html?source=citizen');
  await page.waitForSelector('#citizen-handoff-banner');

  assert.match(await page.textContent('#citizen-handoff-banner'), /nicht an eine Behörde gesendet/i);
  assert.match(await page.textContent('.citizen-card'), /Alleinerziehend · 2 Kinder/);
  assert.doesNotMatch(await page.textContent('.citizen-card'), /Mara Beispiel/);
  assert.equal((await page.textContent('#verifiedRatio')).trim(), '0%');

  const remainingHandoff = await page.evaluate(() => localStorage.getItem('psp-v1-authority-handoff'));
  assert.equal(remainingHandoff, null, 'one-time handoff must be deleted after authority reads it');

  await page.click('#nextAction');
  assert.equal((await page.textContent('#authorityStatus')).trim(), 'Ausnahme prüfen');
  assert.match(await page.textContent('#exceptions'), /Einkommen ist noch nicht source-verifiziert/i);
  assert.match(await page.textContent('#exceptions'), /Pflichtangabe fehlt: identity/i);
  assert.match(await page.textContent('#actionNote'), /nicht automatisch in source-verifizierte Fakten/i);
  assert.equal(await page.isDisabled('#nextAction'), true);
  assert.doesNotMatch(await page.textContent('body'), /Bewilligung simulieren/);

  await page.goto('http://127.0.0.1:8888/pilot.html', { waitUntil: 'networkidle' });
  assert.match(await page.textContent('body'), /100 kontrollierte Fälle/);
  assert.match(await page.textContent('body'), /Routing korrekt/);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('✓ citizen → authority → 100-case pilot journey');
} finally {
  await browser.close();
}
