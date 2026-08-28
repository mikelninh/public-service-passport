# Public Service Passport v1.0.0-rc.1 — Public Test

## What this release is

RC1 is the first public test where one system can be explored from three connected perspectives:

1. **Citizen** `/` — orientation, evidence planning and OpenProof readiness.
2. **Authority** `/authority.html` — one case, trust tiers, deterministic preflight, exceptions and synthetic decision/payment states.
3. **Pilot** `/pilot.html` — 100 controlled synthetic cases through the same authority preflight core.

## Connected test journey

```text
Citizen golden case or own supported Berlin input
        ↓
orientation result
        ↓
explicit “Diesen Testfall aus Behördensicht ansehen”
        ↓
15-minute local one-time handoff
        ↓
Authority Sandbox reads + immediately deletes handoff
        ↓
all citizen-entered claims remain self_attested
        ↓
preflight routes case to Exception Path
        ↓
no automatic synthetic approval is offered for imported citizen case
        ↓
100-case pilot shows the same preflight logic at cohort level
```

The handoff is a UX/test bridge, **not a government submission channel**.

## Trust invariants

RC1 must never weaken these rules:

- self-attested input is not source-verified;
- opening the Authority Sandbox cannot upgrade a verification tier;
- the citizen handoff cannot attach an authoritative proof receipt;
- the handoff expires after 15 minutes;
- the Authority Sandbox deletes the handoff after one read;
- an imported citizen case starts at 0% source verification;
- a missing official identity remains missing;
- an imported case cannot reach authority decision/payment gates while evidence is missing;
- OpenProof proof-readiness is not entitlement;
- no public citizen case is written to Midnight in RC1.

## What to ask testers

Do not ask testers to send their real household data back as feedback. Ask only:

1. After the citizen page, did you know **what to check next**?
2. Did you understand the difference between **known amount, maximum potential and not calculated**?
3. Did the Authority view make clear **why a self-entered value is not yet verified**?
4. Was it obvious that **no real application was submitted**?
5. Did the three views feel like one system or three separate demos?
6. What wording or step was confusing?

## Release gates

- deterministic + golden + adversarial unit suite green;
- 100-case authority pilot green;
- authority/payment integrity tests green;
- desktop Chromium citizen QA green;
- 390px mobile Chromium citizen QA green;
- browser citizen → authority → pilot journey green;
- no browser runtime errors;
- no horizontal mobile overflow;
- public trust-language guard green;
- Netlify deploy preview green;
- privacy/data-flow page reachable;
- PR mergeable.

## RC1 known limits

- Berlin family-benefits scope only;
- orientation, not a legal entitlement decision;
- no production official/EUDI issuer attached;
- no live citizen Midnight proof request;
- Midnight proof evidence is from the synthetic local OpenProof E2E;
- Authority and payment actions are synthetic only;
- 100-case workload reduction is a model, not measured authority productivity;
- no real government transport, Fachverfahren or payment rail.

## Graduation to v1.0.0

Do not remove `rc.1` merely because the software is green. Graduate after public testers can reliably understand the result and trust boundaries, serious confusion/UX defects are fixed, and the release notes contain the tested scope and remaining limits.
