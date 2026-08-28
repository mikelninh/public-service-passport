# Authority Pilot 100

Status: controlled synthetic pilot. Not a measured public-sector deployment and not an entitlement study.

## Question

How much of an authority-side benefits workflow can be deterministically preflighted and routed before a human reviewer is asked to act, while preserving human/institutional authority for consequential decisions and preserving payment guards?

## Cohort

Exactly 100 deterministic synthetic cases:

| Profile | Cases |
| --- | ---: |
| All required claims source-verified | 40 |
| Missing income proof | 15 |
| Rent conflict | 10 |
| Expired identity proof | 10 |
| Missing/source-unverified children-household proof | 10 |
| Missing/source-unverified Kindergeld status | 5 |
| Multiple simultaneous exceptions | 5 |
| Income document supplied but not source-verified | 5 |
| **Total** | **100** |

Each case has ground-truth expectations *before* the runner executes:

- expected initial route: `ready_for_decision` or `in_review`;
- exact expected exception codes;
- a deterministic synthetic authority decision used only to exercise approved/rejected downstream state transitions.

## Acceptance targets

The pilot fails if any of these fail:

1. exactly 100 unique case IDs, correlation IDs and transport receipts;
2. 100/100 route decisions match the controlled ground truth;
3. 100/100 exception-code sets match the controlled ground truth;
4. exception cases cannot become decision-ready until the synthetic proof is resolved;
5. payment cannot start after a rejected authority decision;
6. every synthetic approval reaches settlement and reconciliation;
7. every rejection remains outside the payment path.

## Deterministic expected metrics

The cohort was deliberately designed to produce:

- initial Fast Path: **40 cases**;
- initial Exception Path: **60 cases**;
- initial average source-verified claim ratio: **87%**;
- synthetic decisions: **93 approved / 7 rejected**;
- approved cases settled and reconciled: **93**;
- rejected payment attempts that must be blocked: **7**.

These are properties of the controlled test cohort, not estimates of real German benefit-case distributions.

## Most frequent designed exception signals

Expected leading signals:

1. `claim_not_source_verified:income` — 25 cases;
2. `evidence_missing:ev_income` — 20 cases;
3. `claim_not_source_verified:rent` — 15 cases;
4. `evidence_conflict:ev_rent` — 15 cases.

This makes income verification the deliberately largest source of exception work in this test cohort. A real pilot must replace this designed distribution with observed administrative data.

## Illustrative workload model

A separate workload model is included only to make assumptions inspectable.

Configured baseline assumption:

- **5 manual touches per case**: intake/re-keying, completeness review, evidence review, calculation, decision.

Modeled Public Service Passport / OpenAction flow:

- Fast Path: **1 accountable authority-decision touch**;
- Exception Path: **1 exception-resolution touch + 1 authority-decision touch**.

For the 40/60 cohort this produces:

- baseline: **500 manual touches**;
- modeled workflow: **160 manual touches**;
- difference: **340 touches / 68% fewer**.

**This 68% value is not measured authority impact and must never be presented as such.** It is the output of an explicit, configurable workload model. A real authority pilot must measure actual touch events and elapsed time.

## Reproduce

```bash
npm test
npm run pilot
npm run pilot -- --json
```

The live dashboard uses the same runner:

`/pilot.html`

The individual authority sandbox is:

`/authority.html`

## What we need from a real authority partner

The next evidence threshold is anonymised event data, not a larger synthetic cohort. Useful minimal fields:

- case/service category;
- received timestamp;
- completeness/preflight timestamp if available;
- missing-document request timestamps;
- evidence received timestamps;
- review started / decision timestamps;
- number and type of manual touches or status changes;
- reason codes for exceptions/rework;
- decision outcome;
- payment instruction / settlement timestamps where legally and operationally available.

No personal benefit data is needed to measure process waiting and rework if the event export is properly anonymised/aggregated.
