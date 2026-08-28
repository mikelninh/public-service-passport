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
} from './authority-core.js';

export const PILOT_PROFILES = [
  { id: 'clean', label: 'Fast Path · alles source-verifiziert', count: 40 },
  { id: 'missing_income', label: 'Einkommensnachweis fehlt', count: 15 },
  { id: 'rent_conflict', label: 'Mietangabe widerspricht Nachweis', count: 10 },
  { id: 'expired_identity', label: 'Identitäts-Proof abgelaufen', count: 10 },
  { id: 'missing_children_proof', label: 'Haushalt/Kinder nicht source-verifiziert', count: 10 },
  { id: 'missing_kindergeld_proof', label: 'Kindergeldstatus nicht source-verifiziert', count: 5 },
  { id: 'multi_exception', label: 'Mehrere Ausnahmen gleichzeitig', count: 5 },
  { id: 'document_backed_income', label: 'Einkommen dokumentgestützt, aber nicht source-verifiziert', count: 5 }
];

export const PILOT_ASSUMPTIONS = {
  cohort: 'Controlled synthetic cohort; not representative administrative case mix.',
  baselineManualTouchesPerCase: 5,
  baselineDefinition: 'Illustrative workload model: intake/re-keying + completeness + evidence review + calculation + decision.',
  fastPathDefinition: 'One accountable authority decision touch after automated preflight.',
  exceptionPathDefinition: 'One exception-resolution touch plus one accountable authority decision touch.',
  timeSavingsMeasured: false
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function setClaim(caseFile, id, patch) {
  const claim = caseFile.claims.find((item) => item.id === id);
  if (!claim) throw new Error(`Missing pilot claim ${id}`);
  Object.assign(claim, patch);
}

function setEvidence(caseFile, id, patch) {
  const evidence = caseFile.evidence.find((item) => item.id === id);
  if (!evidence) throw new Error(`Missing pilot evidence ${id}`);
  Object.assign(evidence, patch);
}

function expectedCodes(profileId) {
  const map = {
    clean: [],
    missing_income: [
      'claim_not_source_verified:income',
      'evidence_missing:ev_income'
    ],
    rent_conflict: [
      'claim_not_source_verified:rent',
      'evidence_conflict:ev_rent'
    ],
    expired_identity: [
      'claim_not_source_verified:identity',
      'evidence_expired:ev_identity'
    ],
    missing_children_proof: [
      'claim_not_source_verified:children',
      'evidence_missing:ev_children'
    ],
    missing_kindergeld_proof: [
      'claim_not_source_verified:kindergeld_status',
      'evidence_missing:ev_kindergeld'
    ],
    multi_exception: [
      'claim_not_source_verified:income',
      'claim_not_source_verified:rent',
      'evidence_missing:ev_income',
      'evidence_conflict:ev_rent'
    ],
    document_backed_income: [
      'claim_not_source_verified:income'
    ]
  };
  return map[profileId] || [];
}

function applyProfile(base, profileId) {
  const caseFile = clone(base);
  caseFile.scenarioId = profileId;
  caseFile.scenarioLabel = PILOT_PROFILES.find((profile) => profile.id === profileId)?.label || profileId;

  if (profileId === 'missing_children_proof') {
    setClaim(caseFile, 'children', { verificationTier: 'self_attested', source: 'Bürgerangabe' });
    setEvidence(caseFile, 'ev_children', { status: 'missing', note: 'Register-/Haushalts-Proof fehlt.' });
  }

  if (profileId === 'missing_kindergeld_proof') {
    setClaim(caseFile, 'kindergeld_status', { verificationTier: 'self_attested', source: 'Bürgerangabe' });
    setEvidence(caseFile, 'ev_kindergeld', { status: 'missing', note: 'Leistungsstatus noch nicht source-verifiziert.' });
  }

  if (profileId === 'multi_exception') {
    setClaim(caseFile, 'income', { verificationTier: 'self_attested', source: 'Bürgerangabe' });
    setClaim(caseFile, 'rent', { verificationTier: 'document_backed', source: 'Bürgerangabe + Dokument' });
    setEvidence(caseFile, 'ev_income', { status: 'missing', note: 'Einkommens-Proof fehlt.' });
    setEvidence(caseFile, 'ev_rent', { status: 'conflicting', note: 'Antrag: 1.100 € · Nachweis: 950 €' });
  }

  if (profileId === 'document_backed_income') {
    setClaim(caseFile, 'income', { verificationTier: 'document_backed', source: 'synthetischer Gehaltsnachweis' });
    setEvidence(caseFile, 'ev_income', { status: 'supplied', note: 'Dokument vorhanden, Quelle noch nicht verifiziert.' });
  }

  return caseFile;
}

function seedForProfile(profileId) {
  if (['clean', 'missing_income', 'rent_conflict', 'expired_identity'].includes(profileId)) return profileId;
  return 'clean';
}

export function buildSyntheticPilotCases() {
  const cases = [];
  let index = 1;

  for (const profile of PILOT_PROFILES) {
    for (let n = 0; n < profile.count; n += 1) {
      const caseFile = applyProfile(createAuthorityCase(seedForProfile(profile.id)), profile.id);
      const caseSeed = `pilot100|${String(index).padStart(3, '0')}|${profile.id}`;
      caseFile.caseId = `pilot_${String(index).padStart(3, '0')}_${hashText(caseSeed)}`;
      caseFile.correlationId = `corr_${hashText(`corr|${caseSeed}`)}`;
      caseFile.transportReceipt = `tr_${hashText(`transport|${caseSeed}`)}`;
      caseFile.citizen.name = `Synthetischer Fall ${String(index).padStart(3, '0')}`;
      caseFile.events[0].detail = `Transport-Receipt ${caseFile.transportReceipt}`;
      caseFile.pilot = {
        index,
        profileId: profile.id,
        expectedInitialRoute: profile.id === 'clean' ? 'ready_for_decision' : 'in_review',
        expectedExceptionCodes: expectedCodes(profile.id),
        syntheticDecision: index % 13 === 0 ? 'rejected' : 'approved'
      };
      cases.push(caseFile);
      index += 1;
    }
  }

  if (cases.length !== 100) throw new Error(`Pilot cohort must contain exactly 100 cases; got ${cases.length}.`);
  return cases;
}

function sameCodes(actual, expected) {
  return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

function topCounts(counter) {
  return Object.entries(counter)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

export function runSyntheticAuthorityPilot() {
  const cases = buildSyntheticPilotCases();
  const rows = [];
  const blockerCounts = {};
  let correctRoute = 0;
  let correctExceptions = 0;
  let initialFastPath = 0;
  let initialExceptionPath = 0;
  let resolvedToDecisionReady = 0;
  let approvals = 0;
  let rejections = 0;
  let settledPayments = 0;
  let reconciledPayments = 0;
  let rejectedPaymentGuards = 0;
  let totalManualTouches = 0;
  let sourceVerifiedRatioSum = 0;

  for (const original of cases) {
    sourceVerifiedRatioSum += sourceVerifiedRatio(original);
    const preflight = runAuthorityPreflight(original);
    const actualCodes = preflight.preflight.exceptions.map((item) => item.code);
    const expectedCodesForCase = original.pilot.expectedExceptionCodes;
    const routeCorrect = preflight.state === original.pilot.expectedInitialRoute;
    const exceptionsCorrect = sameCodes(actualCodes, expectedCodesForCase);
    if (routeCorrect) correctRoute += 1;
    if (exceptionsCorrect) correctExceptions += 1;

    if (preflight.state === 'ready_for_decision') initialFastPath += 1;
    else initialExceptionPath += 1;
    for (const code of actualCodes) blockerCounts[code] = (blockerCounts[code] || 0) + 1;

    let working = preflight;
    if (working.state === 'in_review') working = resolveSyntheticExceptions(working);
    if (working.state === 'ready_for_decision') resolvedToDecisionReady += 1;

    working = makeAuthorityDecision(working, original.pilot.syntheticDecision);
    if (working.decision.status === 'approved') {
      approvals += 1;
      working = instructPayment(working);
      working = sendPayment(working);
      working = settlePayment(working);
      settledPayments += 1;
      working = reconcilePayment(working);
      reconciledPayments += 1;
    } else {
      rejections += 1;
      try {
        instructPayment(working);
      } catch (error) {
        if (/approved authority decision/.test(error.message)) rejectedPaymentGuards += 1;
        else throw error;
      }
    }

    totalManualTouches += working.manualTouches;
    rows.push({
      caseId: original.caseId,
      profileId: original.pilot.profileId,
      initialRoute: preflight.state,
      expectedInitialRoute: original.pilot.expectedInitialRoute,
      exceptionCodes: actualCodes,
      expectedExceptionCodes: expectedCodesForCase,
      routeCorrect,
      exceptionsCorrect,
      sourceVerifiedRatio: Number(sourceVerifiedRatio(original).toFixed(2)),
      decision: working.decision.status,
      finalState: working.state,
      manualTouches: working.manualTouches
    });
  }

  const baselineManualTouches = cases.length * PILOT_ASSUMPTIONS.baselineManualTouchesPerCase;
  const avoidedTouches = baselineManualTouches - totalManualTouches;

  return {
    version: 'authority-pilot/0.1',
    synthetic: true,
    disclaimer: 'Controlled synthetic pilot. Routing metrics are deterministic test results; workload reduction is an illustrative model, not measured authority impact.',
    cohort: {
      total: cases.length,
      profiles: PILOT_PROFILES.map((profile) => ({ ...profile }))
    },
    routing: {
      initialFastPath,
      initialExceptionPath,
      routeAccuracy: correctRoute / cases.length,
      exceptionCodeAccuracy: correctExceptions / cases.length,
      resolvedToDecisionReady
    },
    proofQuality: {
      averageInitialSourceVerifiedRatio: sourceVerifiedRatioSum / cases.length
    },
    outcomes: {
      approvals,
      rejections,
      settledPayments,
      reconciledPayments,
      rejectedPaymentGuards
    },
    workloadModel: {
      assumptions: clone(PILOT_ASSUMPTIONS),
      baselineManualTouches,
      modeledManualTouches: totalManualTouches,
      avoidedManualTouches: avoidedTouches,
      modeledTouchReduction: avoidedTouches / baselineManualTouches
    },
    topBlockers: topCounts(blockerCounts),
    integrity: {
      allCasesRoutedAsExpected: correctRoute === cases.length,
      allExceptionCodesMatchedGroundTruth: correctExceptions === cases.length,
      allCasesReachedDecision: resolvedToDecisionReady === cases.length,
      everyApprovalSettled: settledPayments === approvals,
      everySettlementReconciled: reconciledPayments === settledPayments,
      everyRejectedPaymentAttemptBlocked: rejectedPaymentGuards === rejections
    },
    cases: rows
  };
}
