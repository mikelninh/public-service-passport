import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSyntheticPilotCases, runSyntheticAuthorityPilot } from '../public/pilot-core.js';

test('pilot cohort contains exactly 100 uniquely identified cases', () => {
  const cases = buildSyntheticPilotCases();
  assert.equal(cases.length, 100);
  assert.equal(new Set(cases.map((item) => item.caseId)).size, 100);
  assert.equal(new Set(cases.map((item) => item.correlationId)).size, 100);
  assert.equal(new Set(cases.map((item) => item.transportReceipt)).size, 100);
});

test('controlled cohort contains 40 fast-path and 60 exception-path ground-truth cases', () => {
  const cases = buildSyntheticPilotCases();
  assert.equal(cases.filter((item) => item.pilot.expectedInitialRoute === 'ready_for_decision').length, 40);
  assert.equal(cases.filter((item) => item.pilot.expectedInitialRoute === 'in_review').length, 60);
});

test('pilot routes 100/100 cases and identifies 100/100 expected exception sets', () => {
  const report = runSyntheticAuthorityPilot();
  assert.equal(report.routing.routeAccuracy, 1);
  assert.equal(report.routing.exceptionCodeAccuracy, 1);
  assert.equal(report.routing.initialFastPath, 40);
  assert.equal(report.routing.initialExceptionPath, 60);
  assert.equal(report.routing.resolvedToDecisionReady, 100);
  assert.equal(report.integrity.allCasesRoutedAsExpected, true);
  assert.equal(report.integrity.allExceptionCodesMatchedGroundTruth, true);
});

test('initial proof quality is deterministic and explicitly below 100%', () => {
  const report = runSyntheticAuthorityPilot();
  assert.equal(report.proofQuality.averageInitialSourceVerifiedRatio, 0.87);
});

test('synthetic authority decisions produce 93 approvals and 7 rejections', () => {
  const report = runSyntheticAuthorityPilot();
  assert.equal(report.outcomes.approvals, 93);
  assert.equal(report.outcomes.rejections, 7);
});

test('every synthetic approval settles and reconciles; rejected cases cannot pay', () => {
  const report = runSyntheticAuthorityPilot();
  assert.equal(report.outcomes.settledPayments, 93);
  assert.equal(report.outcomes.reconciledPayments, 93);
  assert.equal(report.outcomes.rejectedPaymentGuards, 7);
  assert.equal(report.integrity.everyApprovalSettled, true);
  assert.equal(report.integrity.everySettlementReconciled, true);
  assert.equal(report.integrity.everyRejectedPaymentAttemptBlocked, true);
});

test('illustrative workload model is labelled and computes 68% touch reduction', () => {
  const report = runSyntheticAuthorityPilot();
  assert.equal(report.workloadModel.assumptions.timeSavingsMeasured, false);
  assert.equal(report.workloadModel.baselineManualTouches, 500);
  assert.equal(report.workloadModel.modeledManualTouches, 160);
  assert.equal(report.workloadModel.avoidedManualTouches, 340);
  assert.equal(report.workloadModel.modeledTouchReduction, 0.68);
});

test('top blockers match the controlled cohort design', () => {
  const report = runSyntheticAuthorityPilot();
  assert.deepEqual(report.topBlockers.slice(0, 4), [
    { code: 'claim_not_source_verified:income', count: 25 },
    { code: 'evidence_missing:ev_income', count: 20 },
    { code: 'claim_not_source_verified:rent', count: 15 },
    { code: 'evidence_conflict:ev_rent', count: 15 }
  ]);
});

test('all 100 cases reach only valid terminal states', () => {
  const report = runSyntheticAuthorityPilot();
  const finals = new Set(report.cases.map((item) => item.finalState));
  assert.deepEqual([...finals].sort(), ['decision_rejected', 'reconciled']);
  assert.equal(report.cases.filter((item) => item.finalState === 'reconciled').length, 93);
  assert.equal(report.cases.filter((item) => item.finalState === 'decision_rejected').length, 7);
});
