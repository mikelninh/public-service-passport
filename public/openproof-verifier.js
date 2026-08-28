export const OPENPROOF_RECEIPT_SCHEMA = 'openproof.midnight.receipt/1';
export const FAMILY_PROOF_TYPE = '1';
export const FAMILY_PURPOSE_CODE = '101';
export const FAMILY_POLICY_VERSION = '1';
export const FAMILY_PROVIDER_ID = '1';

const RECEIPT_FIELDS = [
  'proofType',
  'purposeCode',
  'policyVersion',
  'providerId',
  'bindingHash',
  'auxiliaryBindingHash',
  'verifierChallengeHash'
];

const FORBIDDEN_PRIVATE_KEYS = /^(claims|rawClaims|privateClaims|household|income|monthlyIncomeEur|monthlyGrossIncome|rent|warmRent|iban|address|applicant|applicantName|email|phone|diagnosis|childCount|children|childAge|birthDate)$/i;

function decimal(value, label, errors) {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return value.replace(/^0+(?=\d)/, '');
  errors.push(`${label} must be an unsigned decimal scalar`);
  return null;
}

function nonEmptyString(value, label, errors) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  errors.push(`${label} missing`);
  return null;
}

function inspectLeakage(envelope) {
  const leaks = [];
  const visit = (value, path = '') => {
    if (!value || typeof value !== 'object') return;
    for (const [key, nested] of Object.entries(value)) {
      const next = path ? `${path}.${key}` : key;
      if (FORBIDDEN_PRIVATE_KEYS.test(key)) leaks.push(next);
      if (nested && typeof nested === 'object') visit(nested, next);
    }
  };
  visit(envelope?.receipt, 'receipt');
  visit(envelope?.disclosures, 'disclosures');
  if (envelope?.claims != null) leaks.push('claims');
  if (envelope?.rawClaims != null) leaks.push('rawClaims');
  if (envelope?.privateClaims != null) leaks.push('privateClaims');
  return [...new Set(leaks)];
}

function compareScalar(receipt, expected, field, errors) {
  if (expected?.[field] == null) return;
  const actualValue = decimal(receipt?.[field], `receipt.${field}`, errors);
  const expectedValue = decimal(expected[field], `expected.${field}`, errors);
  if (actualValue != null && expectedValue != null && actualValue !== expectedValue) {
    errors.push(`${field} mismatch`);
  }
}

/**
 * Verify the minimum OpenProof receipt envelope.
 *
 * Critical boundary: a caller-provided object does NOT become authoritative by
 * claiming `source.kind = midnight-indexer`. Only the adapter that actually
 * performed the indexer read may set `trustedIndexerRead: true`.
 */
export function verifyMidnightProofReceipt(envelope, expected = {}, options = {}) {
  const errors = [];
  const warnings = [];
  const receipt = envelope?.receipt;
  const source = envelope?.source;

  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return {
      ok: false,
      matched: false,
      authoritative: false,
      state: 'REJECTED',
      errors: ['receipt envelope must be an object'],
      warnings
    };
  }

  if (envelope.schema !== OPENPROOF_RECEIPT_SCHEMA) errors.push('receipt schema mismatch');
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) errors.push('receipt missing');
  if (!source || typeof source !== 'object' || Array.isArray(source)) errors.push('source metadata missing');

  const nullifier = decimal(envelope.nullifier, 'nullifier', errors);
  for (const field of RECEIPT_FIELDS) decimal(receipt?.[field], `receipt.${field}`, errors);

  const sourceKind = source?.kind;
  const network = nonEmptyString(source?.network, 'source.network', errors);
  const contractAddress = nonEmptyString(source?.contractAddress, 'source.contractAddress', errors);
  const transactionId = nonEmptyString(source?.transactionId, 'source.transactionId', errors);
  const blockHeight = decimal(source?.blockHeight, 'source.blockHeight', errors);

  if (sourceKind !== 'midnight-indexer') errors.push('source.kind must be midnight-indexer');
  if (contractAddress && !/^[0-9a-f]{64}$/i.test(contractAddress)) errors.push('contract address format invalid');
  if (transactionId && !/^[0-9a-f]{66}$/i.test(transactionId)) errors.push('transaction id format invalid');
  if (network && network.length > 80) errors.push('network label too long');

  const leaks = inspectLeakage(envelope);
  if (leaks.length) errors.push(`private-looking fields present: ${leaks.join(', ')}`);
  if (envelope.disclosures && Object.keys(envelope.disclosures).length > 0) {
    errors.push('family receipt must not carry raw disclosures');
  }

  compareScalar(receipt, expected, 'proofType', errors);
  compareScalar(receipt, expected, 'purposeCode', errors);
  compareScalar(receipt, expected, 'policyVersion', errors);
  compareScalar(receipt, expected, 'providerId', errors);
  compareScalar(receipt, expected, 'bindingHash', errors);
  compareScalar(receipt, expected, 'auxiliaryBindingHash', errors);
  compareScalar(receipt, expected, 'verifierChallengeHash', errors);
  if (expected?.nullifier != null) {
    const expectedNullifier = decimal(expected.nullifier, 'expected.nullifier', errors);
    if (nullifier != null && expectedNullifier != null && nullifier !== expectedNullifier) errors.push('nullifier mismatch');
  }

  const matched = errors.length === 0;
  const trustedIndexerRead = options.trustedIndexerRead === true;
  const authoritative = matched && trustedIndexerRead;
  if (matched && !trustedIndexerRead) {
    warnings.push('Receipt fields match, but this verifier did not obtain them through a trusted indexer read.');
  }

  return {
    ok: authoritative,
    matched,
    authoritative,
    state: !matched ? 'REJECTED' : authoritative ? 'VERIFIED_AUTHORITATIVE' : 'MATCHED_UNTRUSTED_SOURCE',
    errors,
    warnings,
    receipt: matched ? {
      proofType: decimal(receipt.proofType, 'receipt.proofType', []),
      purposeCode: decimal(receipt.purposeCode, 'receipt.purposeCode', []),
      policyVersion: decimal(receipt.policyVersion, 'receipt.policyVersion', []),
      providerId: decimal(receipt.providerId, 'receipt.providerId', []),
      bindingHash: decimal(receipt.bindingHash, 'receipt.bindingHash', []),
      auxiliaryBindingHash: decimal(receipt.auxiliaryBindingHash, 'receipt.auxiliaryBindingHash', []),
      verifierChallengeHash: decimal(receipt.verifierChallengeHash, 'receipt.verifierChallengeHash', []),
      nullifier
    } : null,
    source: matched ? { kind: sourceKind, network, contractAddress, transactionId, blockHeight } : null,
    boundary: 'Proof receipt verifies a contract predicate. It is not a benefit entitlement or authority decision.'
  };
}

