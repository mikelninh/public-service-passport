import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateHousehold, normalizeHousehold, planService, SERVICE_REQUIREMENTS } from '../lib/benefits.mjs';

const berlinHousehold = {
  adults: 1,
  children: [{ age: 7 }, { age: 12 }],
  monthlyGrossIncome: 2000,
  warmRent: 1100,
  receivesKindergeld: true
};

test('single parent Berlin example exposes anchors without pretending KiZ is exact', () => {
  const result = evaluateHousehold(berlinHousehold);
  assert.equal(result.ok, true);
  assert.equal(result.summary.knownMonthly, 518);
  assert.equal(result.summary.potentialAdditionalMax, 594);
  assert.equal(result.benefits.find((b) => b.id === 'kiz').amountKind, 'maximum_potential_not_entitlement');
  assert.equal(result.benefits.find((b) => b.id === 'wohngeld').monthlyAmount, null);
});

test('KiZ precheck uses the official minimum-income floor', () => {
  const low = evaluateHousehold({ adults: 1, children: [{ age: 5 }], monthlyGrossIncome: 500, warmRent: 700, receivesKindergeld: true });
  assert.equal(low.benefits.find((b) => b.id === 'kiz').status, 'unlikely_from_demo_inputs');

  const pass = evaluateHousehold({ adults: 1, children: [{ age: 5 }], monthlyGrossIncome: 600, warmRent: 700, receivesKindergeld: true });
  assert.equal(pass.benefits.find((b) => b.id === 'kiz').status, 'potential');
});

test('normalization clamps unsupported values and infers single parent from one adult', () => {
  const h = normalizeHousehold({ adults: 1, monthlyGrossIncome: '2000', children: [{ age: '8' }] });
  assert.equal(h.singleParent, true);
  assert.equal(h.monthlyGrossIncome, 2000);
  assert.equal(h.children[0].age, 8);
});

test('invalid household is rejected deterministically', () => {
  const result = evaluateHousehold({ adults: 1, children: [], monthlyGrossIncome: 1200 });
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});

test('same household yields stable trace and passport ids', () => {
  const a = evaluateHousehold(berlinHousehold);
  const b = evaluateHousehold(berlinHousehold);
  assert.equal(a.traceId, b.traceId);
  assert.equal(a.passport.passportId, b.passport.passportId);
});

test('Benefit Passport separates claims from documentary evidence', () => {
  const result = evaluateHousehold(berlinHousehold);
  assert.equal(result.passport.claims.length, 5);
  assert.equal(result.passport.claims.every((claim) => claim.status === 'self_attested'), true);
  assert.equal(result.passport.evidence.find((e) => e.id === 'income_proof').status, 'not_prepared');
  assert.equal(result.passport.reuseSummary.multiServiceEvidenceCategories >= 2, true);
});

test('downstream Bildung & Teilhabe is conditional, never inferred as current award', () => {
  const result = evaluateHousehold(berlinHousehold);
  const but = result.benefits.find((b) => b.id === 'but');
  assert.equal(but.status, 'conditional_unlock');
  assert.equal(but.annualAnchor, 195);
  assert.equal(but.monthlyAmount, null);
});

test('service planner exposes reusable evidence requirements and human boundary', () => {
  const result = evaluateHousehold(berlinHousehold);
  const kizPlan = planService(result, 'kiz');
  assert.equal(kizPlan.ok, true);
  assert.deepEqual(SERVICE_REQUIREMENTS.kiz, ['child_household', 'income_proof', 'housing_proof']);
  assert.ok(kizPlan.stillNeedsHumanEvidence.includes('income_proof'));
  assert.equal(kizPlan.requiresHumanAction, true);
});

test('unsupported service plans fail explicitly', () => {
  const result = evaluateHousehold(berlinHousehold);
  assert.equal(planService(result, 'magic-money').ok, false);
});
