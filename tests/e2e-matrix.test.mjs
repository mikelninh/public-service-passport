import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateHousehold, normalizeHousehold } from '../lib/benefits.mjs';
import { prepareLocalApplicationPacket, validateLocalApplicationPacket } from '../public/packet-core.js';
import evaluateHandler from '../netlify/functions/evaluate.mjs';

const review = {
  claims_reviewed: true,
  evidence_status_reviewed: true,
  not_submission_understood: true
};

const details = {
  applicant_name: 'Mara Beispiel',
  applicant_address: 'Sonnenallee 100, 12045 Berlin',
  applicant_email: 'mara@example.invalid',
  basic_security_status: 'No (self-attested)',
  residency_basis: 'German / EU status to be confirmed by applicant'
};

const berlinSingleParent = {
  adults: 1,
  singleParent: true,
  children: [{ age: 7 }, { age: 12 }],
  monthlyGrossIncome: 2000,
  warmRent: 1100,
  receivesKindergeld: true,
  city: 'Berlin'
};

function benefit(result, id) {
  return result.benefits.find((item) => item.id === id);
}

async function jsonResponse(response) {
  return { status: response.status, body: await response.json() };
}

test('E2E Berlin demo: orientation -> passport -> KiZ packet -> human review -> safe handoff', () => {
  const result = evaluateHousehold(berlinSingleParent);
  assert.equal(result.ok, true);
  assert.equal(result.summary.knownMonthly, 518);
  assert.equal(result.summary.potentialAdditionalMax, 594);
  assert.equal(result.passport.claims.length, 5);

  const packet = prepareLocalApplicationPacket(result, 'kiz', {
    applicationDetails: details,
    preparedEvidence: ['income_proof', 'housing_proof']
  });
  assert.equal(packet.status, 'ready_for_human_review');

  const validation = validateLocalApplicationPacket(packet, review);
  assert.equal(validation.readyForOfficialServiceHandoff, true);
  assert.equal(validation.submissionAllowed, false);
});

test('E2E Wohngeld packet requires and accepts all human-prepared evidence', () => {
  const result = evaluateHousehold(berlinSingleParent);
  const blocked = prepareLocalApplicationPacket(result, 'wohngeld', { applicationDetails: details });
  assert.equal(blocked.status, 'draft_blocked');
  assert.ok(blocked.missingEvidence.includes('identity_documents'));
  assert.ok(blocked.missingEvidence.includes('rent_payment_proof'));

  const ready = prepareLocalApplicationPacket(result, 'wohngeld', {
    applicationDetails: details,
    preparedEvidence: ['identity_documents', 'income_proof', 'housing_proof', 'rent_payment_proof']
  });
  assert.equal(ready.status, 'ready_for_human_review');
  assert.equal(validateLocalApplicationPacket(ready, review).readyForOfficialServiceHandoff, true);
  assert.equal(validateLocalApplicationPacket(ready, review).submissionAllowed, false);
});

test('E2E Bildung & Teilhabe remains conditional until benefit notice is prepared', () => {
  const result = evaluateHousehold(berlinSingleParent);
  assert.equal(benefit(result, 'but').status, 'conditional_unlock');

  const blocked = prepareLocalApplicationPacket(result, 'but', { applicationDetails: details });
  assert.ok(blocked.missingEvidence.includes('benefit_notice'));

  const ready = prepareLocalApplicationPacket(result, 'but', {
    applicationDetails: details,
    preparedEvidence: ['benefit_notice']
  });
  const validation = validateLocalApplicationPacket(ready, review);
  assert.equal(validation.readyForOfficialServiceHandoff, true);
  assert.equal(validation.submissionAllowed, false);
});

test('couple below KiZ minimum-income floor does not get a potential KiZ signal', () => {
  const result = evaluateHousehold({
    adults: 2,
    singleParent: false,
    children: [{ age: 4 }],
    monthlyGrossIncome: 899,
    warmRent: 700,
    receivesKindergeld: true,
    city: 'Berlin'
  });
  assert.equal(benefit(result, 'kiz').status, 'unlikely_from_demo_inputs');
});

test('couple exactly at KiZ minimum-income floor gets only a preliminary potential signal', () => {
  const result = evaluateHousehold({
    adults: 2,
    singleParent: false,
    children: [{ age: 4 }],
    monthlyGrossIncome: 900,
    warmRent: 700,
    receivesKindergeld: true,
    city: 'Berlin'
  });
  assert.equal(benefit(result, 'kiz').status, 'potential');
  assert.equal(benefit(result, 'kiz').amountKind, 'maximum_potential_not_entitlement');
});

