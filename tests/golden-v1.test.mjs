import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateHousehold, normalizeHousehold } from '../lib/benefits.mjs';

function benefit(result, id) {
  return result.benefits.find((item) => item.id === id);
}

const goldenCases = [
  {
    id: 'single-parent-two-children',
    household: { adults: 1, singleParent: true, children: [{ age: 7 }, { age: 12 }], monthlyGrossIncome: 2000, warmRent: 1100, receivesKindergeld: true, city: 'Berlin' },
    assertResult(result) {
      assert.equal(result.ok, true);
      assert.equal(result.summary.knownMonthly, 518);
      assert.equal(result.summary.potentialAdditionalMax, 594);
      assert.equal(benefit(result, 'kiz').status, 'potential');
      assert.equal(benefit(result, 'wohngeld').status, 'check_officially');
      assert.equal(benefit(result, 'but').status, 'conditional_unlock');
    }
  },
  {
    id: 'single-parent-exact-kiz-floor',
    household: { adults: 1, singleParent: true, children: [{ age: 5 }], monthlyGrossIncome: 600, warmRent: 650, receivesKindergeld: true, city: 'Berlin' },
    assertResult(result) {
      assert.equal(result.ok, true);
      assert.equal(benefit(result, 'kiz').status, 'potential');
      assert.equal(result.summary.knownMonthly, 259);
      assert.equal(result.summary.potentialAdditionalMax, 297);
    }
  },
  {
    id: 'couple-below-kiz-floor',
    household: { adults: 2, singleParent: false, children: [{ age: 4 }], monthlyGrossIncome: 899, warmRent: 700, receivesKindergeld: true, city: 'Berlin' },
    assertResult(result) {
      assert.equal(result.ok, true);
      assert.equal(benefit(result, 'kiz').status, 'unlikely_from_demo_inputs');
      assert.equal(result.summary.potentialAdditionalMax, 0);
    }
  },
  {
    id: 'kindergeld-not-confirmed',
    household: { adults: 1, singleParent: true, children: [{ age: 8 }], monthlyGrossIncome: 1800, warmRent: 900, receivesKindergeld: false, city: 'Berlin' },
    assertResult(result) {
      assert.equal(result.ok, true);
      assert.equal(result.summary.knownMonthly, 0);
      assert.equal(benefit(result, 'kindergeld').status, 'check');
      assert.equal(benefit(result, 'kiz').status, 'unlikely_from_demo_inputs');
    }
  },
  {
    id: 'older-child-boundary',
    household: { adults: 1, singleParent: true, children: [{ age: 19 }], monthlyGrossIncome: 1800, warmRent: 900, receivesKindergeld: true, city: 'Berlin' },
    assertResult(result) {
      assert.equal(result.ok, true);
      assert.equal(result.summary.knownMonthly, 0);
      assert.equal(benefit(result, 'kindergeld').status, 'check');
      assert.equal(benefit(result, 'kiz').status, 'potential');
    }
  }
];

for (const golden of goldenCases) {
  test(`golden case: ${golden.id}`, () => golden.assertResult(evaluateHousehold(golden.household)));
}

test('single-parent KiZ boundary is fail-closed below 600 and opens at 600', () => {
  const base = { adults: 1, children: [{ age: 6 }], warmRent: 700, receivesKindergeld: true, city: 'Berlin' };
  assert.equal(benefit(evaluateHousehold({ ...base, monthlyGrossIncome: 599 }), 'kiz').status, 'unlikely_from_demo_inputs');
  assert.equal(benefit(evaluateHousehold({ ...base, monthlyGrossIncome: 600 }), 'kiz').status, 'potential');
});

test('couple KiZ boundary is fail-closed below 900 and opens at 900', () => {
  const base = { adults: 2, children: [{ age: 6 }], warmRent: 700, receivesKindergeld: true, city: 'Berlin' };
  assert.equal(benefit(evaluateHousehold({ ...base, monthlyGrossIncome: 899 }), 'kiz').status, 'unlikely_from_demo_inputs');
  assert.equal(benefit(evaluateHousehold({ ...base, monthlyGrossIncome: 900 }), 'kiz').status, 'potential');
});

test('Kindergeld deterministic anchor stops at age 18 in this deliberately narrow pilot', () => {
  const base = { adults: 1, monthlyGrossIncome: 1800, warmRent: 900, receivesKindergeld: true, city: 'Berlin' };
  assert.equal(evaluateHousehold({ ...base, children: [{ age: 17 }] }).summary.knownMonthly, 259);
  assert.equal(evaluateHousehold({ ...base, children: [{ age: 18 }] }).summary.knownMonthly, 0);
});

test('KiZ child path stops at the implemented under-25 boundary', () => {
  const base = { adults: 1, monthlyGrossIncome: 1800, warmRent: 900, receivesKindergeld: true, city: 'Berlin' };
  assert.equal(benefit(evaluateHousehold({ ...base, children: [{ age: 24 }] }), 'kiz').status, 'potential');
  assert.equal(benefit(evaluateHousehold({ ...base, children: [{ age: 25 }] }), 'kiz').status, 'unlikely_from_demo_inputs');
});

test('unsupported geography rejects instead of silently applying Berlin rules', () => {
  const result = evaluateHousehold({ adults: 1, children: [{ age: 8 }], monthlyGrossIncome: 1800, warmRent: 900, receivesKindergeld: true, city: 'Hamburg' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /Berlin/i.test(error)));
});

test('no children rejects', () => {
  assert.equal(evaluateHousehold({ adults: 1, children: [], city: 'Berlin' }).ok, false);
});

test('impossible child age rejects', () => {
  assert.equal(evaluateHousehold({ adults: 1, children: [{ age: 31 }], city: 'Berlin' }).ok, false);
});

test('out-of-range income and rent reject', () => {
  assert.equal(evaluateHousehold({ adults: 1, children: [{ age: 8 }], monthlyGrossIncome: 100001, city: 'Berlin' }).ok, false);
  assert.equal(evaluateHousehold({ adults: 1, children: [{ age: 8 }], warmRent: 20001, city: 'Berlin' }).ok, false);
});

test('string true cannot become a positive Kindergeld fact', () => {
  const result = evaluateHousehold({ adults: 1, children: [{ age: 8 }], monthlyGrossIncome: 1800, warmRent: 900, receivesKindergeld: 'true', city: 'Berlin' });
  assert.equal(result.household.receivesKindergeld, false);
  assert.equal(result.summary.knownMonthly, 0);
});

test('contradictory household type normalises conservatively', () => {
  const household = normalizeHousehold({ adults: 2, singleParent: true, children: [{ age: 8 }] });
  assert.equal(household.adults, 2);
  assert.equal(household.singleParent, false);
});
