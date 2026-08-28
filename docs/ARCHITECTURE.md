# Benefit Bridge architecture — v0.3

## Principle

**Claims are not evidence. Evidence is not a decision. Preparation is not submission.**

V0.3 adds a fourth boundary: applicant identity/contact can remain browser-local while the stateless benefit engine evaluates only the household snapshot.

## Data flow

```text
                         ┌────────────────────────────┐
Household form/WebMCP ──→│ stateless /api/evaluate    │
                         │ deterministic benefit pack │
                         └─────────────┬──────────────┘
                                       │
                          trace + Benefit Passport
                                       │
                                       ▼
                     ┌─────────────────────────────────┐
local applicant data │ browser-local packet-core.js    │ human-marked evidence
────────────────────→│ prefill + provenance + blockers │←────────────────────
                     └───────────────┬─────────────────┘
                                     │
                              application packet
                                     │
                          explicit human review gate
                                     │
                               local JSON export
                                     │
                              official service ↗
```

Applicant identity is not necessary for the Benefit Bridge evaluation endpoint. This is deliberate data minimisation.

## Trust layers

### 1. Claim
User-supplied structured value, such as monthly income. Status: `self_attested`.

### 2. Evidence
A document category that may support a claim. V0.3 tracks only whether the human marked it prepared; it stores no document bytes.

### 3. Derived signal
A deterministic orientation result from the pinned policy pack.

### 4. Prepared application field
A packet field with explicit provenance:

- `self_attested_claim`
- `local_human_input`
- `missing_human_input`

### 5. Human review manifest
A local record that the person reviewed claims/details, evidence status and the non-submission boundary.

### 6. Authority decision
The real Familienkasse/Wohngeldstelle/municipal decision. Benefit Bridge does not create it.

## Packet state machine

```text
DRAFT_BLOCKED
  │  fill required local fields / mark evidence prepared
  ▼
READY_FOR_HUMAN_REVIEW
  │  three explicit confirmations
  ▼
APPROVED_FOR_LOCAL_EXPORT
  │
  ├── blockers remain → reviewed draft export
  └── no blockers     → official-service handoff ready

SUBMITTED  ← intentionally does not exist
```

`submissionAllowed` is false in both packet preparation and validation outputs.

## Evidence reuse

| Evidence category | KiZ | Wohngeld | BuT |
| --- | :---: | :---: | :---: |
| child / household | ✓ | ✓ | ✓ |
| identity documents |  | ✓ |  |
| income evidence | ✓ | ✓ |  |
| housing evidence | ✓ | ✓ |  |
| recent rent-payment proof |  | ✓ |  |
| KiZ / Wohngeld award notice |  |  | ✓ |

This is a challenge preparation model, not an exhaustive statutory checklist.

## WebMCP contract

Eleven read-only tools are registered with `document.modelContext.registerTool(...)`.

V0.3 adds:

- `prepare_application_packet`
- `validate_application_packet`

The human Application Studio and these tools call the same `public/packet-core.js` functions.

**There is no `submit_application` tool.**

## Storage

- `/api/evaluate`: stateless
- Benefit Passport: localStorage only after explicit click
- applicant identity/contact: current browser/session fields, included only if the human exports
- documents: not uploaded or stored
- export: local JSON Blob generated after review approval

A production implementation would need a real identity/consent/retention/trust model before adding persistent sensitive evidence.

## Evaluation

The deterministic suite covers both correctness and authority boundaries. V0.3 specifically tests that a complete and human-reviewed packet can become ready for official-service handoff while `submissionAllowed` stays false.
