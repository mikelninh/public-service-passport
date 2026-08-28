import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAuthorityCase,
  runAuthorityPreflight,
  resolveSyntheticExceptions,
  makeAuthorityDecision,
  instructPayment,
  sendPayment,
  settlePayment,
  reconcilePayment,
  sourceVerifiedRatio
} from '../public/authority-core.js';

test('clean case reaches decision-ready state without manual exception review', () => {
  let value = createAuthorityCase('clean');
  assert.equal(value.state, 'received_by_authority');
  assert.equal(sourceVerifiedRatio(value), 1);

  value = runAuthorityPreflight(value);
  assert.equal(value.state, 'ready_for_decision');
  assert.equal(value.preflight.exceptions.length, 0);
  assert.equal(value.preflight.automatedChecks, 6);
  assert.equal(value.manualTouches, 0);
});

test('clean case can move end to end to reconciled payment with distinct receipts', () => {
  let value = runAuthorityPreflight(createAuthorityCase('clean'));
  value = makeAuthorityDecision(value, 'approved');
  assert.equal(value.state, 'decision_approved');
  assert.match(value.decision.receipt.id, /^oar_/);

  value = instructPayment(value);
  assert.equal(value.state, 'payment_instructed');
  assert.match(value.payment.receipt, /^payi_/);

  value = sendPayment(value);
  assert.equal(value.state, 'payment_sent');

  value = settlePayment(value);
  assert.equal(value.state, 'paid');
  assert.match(value.payment.receipt, /^pays_/);

  value = reconcilePayment(value);
  assert.equal(value.state, 'reconciled');
  assert.equal(value.payment.status, 'reconciled');
  assert.equal(value.events.at(-1).label, 'Fall finanziell abgeglichen');
});

test('missing income proof blocks decision until exception is resolved', () => {
  let value = runAuthorityPreflight(createAuthorityCase('missing_income'));
  assert.equal(value.state, 'in_review');
  assert.ok(value.preflight.exceptions.some((item) => item.code.includes('income')));
  assert.throws(() => makeAuthorityDecision(value, 'approved'), /not ready/i);

  value = resolveSyntheticExceptions(value);
  assert.equal(value.state, 'ready_for_decision');
  assert.equal(value.preflight.exceptions.length, 0);
  assert.equal(sourceVerifiedRatio(value), 1);
});

test('rent conflict blocks decision and synthetic resolution updates the conflicting value', () => {
  let value = runAuthorityPreflight(createAuthorityCase('rent_conflict'));
  assert.equal(value.state, 'in_review');
  assert.ok(value.preflight.exceptions.some((item) => item.code.startsWith('evidence_conflict')));

  value = resolveSyntheticExceptions(value);
  const rent = value.claims.find((item) => item.id === 'rent');
  assert.equal(rent.value, 950);
  assert.equal(rent.verificationTier, 'source_verified');
  assert.equal(value.state, 'ready_for_decision');
});

test('expired identity proof blocks decision until replaced', () => {
  let value = runAuthorityPreflight(createAuthorityCase('expired_identity'));
  assert.equal(value.state, 'in_review');
  assert.ok(value.preflight.exceptions.some((item) => item.code.startsWith('evidence_expired')));

  value = resolveSyntheticExceptions(value);
  assert.equal(value.state, 'ready_for_decision');
  assert.equal(value.claims.find((item) => item.id === 'identity').verificationTier, 'source_verified');
});

test('payment cannot start before an approved authority decision', () => {
  const received = createAuthorityCase('clean');
  assert.throws(() => instructPayment(received), /approved authority decision/i);

  const ready = runAuthorityPreflight(received);
  assert.throws(() => instructPayment(ready), /approved authority decision/i);
});

test('settlement cannot be claimed before payment was sent', () => {
  let value = runAuthorityPreflight(createAuthorityCase('clean'));
  value = makeAuthorityDecision(value, 'approved');
  value = instructPayment(value);
  assert.throws(() => settlePayment(value), /sent before settlement/i);
});

test('rejected cases never enter payment flow', () => {
  let value = runAuthorityPreflight(createAuthorityCase('clean'));
  value = makeAuthorityDecision(value, 'rejected');
  assert.equal(value.state, 'decision_rejected');
  assert.equal(value.payment.status, 'not_started');
  assert.throws(() => instructPayment(value), /approved authority decision/i);
});
