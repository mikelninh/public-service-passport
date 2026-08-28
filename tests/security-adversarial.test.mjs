import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { escapeHtml, safeText } from '../public/safe-html.js';
import { evaluateHousehold, normalizeHousehold, MAX_CHILDREN } from '../lib/benefits.mjs';
import { prepareLocalApplicationPacket, validateLocalApplicationPacket } from '../public/packet-core.js';
import evaluateHandler from '../netlify/functions/evaluate.mjs';

const base = { adults: 1, children: [{ age: 7 }], monthlyGrossIncome: 1600, warmRent: 900, receivesKindergeld: true, city: 'Berlin' };
const details = { applicant_name: 'Mara Beispiel', applicant_address: 'Berlin', basic_security_status: 'Nein' };

function malicious() {
  return `<img src=x onerror="globalThis.__xss=1"><script>globalThis.__xss=2</script>\"'><svg onload=alert(1)>`;
}

test('XSS payload is escaped before browser HTML rendering', () => {
  const escaped = escapeHtml(malicious());
  assert.equal(escaped.includes('<img'), false);
  assert.equal(escaped.includes('<script'), false);
  assert.equal(escaped.includes('<svg'), false);
  assert.ok(escaped.includes('&lt;img'));
  assert.ok(escaped.includes('&quot;'));
});

test('safeText bounds local applicant strings without interpreting markup', () => {
  const input = malicious().repeat(50);
  const bounded = safeText(input, 120);
  assert.equal(bounded.length, 120);
  assert.equal(typeof bounded, 'string');
});

test('malicious applicant text remains data and can be safely escaped for display', () => {
  const result = evaluateHousehold(base);
  const packet = prepareLocalApplicationPacket(result, 'kiz', {
    applicationDetails: { ...details, applicant_name: malicious() },
    preparedEvidence: ['income_proof', 'housing_proof']
  });
  const field = packet.fields.find((entry) => entry.id === 'applicant_name');
  assert.equal(field.value, malicious());
  assert.equal(escapeHtml(field.value).includes('<script'), false);
  assert.equal(packet.submissionAllowed, false);
});

test('oversized API body is rejected with 413', async () => {
  const body = JSON.stringify({ household: base, padding: 'x'.repeat(40_000) });
  const response = await evaluateHandler(new Request('https://example.test/api/evaluate', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body
  }));
  assert.equal(response.status, 413);
  const json = await response.json();
  assert.equal(json.ok, false);
});

test('wrong API content type is rejected with 415', async () => {
  const response = await evaluateHandler(new Request('https://example.test/api/evaluate', {
    method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(base)
  }));
  assert.equal(response.status, 415);
});

test('too many children fail closed', () => {
  const result = evaluateHousehold({ ...base, children: Array.from({ length: MAX_CHILDREN + 1 }, (_, index) => ({ age: index % 17 })) });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes(String(MAX_CHILDREN))));
});

test('child ids are bounded and cannot inflate stable-id input indefinitely', () => {
  const household = normalizeHousehold({ ...base, children: [{ id: 'z'.repeat(10_000), age: 7 }] });
  assert.equal(household.children[0].id.length, 64);
});

test('string "true" never upgrades missing Kindergeld evidence into a positive fact', () => {
  const result = evaluateHousehold({ ...base, receivesKindergeld: 'true' });
  assert.equal(result.ok, true);
  assert.equal(result.household.receivesKindergeld, false);
  assert.equal(result.summary.knownMonthly, 0);
  assert.equal(result.summary.potentialAdditionalMax, 0);
});

test('prototype-pollution shaped input cannot modify Object.prototype', () => {
  const raw = JSON.parse('{"adults":1,"children":[{"age":7}],"monthlyGrossIncome":1600,"warmRent":900,"receivesKindergeld":true,"city":"Berlin","__proto__":{"polluted":true}}');
  const result = evaluateHousehold(raw);
  assert.equal(result.ok, true);
  assert.equal({}.polluted, undefined);
});

test('HTML-like city input is rejected instead of echoed into a valid Berlin result', () => {
  const result = evaluateHousehold({ ...base, city: '<img src=x onerror=alert(1)>' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('Berlin')));
});

test('unsupported application service stays explicit and non-consequential', () => {
  const result = evaluateHousehold(base);
  const packet = prepareLocalApplicationPacket(result, 'submit_everything', { applicationDetails: details });
  assert.equal(packet.ok, false);
});

test('human approval can never turn submissionAllowed on', () => {
  const result = evaluateHousehold(base);
  const packet = prepareLocalApplicationPacket(result, 'kiz', { applicationDetails: details, preparedEvidence: ['income_proof', 'housing_proof'] });
  const validation = validateLocalApplicationPacket(packet, { claims_reviewed: true, evidence_status_reviewed: true, not_submission_understood: true });
  assert.equal(validation.canApproveDraftForExport, true);
  assert.equal(validation.submissionAllowed, false);
});

test('CSP blocks inline script/event-handler execution and framing', () => {
  const config = fs.readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');
  assert.ok(config.includes("script-src 'self'"));
  assert.ok(config.includes("object-src 'none'"));
  assert.ok(config.includes("frame-ancestors 'none'"));
  assert.ok(config.includes('X-Frame-Options = "DENY"'));
});

test('browser renderers import escaping helper for user-visible HTML templates', () => {
  const app = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const studio = fs.readFileSync(new URL('../public/v03.js', import.meta.url), 'utf8');
  assert.ok(app.includes("import { escapeHtml } from './safe-html.js'"));
  assert.ok(studio.includes('escapeHtml(value'));
  assert.ok(studio.includes('maxlength="120"'));
});

test('application studio no longer attaches a second household submit fetch', () => {
  const studio = fs.readFileSync(new URL('../public/v03.js', import.meta.url), 'utf8');
  assert.equal(studio.includes("#household-form')?.addEventListener('submit'"), false);
  assert.ok(studio.includes("benefitbridge:result"));
});
