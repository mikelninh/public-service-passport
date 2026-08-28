# Public Service Passport — Domain Language

This file defines the terms that code, tests, docs and agents should use consistently.

## Core concepts

- **Citizen Case** — a bounded representation of one person's current public-service situation for orientation and preparation. It is not an authority decision.
- **Self-attested fact** — a value entered by the citizen. Useful for orientation; not treated as verified evidence.
- **Evidence** — a document, register result or other source that supports a fact. Evidence quality and source remain explicit.
- **Proof-ready** — the product can describe the minimum predicate that should be proven, but an accepted issuer/credential is not yet connected.
- **Verified proof** — a purpose-bound proof independently verified through the trusted verifier path. It proves a condition, not entitlement.
- **Authority Preview** — a synthetic/local view of how the same Citizen Case would arrive at an authority workflow. It is not submission.
- **Preflight** — deterministic checks that identify completeness, trust gaps, contradictions and routing needs before a human authority decision.
- **Exception Path** — cases with missing, stale, conflicting or insufficiently verified information that require additional evidence or human review.
- **Fast Path** — a case with no initial preflight exception. It is decision-ready, not automatically approved.
- **Authority Decision** — a decision by the legally competent institution or authorised human/system. No citizen UI, agent or proof silently creates it.
- **Receipt** — evidence that a specific state transition occurred. Transport, proof, decision, payment and settlement receipts are distinct.
- **Public Pilot** — a bounded test experience whose claims are narrower than production public infrastructure.

## Trust states

Use these concepts without collapsing them:

`self-attested → evidence-backed → source-verified → authority-verified`

OpenProof may add a cryptographically verified condition, but cryptographic verification does not itself create an Authority Decision.

## Invariants

1. Missing is not zero.
2. Self-attested is not verified.
3. Proof-ready is not verified.
4. Verified proof is not entitlement.
5. Authority Preview is not submission.
6. Decision is not payment.
7. Payment instruction is not settlement.
8. Sensitive data should not cross a seam unless the receiving module genuinely needs it.

## Architecture vocabulary

Use **module**, **interface**, **implementation**, **seam**, **adapter**, **depth**, **leverage** and **locality** when discussing architecture.
