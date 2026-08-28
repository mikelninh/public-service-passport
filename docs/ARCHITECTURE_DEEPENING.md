# Architecture Deepening — Citizen Case Handoff

## Problem

The citizen-to-authority trust boundary was previously split across two modules:

- one module created/validated the local handoff;
- another independently translated it into an Authority Workbench case.

That made callers understand both the transport envelope and the trust-preserving projection. A future server, QR or credential-backed handoff could easily duplicate or drift on those invariants.

## Deep module

`public/citizen-case-handoff.js` now owns the complete bounded seam:

- household normalization;
- local-only / one-time / 15-minute transport contract;
- self-attested claim construction;
- expiry and tamper validation;
- prohibition on verification-tier upgrades;
- prohibition on attaching an authoritative proof receipt;
- deterministic projection into an Authority Preview case;
- missing authoritative evidence construction;
- zero source-verification starting state.

## Interface

- `createCitizenCaseHandoff(...)`
- `parseCitizenCaseHandoff(...)`
- `toAuthorityPreviewCase(...)`

UI code no longer knows how the handoff is internally validated and converted.

## Before

```text
Citizen UI
   ↓
case-handoff.js
   ↓ caller understands intermediate shape
citizen-authority-case.js
   ↓
Authority Workbench
```

## After

```text
Citizen UI
   ↓
CitizenCaseHandoff interface
   ↓
Authority Workbench
```

## Deletion test

Deleting this module would force citizen UI, authority UI and future adapters to reimplement TTL, trust-state preservation, household validation, missing-evidence semantics and authority-case projection. That is why the deeper module earns its interface.
