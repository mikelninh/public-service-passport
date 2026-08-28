import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPENPROOF_RECEIPT_SCHEMA,
  assessFamilyProofReadiness,
  deriveCitizenRequestDigest,
  expectedFamilyReceipt,
  verifyMidnightProofReceipt
} from '../public/openproof-verifier.js';

function envelope(overrides = {}) {
  const base = {
    schema: OPENPROOF_RECEIPT_SCHEMA,
    source: {
      kind: 'midnight-indexer',
      network: 'local-ci',
      contractAddress: 'a'.repeat(64),
      transactionId: `00${'b'.repeat(64)}`,
      blockHeight: '16'
    },
    nullifier: '99112233',
    receipt: {
      proofType: '1',
      purposeCode: '101',
      policyVersion: '1',
      providerId: '1',
      bindingHash: '55001',
      auxiliaryBindingHash: '0',
      verifierChallengeHash: '778899'
    },
    disclosures: {}
  };
  return {
    ...base,
    ...overrides,
    source: { ...base.source, ...(overrides.source || {}) },
    receipt: { ...base.receipt, ...(overrides.receipt || {}) }
  };
}

const expected = expectedFamilyReceipt({ bindingHash: '55001', verifierChallengeHash: '778899', nullifier: '99112233' });

test('matching pasted receipt stays untrusted until the verifier owns the indexer read', () => {
  const result = verifyMidnightProofReceipt(envelope(), expected);
  assert.equal(result.matched, true);
  assert.equal(result.ok, false);
  assert.equal(result.authoritative, false);
  assert.equal(result.state, 'MATCHED_UNTRUSTED_SOURCE');
});

test('trusted indexer adapter upgrades the same exact receipt to authoritative', () => {
  const result = verifyMidnightProofReceipt(envelope(), expected, { trustedIndexerRead: true });
  assert.equal(result.ok, true);
  assert.equal(result.authoritative, true);
  assert.equal(result.state, 'VERIFIED_AUTHORITATIVE');
});

test('wrong purpose fails closed', () => {
  const result = verifyMidnightProofReceipt(envelope({ receipt: { purposeCode: '999' } }), expected, { trustedIndexerRead: true });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('purposeCode mismatch'));
});

test('wrong policy version fails closed', () => {
  const result = verifyMidnightProofReceipt(envelope({ receipt: { policyVersion: '2' } }), expected, { trustedIndexerRead: true });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('policyVersion mismatch'));
});

test('wrong issuer fails closed', () => {
  const result = verifyMidnightProofReceipt(envelope({ receipt: { providerId: '7' } }), expected, { trustedIndexerRead: true });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('providerId mismatch'));
});

test('wrong request binding fails closed', () => {
  const result = verifyMidnightProofReceipt(envelope({ receipt: { bindingHash: '55002' } }), expected, { trustedIndexerRead: true });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('bindingHash mismatch'));
});

test('wrong verifier challenge fails closed', () => {
  const result = verifyMidnightProofReceipt(envelope({ receipt: { verifierChallengeHash: '1' } }), expected, { trustedIndexerRead: true });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('verifierChallengeHash mismatch'));
});

test('wrong nullifier fails closed', () => {
  const result = verifyMidnightProofReceipt(envelope({ nullifier: '55' }), expected, { trustedIndexerRead: true });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('nullifier mismatch'));
});

test('missing indexer provenance fails closed', () => {
  const result = verifyMidnightProofReceipt(envelope({ source: { kind: 'browser-json' } }), expected, { trustedIndexerRead: true });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.includes('source.kind')));
});

test('private-looking income fields are rejected from the public receipt', () => {
  const result = verifyMidnightProofReceipt(envelope({ receipt: { monthlyIncomeEur: 2000 } }), expected, { trustedIndexerRead: true });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.includes('private-looking fields')));
});

test('raw disclosures are rejected', () => {
  const result = verifyMidnightProofReceipt(envelope({ disclosures: { rent: 1100 } }), expected, { trustedIndexerRead: true });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.includes('disclosures')));
});

test('proof readiness never upgrades self-attested family values into verified facts', () => {
  const readiness = assessFamilyProofReadiness({
    city: 'Berlin',
    children: [{ age: 7 }, { age: 12 }],
    monthlyGrossIncome: 2000,
    warmRent: 1100
  });
  assert.equal(readiness.status, 'NEEDS_OFFICIAL_CREDENTIAL');
  assert.equal(readiness.canRequestAuthoritativeProofNow, false);
  assert.equal(readiness.predicates.at(-1).passed, false);
  const publicJson = JSON.stringify(readiness);
  assert.equal(publicJson.includes('"monthlyGrossIncome":2000'), false);
  assert.equal(publicJson.includes('"warmRent":1100'), false);
});

test('proof readiness catches a value above the public demo policy ceiling', () => {
  const readiness = assessFamilyProofReadiness({ city: 'Berlin', children: [{ age: 7 }], monthlyGrossIncome: 2501 });
  assert.equal(readiness.status, 'OUTSIDE_DEMO_POLICY');
  assert.equal(readiness.predicates.find((item) => item.id === 'income_under_demo_ceiling').passed, false);
});

test('proof readiness accepts the exact public demo threshold but still requires an issuer', () => {
  const readiness = assessFamilyProofReadiness({ city: 'Berlin', children: [{ age: 7 }], monthlyGrossIncome: 2500 });
  assert.equal(readiness.status, 'NEEDS_OFFICIAL_CREDENTIAL');
  assert.equal(readiness.predicates.find((item) => item.id === 'income_under_demo_ceiling').passed, true);
});

test('citizen request digest is stable and purpose-sensitive', async () => {
  const a = await deriveCitizenRequestDigest({ traceId: 'trace-1', policyVersion: 'v1', service: 'family-precheck' });
  const b = await deriveCitizenRequestDigest({ traceId: 'trace-1', policyVersion: 'v1', service: 'family-precheck' });
  const c = await deriveCitizenRequestDigest({ traceId: 'trace-1', policyVersion: 'v1', service: 'wohngeld' });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{64}$/);
});
