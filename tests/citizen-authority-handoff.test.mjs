import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCitizenAuthorityHandoff,
  parseCitizenAuthorityHandoff,
  CITIZEN_AUTHORITY_HANDOFF_TTL_MS
} from '../public/case-handoff.js';
import { createAuthorityCaseFromCitizenHandoff } from '../public/citizen-authority-case.js';
import { runAuthorityPreflight, makeAuthorityDecision, sourceVerifiedRatio } from '../public/authority-core.js';

const NOW = 2_000_000_000_000;
const household = {
  adults: 1,
  singleParent: true,
  children: [{ age: 7 }, { age: 12 }],
  monthlyGrossIncome: 2000,
  warmRent: 1100,
  receivesKindergeld: true,
  city: 'Berlin'
};

test('citizen handoff is short-lived, local-only and entirely self-attested', () => {
  const handoff = createCitizenAuthorityHandoff({ household, policyVersion: 'benefit-bridge-2026-08', handoffId: 'case-1', now: NOW });
  assert.equal(handoff.transport.submittedToAuthority, false);
  assert.equal(handoff.transport.oneTime, true);
  assert.equal(handoff.expiresAt - handoff.createdAt, CITIZEN_AUTHORITY_HANDOFF_TTL_MS);
  assert.equal(handoff.proof.authoritativeReceiptAttached, false);
  assert.ok(handoff.claims.every((item) => item.verificationTier === 'self_attested'));
  assert.ok(!JSON.stringify(handoff).includes('Mara Beispiel'));
});

test('tampering cannot upgrade a citizen handoff to source verified', () => {
  const handoff = createCitizenAuthorityHandoff({ household, now: NOW });
  handoff.claims[1].verificationTier = 'source_verified';
  assert.throws(() => parseCitizenAuthorityHandoff(handoff, { now: NOW + 1 }), /cannot upgrade verification tier/);
});

test('expired handoff fails closed', () => {
  const handoff = createCitizenAuthorityHandoff({ household, now: NOW });
  assert.throws(() => parseCitizenAuthorityHandoff(handoff, { now: NOW + CITIZEN_AUTHORITY_HANDOFF_TTL_MS + 1 }), /expired/);
});

test('same citizen case enters authority workbench at zero source verification', () => {
  const handoff = createCitizenAuthorityHandoff({ household, policyVersion: 'benefit-bridge-2026-08', now: NOW });
  const caseFile = createAuthorityCaseFromCitizenHandoff(handoff, { now: NOW + 1 });
  assert.equal(caseFile.importedCitizenPreview, true);
  assert.equal(caseFile.citizen.name, 'Nicht erfasst');
  assert.equal(sourceVerifiedRatio(caseFile), 0);

  const preflighted = runAuthorityPreflight(caseFile);
  assert.equal(preflighted.state, 'in_review');
  assert.ok(preflighted.preflight.exceptions.some((item) => item.code === 'missing_claim:identity'));
  assert.ok(preflighted.preflight.exceptions.some((item) => item.code === 'claim_not_source_verified:income'));
  assert.ok(preflighted.preflight.exceptions.some((item) => item.code === 'evidence_missing:ev_income'));
  assert.throws(() => makeAuthorityDecision(preflighted, 'approved'), /not ready/);
});