test('explicitly not receiving Kindergeld never produces known Kindergeld or KiZ max', () => {
  const result = evaluateHousehold({
    adults: 1,
    children: [{ age: 8 }],
    monthlyGrossIncome: 1800,
    warmRent: 900,
    receivesKindergeld: false,
    city: 'Berlin'
  });
  assert.equal(result.summary.knownMonthly, 0);
  assert.equal(benefit(result, 'kindergeld').status, 'check');
  assert.equal(benefit(result, 'kiz').status, 'unlikely_from_demo_inputs');
  assert.equal(result.summary.potentialAdditionalMax, 0);
});

test('SAFETY: omitted Kindergeld status must not silently become a positive claim', () => {
  const result = evaluateHousehold({
    adults: 1,
    children: [{ age: 8 }],
    monthlyGrossIncome: 1800,
    warmRent: 900,
    city: 'Berlin'
  });
  assert.equal(result.household.receivesKindergeld, false);
  assert.equal(result.summary.knownMonthly, 0);
});

test('SAFETY: contradictory adults/singleParent inputs normalize to one consistent household type', () => {
  const household = normalizeHousehold({ adults: 2, singleParent: true, children: [{ age: 8 }] });
  assert.equal(household.adults, 2);
  assert.equal(household.singleParent, false);
});

test('SAFETY: Berlin-only policy pack rejects another city rather than linking to Berlin services', () => {
  const result = evaluateHousehold({
    adults: 1,
    children: [{ age: 8 }],
    monthlyGrossIncome: 1800,
    warmRent: 900,
    receivesKindergeld: true,
    city: 'Hamburg'
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /Berlin/i.test(error)));
});

test('older child never creates a fake deterministic under-18 Kindergeld amount', () => {
  const result = evaluateHousehold({
    adults: 1,
    children: [{ age: 19 }],
    monthlyGrossIncome: 1800,
    warmRent: 900,
    receivesKindergeld: true,
    city: 'Berlin'
  });
  assert.equal(result.summary.knownMonthly, 0);
  assert.equal(benefit(result, 'kindergeld').monthlyAmount, 0);
  assert.equal(benefit(result, 'kindergeld').status, 'check');
});

test('unsupported family demo inputs fail deterministically instead of guessing', () => {
  assert.equal(evaluateHousehold({ adults: 1, children: [], city: 'Berlin' }).ok, false);
  assert.equal(evaluateHousehold({ adults: 1, children: [{ age: 31 }], city: 'Berlin' }).ok, false);
  assert.equal(evaluateHousehold({ adults: 1, children: [{ age: 8 }], monthlyGrossIncome: 100001, city: 'Berlin' }).ok, false);
  assert.equal(evaluateHousehold({ adults: 1, children: [{ age: 8 }], warmRent: 20001, city: 'Berlin' }).ok, false);
});

test('incomplete packet may be reviewed for export but can never masquerade as handoff-ready', () => {
  const result = evaluateHousehold(berlinSingleParent);
  const packet = prepareLocalApplicationPacket(result, 'kiz', { applicationDetails: details });
  const validation = validateLocalApplicationPacket(packet, review);
  assert.equal(validation.canApproveDraftForExport, true);
  assert.equal(validation.readyForOfficialServiceHandoff, false);
  assert.equal(validation.submissionAllowed, false);
});

test('Netlify function rejects GET', async () => {
  const response = await evaluateHandler(new Request('https://example.test/api/evaluate', { method: 'GET' }));
  const { status, body } = await jsonResponse(response);
  assert.equal(status, 405);
  assert.equal(body.ok, false);
});

test('Netlify function rejects invalid JSON', async () => {
  const response = await evaluateHandler(new Request('https://example.test/api/evaluate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not-json'
  }));
  const { status, body } = await jsonResponse(response);
  assert.equal(status, 400);
  assert.equal(body.error, 'Invalid JSON body');
});

test('Netlify function returns same stable trace for wrapped and raw household bodies', async () => {
  const wrapped = await evaluateHandler(new Request('https://example.test/api/evaluate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ household: berlinSingleParent })
  }));
  const raw = await evaluateHandler(new Request('https://example.test/api/evaluate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(berlinSingleParent)
  }));
  const a = await wrapped.json();
  const b = await raw.json();
  assert.equal(wrapped.status, 200);
  assert.equal(raw.status, 200);
  assert.equal(a.traceId, b.traceId);
  assert.equal(a.passport.passportId, b.passport.passportId);
});
