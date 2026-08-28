# Production QA — Benefit Bridge v0.4

## Current launch gate

- Public Netlify production site: `https://scintillating-hummingbird-0e6349.netlify.app/`
- Standalone public GitHub repository
- MIT license present
- 17 deterministic tests + smoke flow
- 11 read-only WebMCP tools; 0 submit/sign/auth/upload-to-authority tools

## Native WebMCP check in Chrome

1. Open `chrome://flags/#enable-webmcp-testing`.
2. Set **WebMCP testing** to **Enabled** and relaunch Chrome.
3. Open the production site and DevTools Console.
4. Run:

```js
const tools = await document.modelContext.getTools();
console.table(tools.map(({ name, annotations }) => ({ name, readOnly: annotations?.readOnlyHint })));
tools.length;
```

Expected: `11`, with every tool reporting `readOnly: true`.

Expected tool names:

- `calculate_support`
- `check_eligibility`
- `derive_benefit_passport`
- `explain_result`
- `get_passport_status`
- `list_missing_evidence`
- `plan_application`
- `prepare_application_packet`
- `prepare_next_steps`
- `replay_case`
- `validate_application_packet`

## Human demo smoke

1. Load the Berlin demo.
2. Confirm the support map shows €518/month known Kindergeld and up to €594/month KiZ worth checking.
3. Confirm Benefit Passport appears and evidence readiness can be toggled.
4. Confirm Application Studio appears for KiZ / Wohngeld / BuT.
5. Confirm export requires all three human-review confirmations.
6. Export a reviewed packet and confirm `submissionAllowed` is `false`.

## Visual pass

Desktop:
- Hero and 11-tool card readable above fold.
- Public Service Passport roadmap distinguishes Live / Next / Future clearly.
- Benefit cards, Passport, Application Studio and approval gate have no horizontal overflow.

Mobile:
- Header does not overflow.
- Service roadmap collapses to one column.
- Form controls remain finger-sized.
- Application packet columns stack vertically.
- Approval controls remain readable without horizontal scrolling.

## Boundary

A green static/CI check is not a substitute for the native browser check. The release should only claim native WebMCP verification after the `getTools()` check succeeds in a WebMCP-enabled Chrome build.
