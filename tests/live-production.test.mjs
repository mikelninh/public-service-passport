import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'https://public-service-passport.netlify.app';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function postJson(body) {
  const response = await fetch(`${BASE}/api/evaluate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { response, body: await response.json() };
}

async function probe() {
  const home = await fetch(`${BASE}/`, { redirect: 'follow' });
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /Tell public services once/i);
  assert.match(html, /11 TOOLS · 0 SUBMIT/i);

  const demo = await postJson({ household: {
    adults: 1,
    singleParent: true,
    children: [{ age: 7 }, { age: 12 }],
    monthlyGrossIncome: 2000,
    warmRent: 1100,
    receivesKindergeld: true,
    city: 'Berlin'
  }});
  assert.equal(demo.response.status, 200);
  assert.equal(demo.body.ok, true);
  assert.equal(demo.body.summary.knownMonthly, 518);
  assert.equal(demo.body.summary.potentialAdditionalMax, 594);
  assert.equal(demo.body.benefits.find((item) => item.id === 'wohngeld').monthlyAmount, null);

  const omittedKindergeld = await postJson({ household: {
    adults: 1,
    children: [{ age: 8 }],
    monthlyGrossIncome: 1800,
    warmRent: 900,
    city: 'Berlin'
  }});
  assert.equal(omittedKindergeld.response.status, 200);
  assert.equal(omittedKindergeld.body.household.receivesKindergeld, false);
  assert.equal(omittedKindergeld.body.summary.knownMonthly, 0);

  const contradictory = await postJson({ household: {
    adults: 2,
    singleParent: true,
    children: [{ age: 8 }],
    monthlyGrossIncome: 899,
    warmRent: 700,
    receivesKindergeld: true,
    city: 'Berlin'
  }});
  assert.equal(contradictory.response.status, 200);
  assert.equal(contradictory.body.household.singleParent, false);
  assert.equal(contradictory.body.benefits.find((item) => item.id === 'kiz').status, 'unlikely_from_demo_inputs');

  const hamburg = await postJson({ household: {
    adults: 1,
    children: [{ age: 8 }],
    monthlyGrossIncome: 1800,
    warmRent: 900,
    receivesKindergeld: true,
    city: 'Hamburg'
  }});
  assert.equal(hamburg.response.status, 400);
  assert.equal(hamburg.body.ok, false);
  assert.ok(hamburg.body.errors.some((error) => /Berlin/i.test(error)));

  const getApi = await fetch(`${BASE}/api/evaluate`, { method: 'GET' });
  assert.equal(getApi.status, 405);
  const getBody = await getApi.json();
  assert.equal(getBody.error, 'POST required');

  const invalidJson = await fetch(`${BASE}/api/evaluate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not-json'
  });
  assert.equal(invalidJson.status, 400);
  const invalidBody = await invalidJson.json();
  assert.equal(invalidBody.error, 'Invalid JSON body');
}

test('LIVE: deployed Netlify production matches hardened end-to-end contract', { timeout: 150000 }, async () => {
  let lastError;
  for (let attempt = 1; attempt <= 24; attempt += 1) {
    try {
      await probe();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 24) await sleep(5000);
    }
  }
  throw lastError;
});
