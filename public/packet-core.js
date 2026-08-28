// Browser-local packet preparation core.
// Human UI and WebMCP tools both call these functions so applicant identity never
// needs to leave the browser just to prepare a draft handoff packet.

const SCHEMAS = {
  kiz: {
    label: 'Kinderzuschlag',
    officialUrl: 'https://www.arbeitsagentur.de/familie-und-kinder/downloads-familie-und-kinder/formulare-kinderzuschlag',
    officialComponents: ['Main KiZ application', 'Child annex for each child', 'Applicant / partner annex'],
    evidence: ['child_household', 'income_proof', 'housing_proof'],
    fields: [
      ['applicant_name', 'Applicant name', 'local', true],
      ['applicant_address', 'Applicant address', 'local', true],
      ['applicant_email', 'Contact email', 'local', false],
      ['household_type', 'Household type', 'claim', true],
      ['children', 'Children', 'claim', true],
      ['income', 'Gross household income', 'claim', true],
      ['rent', 'Warm rent', 'claim', true],
      ['kindergeld_status', 'Kindergeld receipt', 'claim', true],
      ['basic_security_status', 'Basic-security receipt', 'local', true]
    ]
  },
  wohngeld: {
    label: 'Wohngeld (Mietzuschuss)',
    officialUrl: 'https://service.berlin.de/dienstleistung/120656/',
    officialComponents: ['Wohngeld Mietzuschuss application', 'Identity documents', 'Income evidence', 'Rental documents', 'Recent rent-payment evidence'],
    evidence: ['child_household', 'identity_documents', 'income_proof', 'housing_proof', 'rent_payment_proof'],
    fields: [
      ['applicant_name', 'Applicant name', 'local', true],
      ['applicant_address', 'Applicant address', 'local', true],
      ['applicant_email', 'Contact email', 'local', false],
      ['household_type', 'Household type', 'claim', true],
      ['children', 'Children', 'claim', true],
      ['income', 'Gross household income', 'claim', true],
      ['rent', 'Warm rent', 'claim', true],
      ['residency_basis', 'Residence / residence-right basis', 'local', true]
    ]
  },
  but: {
    label: 'Bildung & Teilhabe',
    officialUrl: 'https://www.bmas.de/DE/Arbeit/Grundsicherung-fuer-Arbeitsuchende/Bildungspaket/Leistungen-des-Bildungspakets/leistungen-des-bildungspakets.html',
    officialComponents: ['Qualifying benefit award / notice', 'Local BuT service-specific application'],
    evidence: ['child_household', 'benefit_notice'],
    fields: [
      ['applicant_name', 'Parent / guardian name', 'local', true],
      ['children', 'Children', 'claim', true]
    ]
  }
};

function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function stablePacketId(core) {
  return `ap_${hashText(JSON.stringify(core))}`;
}

export function prepareLocalApplicationPacket(result, service, options = {}) {
  const schema = SCHEMAS[service];
  if (!schema) return { ok: false, error: `Unsupported service: ${service}` };
  const prepared = new Set(options.preparedEvidence || []);
  const details = options.applicationDetails || {};
  const claims = new Map(result.passport.claims.map((claim) => [claim.id, claim]));

  const fields = schema.fields.map(([id, label, origin, required]) => {
    const claim = origin === 'claim' ? claims.get(id) : null;
    const localValue = origin === 'local' ? details[id] : null;
    const value = claim?.value ?? (localValue == null || String(localValue).trim() === '' ? null : String(localValue).trim());
    return {
      id, label, required, value,
      provenance: claim
        ? { type: 'self_attested_claim', id: claim.id }
        : value != null ? { type: 'local_human_input', id } : { type: 'missing_human_input', id }
    };
  });

  const evidenceBindings = schema.evidence.map((id) => {
    const evidence = result.passport.evidence.find((item) => item.id === id);
    const claimAvailable = evidence?.status === 'claim_available';
    return {
      id,
      label: evidence?.label || id,
      status: claimAvailable ? 'claim_available' : prepared.has(id) ? 'prepared_by_human' : 'missing',
      provenance: claimAvailable ? 'passport_claim' : prepared.has(id) ? 'human_marked_prepared' : 'none'
    };
  });

  const unresolvedFields = fields.filter((field) => field.required && field.value == null).map((field) => field.id);
  const missingEvidence = evidenceBindings.filter((item) => item.status === 'missing').map((item) => item.id);
  const benefit = result.benefits.find((item) => item.id === service);
  const derivedSignals = benefit ? [{
    id: `${service}_orientation`, label: `${schema.label} orientation`, value: benefit.status,
    amount: benefit.monthlyAmount ?? benefit.annualAnchor ?? null,
    amountKind: benefit.amountKind,
    provenance: { type: 'deterministic_policy', policyVersion: result.policyVersion },
    boundary: 'A derived signal is not an authority award.'
  }] : [];

  const core = {
    packetVersion: '0.3', traceId: result.traceId, passportId: result.passport.passportId,
    service, serviceLabel: schema.label,
    officialDestination: { label: schema.label, url: schema.officialUrl },
    officialComponents: schema.officialComponents,
    fields, evidenceBindings, derivedSignals, unresolvedFields, missingEvidence,
    status: unresolvedFields.length || missingEvidence.length ? 'draft_blocked' : 'ready_for_human_review',
    submissionAllowed: false,
    requiresHumanApproval: true,
    privacy: 'Applicant identity/details were combined browser-locally and were not needed by the Benefit Bridge evaluation API.',
    boundary: 'Prepared packet only. Benefit Bridge does not submit, sign, authenticate to an authority, or assert that this matches every field of the official form.'
  };
  return { ok: true, ...core, packetId: stablePacketId(core) };
}

export function validateLocalApplicationPacket(packet, review = {}) {
  if (!packet?.ok || !packet.packetId) return { ok: false, error: 'Invalid application packet.' };
  const requiredConfirmations = ['claims_reviewed', 'evidence_status_reviewed', 'not_submission_understood'];
  const missingConfirmations = requiredConfirmations.filter((id) => review[id] !== true);
  const blockers = [
    ...packet.unresolvedFields.map((id) => ({ type: 'field', id })),
    ...packet.missingEvidence.map((id) => ({ type: 'evidence', id }))
  ];
  return {
    ok: true,
    packetId: packet.packetId,
    blockers,
    requiredConfirmations,
    missingConfirmations,
    canApproveDraftForExport: missingConfirmations.length === 0,
    readyForOfficialServiceHandoff: blockers.length === 0 && missingConfirmations.length === 0,
    submissionAllowed: false,
    boundary: 'Approval means a human reviewed a local draft for export. It is not consent to submit to an authority.'
  };
}

export function packetSchemas() {
  return SCHEMAS;
}