export function expectedFamilyReceipt({ bindingHash, verifierChallengeHash, nullifier } = {}) {
  return {
    proofType: FAMILY_PROOF_TYPE,
    purposeCode: FAMILY_PURPOSE_CODE,
    policyVersion: FAMILY_POLICY_VERSION,
    providerId: FAMILY_PROVIDER_ID,
    auxiliaryBindingHash: '0',
    ...(bindingHash != null ? { bindingHash } : {}),
    ...(verifierChallengeHash != null ? { verifierChallengeHash } : {}),
    ...(nullifier != null ? { nullifier } : {})
  };
}

/**
 * Citizen-facing readiness only. This never upgrades self-entered values into
 * issuer-attested facts and deliberately returns no raw income/rent/ages.
 */
export function assessFamilyProofReadiness(household = {}) {
  const childCount = Array.isArray(household.children) ? household.children.length : 0;
  const income = Number(household.monthlyGrossIncome);
  const city = String(household.city || '').trim().toLowerCase();
  const validShape = Number.isFinite(income) && income >= 0 && Number.isInteger(childCount);
  const predicates = [
    { id: 'supported_geography', label: 'Unterstützte Region', passed: city === 'berlin', provenance: 'self_attested' },
    { id: 'minimum_children', label: 'Mindestens ein Kind', passed: childCount >= 1, provenance: 'self_attested' },
    { id: 'income_under_demo_ceiling', label: 'Einkommen erfüllt Demo-Schwelle', passed: validShape && income <= 2500, provenance: 'self_attested' },
    { id: 'official_credential', label: 'Offiziell ausgestellter Nachweis verbunden', passed: false, provenance: 'missing_issuer' }
  ];

  const selfAttestedPredicatesPass = predicates.slice(0, 3).every((item) => item.passed);
  const status = !validShape
    ? 'INVALID_INPUT'
    : !selfAttestedPredicatesPass
      ? 'OUTSIDE_DEMO_POLICY'
      : 'NEEDS_OFFICIAL_CREDENTIAL';

  return {
    status,
    canRequestAuthoritativeProofNow: false,
    predicates,
    publicPolicy: {
      purposeCode: FAMILY_PURPOSE_CODE,
      policyVersion: FAMILY_POLICY_VERSION,
      providerId: FAMILY_PROVIDER_ID,
      maximumMonthlyIncomeEur: 2500,
      minimumChildren: 1
    },
    publicProofWouldReveal: [
      'proof type',
      'purpose',
      'policy version',
      'authorised issuer id',
      'request binding',
      'verifier challenge hash',
      'one-time nullifier'
    ],
    privateValuesNotShared: [
      'exact income',
      'rent',
      'child ages',
      'name and address',
      'unrelated household details'
    ],
    nextRequirement: 'Connect an official/EUDI-compatible issuer credential before this citizen case can become an authoritative proof.',
    boundary: 'Current household values are self-attested orientation data, not cryptographically verified facts.'
  };
}

export async function deriveCitizenRequestDigest({ traceId, policyVersion, service = 'family-precheck' } = {}) {
  const safeTrace = typeof traceId === 'string' ? traceId.slice(0, 200) : '';
  const safePolicy = typeof policyVersion === 'string' ? policyVersion.slice(0, 120) : '';
  const safeService = typeof service === 'string' ? service.slice(0, 80) : '';
  const payload = new TextEncoder().encode(`public-service-passport:v1|${safeTrace}|${safePolicy}|${safeService}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', payload);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
