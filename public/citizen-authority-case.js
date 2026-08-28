import { parseCitizenAuthorityHandoff } from './case-handoff.js';

function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function missingEvidence(id, kind) {
  return { id, kind, status: 'missing', source: 'kein autoritativer Nachweis im lokalen Handoff' };
}

export function createAuthorityCaseFromCitizenHandoff(raw, options = {}) {
  const handoff = parseCitizenAuthorityHandoff(raw, options);
  const seed = `${handoff.handoffId}|${handoff.createdAt}|${handoff.policyVersion}`;
  const childCount = handoff.household.children.length;
  const householdLabel = handoff.household.singleParent
    ? `Alleinerziehend · ${childCount} Kind${childCount === 1 ? '' : 'er'}`
    : `Zwei Erwachsene · ${childCount} Kind${childCount === 1 ? '' : 'er'}`;
  const caseId = `ac_local_${hashText(seed)}`;
  const transportReceipt = `tr_local_${hashText(`transport|${seed}`)}`;

  return {
    version: 'authority-workbench/0.2',
    synthetic: true,
    importedCitizenPreview: true,
    caseId,
    correlationId: `corr_local_${hashText(`corr|${seed}`)}`,
    scenarioId: 'citizen_handoff',
    scenarioLabel: 'Bürgerfall · lokaler Test-Handoff',
    scenarioSummary: 'Derselbe Bürgerfall wurde lokal übernommen. Keine Selbstangabe wird dadurch verifiziert.',
    service: { id: 'kiz', label: 'Kinderzuschlag · Precheck', jurisdiction: 'DE-BE' },
    citizen: { name: 'Nicht erfasst', household: householdLabel, city: 'Berlin' },
    monthlyAmount: null,
    authenticationLevel: 'not_collected',
    claims: handoff.claims.map((item) => ({ ...item })),
    evidence: [
      missingEvidence('ev_identity', 'identity'),
      missingEvidence('ev_children', 'register'),
      missingEvidence('ev_income', 'database'),
      missingEvidence('ev_rent', 'document'),
      missingEvidence('ev_kindergeld', 'database')
    ],
    handoff: {
      schema: handoff.schema,
      policyVersion: handoff.policyVersion,
      createdAt: handoff.createdAt,
      expiresAt: handoff.expiresAt,
      proofState: handoff.proof.state,
      submittedToAuthority: false
    },
    state: 'received_by_authority',
    preflight: null,
    decision: { status: 'not_started', receipt: null },
    payment: { status: 'not_started', receipt: null },
    transportReceipt,
    manualTouches: 0,
    events: [{
      seq: 1,
      type: 'transport_preview',
      label: 'Lokaler Test-Handoff geöffnet',
      detail: 'Kein Antrag wurde an eine echte Behörde übermittelt.',
      at: 'T+1'
    }]
  };
}
