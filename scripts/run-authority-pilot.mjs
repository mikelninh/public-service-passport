import { runSyntheticAuthorityPilot } from '../public/pilot-core.js';

const report = runSyntheticAuthorityPilot();
const pct = (value) => `${Math.round(value * 100)}%`;

console.log('PUBLIC SERVICE PASSPORT — SYNTHETIC AUTHORITY PILOT 100');
console.log('========================================================');
console.log(`Cases:                     ${report.cohort.total}`);
console.log(`Initial fast path:         ${report.routing.initialFastPath}`);
console.log(`Initial exception path:    ${report.routing.initialExceptionPath}`);
console.log(`Routing accuracy:          ${pct(report.routing.routeAccuracy)}`);
console.log(`Exception-code accuracy:   ${pct(report.routing.exceptionCodeAccuracy)}`);
console.log(`Initial source-verified:   ${pct(report.proofQuality.averageInitialSourceVerifiedRatio)}`);
console.log(`Synthetic approvals:       ${report.outcomes.approvals}`);
console.log(`Synthetic rejections:      ${report.outcomes.rejections}`);
console.log(`Settled + reconciled:      ${report.outcomes.reconciledPayments}`);
console.log(`Rejected payment guards:   ${report.outcomes.rejectedPaymentGuards}`);
console.log('');
console.log('Illustrative workload model — NOT measured authority impact');
console.log(`Baseline manual touches:   ${report.workloadModel.baselineManualTouches}`);
console.log(`Modeled manual touches:    ${report.workloadModel.modeledManualTouches}`);
console.log(`Modeled touch reduction:   ${pct(report.workloadModel.modeledTouchReduction)}`);
console.log('');
console.log('Top blockers');
for (const item of report.topBlockers.slice(0, 10)) console.log(`- ${item.code}: ${item.count}`);
console.log('');
console.log(report.disclaimer);

if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
