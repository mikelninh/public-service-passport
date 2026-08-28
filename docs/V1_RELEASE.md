# Public Service Passport v1.0 — Public Pilot release contract

## Release definition

**v1.0 means the first stable, public, useful and safety-bounded Berlin family-benefits journey — not a production entitlement authority.**

“Stable” refers to the citizen contract and trust semantics, not to nationwide coverage. A citizen should be able to:

1. describe a supported household without creating an account;
2. understand what is known, what is only a preliminary signal, and what must be decided officially;
3. see the evidence likely needed for KiZ, Wohngeld and Bildung & Teilhabe;
4. understand which facts could later be proven privately through OpenProof;
5. see exactly what a privacy proof would reveal and what it would keep private;
6. inspect evidence that the OpenProof/Midnight rail has completed a real local ZK transaction and authoritative indexer receipt check;
7. leave with a concrete next action and an official source rather than a generic chatbot answer.

## Version promise

The **v1.x** line may add more benefits, geographies, issuers, languages and integrations, but it may not silently weaken these guarantees:

- self-attested data stays distinguishable from verified data;
- a matching caller-supplied receipt is not authoritative by itself;
- cryptographic verification requires a trusted verifier-owned indexer read;
- proof remains evidence, never an entitlement or authority decision;
- no automatic authority submission appears behind an existing read-only action;
- missing/unsupported conditions fail closed rather than being guessed.

A breaking change to these trust/authority semantics requires **v2.0**, not a quiet v1.x update.

## Citizen trust states

v1.0 uses three explicit states:

| State | Meaning | May show “verified”? |
|---|---|---:|
| Self-attested | The citizen entered the value. Useful for orientation. | No |
| Proof-ready / nachweisbereit | The required predicate can be described, but an official issuer credential is not connected. | No |
| Cryptographically verified | A trusted verifier independently read the matching receipt from the Midnight indexer. | Yes |

A pasted JSON object never upgrades itself to the third state merely by claiming it came from an indexer.

## v1.0 supported scope

- Berlin only.
- Family-benefit orientation for Kindergeld, Kinderzuschlag, Wohngeld routing and Bildung & Teilhabe downstream signals.
- Deterministic 2026 policy anchors already present in the repository.
- Browser-local optional storage only when a citizen explicitly chooses it.
- No login required.
- No automatic authority submission.
- No legal entitlement claim.
- No raw household or clinical data written to Midnight.

## OpenProof v1 slice

The public UI may use self-attested household values to explain **proof readiness**, but it must not call those values issuer-attested.

The authoritative architecture is:

```text
official / EUDI-compatible issuer credential
        ↓
private witness
        ↓
OpenProof Compact circuit
        ↓
Midnight proof server + transaction
        ↓
Midnight indexer
        ↓
minimum Proof Receipt
        ↓
trusted relying-party verifier
        ↓
CARE / Public Service Passport
```

The current OpenAction CI has already graduated the local-network rung for one synthetic family proof. Public Service Passport displays that as infrastructure evidence, not as proof about the current visitor.

## Golden citizen cases

| Case | Why it matters | Expected v1 behaviour |
|---|---|---|
| Single parent, two children, €2,000 gross, €1,100 warm rent, Kindergeld yes | Main Berlin demo | €518 known anchor; KiZ max signal €594; Wohngeld official check; BuT conditional |
| Single parent at €600 KiZ floor | Exact lower boundary | KiZ pathway opens, still not entitlement |
| Couple at €899 | Negative threshold boundary | KiZ does not open |
| Kindergeld not confirmed | Missing positive evidence | No known Kindergeld amount and no KiZ max |
| Child age 19 | Age-boundary ambiguity | No deterministic under-18 Kindergeld anchor; KiZ may still be worth checking under the implemented path |

## Required edge/adversarial gates

### Benefit engine

- below/at single-parent KiZ threshold;
- below/at couple KiZ threshold;
- age 17/18 Kindergeld anchor boundary;
- age 24/25 KiZ child boundary;
- unsupported city;
- zero children;
- impossible child age;
- out-of-range income/rent;
- string `"true"` cannot become a positive boolean claim;
- contradictory household type normalises conservatively.

### OpenProof receipt verifier

- pasted matching receipt remains untrusted;
- trusted indexer read verifies;
- wrong purpose rejects;
- wrong policy version rejects;
- wrong issuer rejects;
- wrong request binding rejects;
- wrong verifier challenge rejects;
- wrong nullifier rejects;
- missing indexer provenance rejects;
- private-looking fields in the receipt reject;
- raw disclosures reject;
- self-attested proof-readiness output contains no raw income/rent values.

### Real browser release gate

Chromium must exercise the public root at both **1440×900** and **390×844**, including:

- main golden-case click-through;
- expected €518 + €594 headline;
- proof-readiness language without false verification;
- explicit amount semantics;
- privacy list;
- official source/next-step link hosts;
- opt-in local save + deletion;
- no horizontal overflow;
- touch-usable primary CTA;
- zero browser console/page errors.

## Public release gates

A release candidate is v1.0-ready only when all are true:

- [ ] full deterministic test suite green;
- [ ] golden cases green;
- [ ] OpenProof receipt adversarial matrix green;
- [ ] syntax checks green;
- [ ] CSP / frame / nosniff guards green;
- [ ] no consequential WebMCP submission tool exists;
- [ ] desktop + 390 px mobile Chromium gate green;
- [ ] all benefit amounts are explicitly labelled as known anchor / maximum potential / not calculated;
- [ ] every external result/next-step link points to an allowlisted official source;
- [ ] current visitor is never labelled cryptographically verified without issuer + trusted indexer path;
- [ ] “proof ≠ entitlement” is visible in the citizen UI;
- [ ] release version and policy version are visible.

## v1.0 non-goals

- Germany-wide entitlement coverage;
- binding Wohngeld calculation;
- automatic application submission;
- account takeover / authentication as the citizen;
- storing identity documents centrally;
- EUDI production interoperability;
- Midnight Preprod/mainnet deployment;
- authority acceptance of OpenProof receipts;
- audited legal or smart-contract assurance.

## Definition of useful

The release succeeds when a citizen can answer three questions faster and with less disclosure:

1. **What should I check next?**
2. **What evidence do I actually need?**
3. **What could I prove without handing over the whole document?**

That is v1.0.
