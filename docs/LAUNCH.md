# Benefit Bridge v0.4 — launch checklist

V0.4 is a launch build, not a feature build.

## 1. One-click standalone repo + Netlify deploy

Use Netlify's official Deploy to Netlify flow:

**[Deploy Benefit Bridge to Netlify](https://app.netlify.com/start/deploy?repository=https://github.com/mikelninh/care-abundance-mission&branch=feat/benefit-bridge-webmcp&create_from_path=benefit-bridge-webmcp)**

This flow is intentionally configured with:

- `branch=feat/benefit-bridge-webmcp`
- `create_from_path=benefit-bridge-webmcp`

Netlify will clone only the Benefit Bridge subdirectory into a standalone repository and deploy from that repository root. The copied project already contains `netlify.toml`.

## 2. Production smoke

After deploy, verify:

1. `/` loads without console errors.
2. Load the Berlin demo household.
3. Click **Build my bridge**.
4. Confirm the known Kindergeld anchor is €518/month.
5. Confirm KiZ is shown as **up to €594/month worth checking**, not entitlement.
6. Confirm Wohngeld is routed to an official check rather than an invented amount.
7. Mark income and housing evidence prepared.
8. Open Application Studio and prepare a KiZ packet.
9. Complete the three human-review confirmations.
10. Confirm the validated packet still reports `submissionAllowed: false`.
11. Confirm `/api/evaluate` returns JSON successfully.

## 3. Native WebMCP verification

Chrome's current local testing path:

1. Open `chrome://flags/#enable-webmcp-testing`.
2. Enable WebMCP testing and relaunch Chrome.
3. Open the deployed HTTPS site.
4. Confirm `document.modelContext` is available.
5. Inspect registered tools.
6. Confirm there are **11 read-only Benefit Bridge tools**.
7. Execute `check_eligibility` with the demo household.
8. Execute `prepare_application_packet`.
9. Execute `validate_application_packet` after human review.
10. Confirm there is no submit/sign/authenticate/upload-to-authority tool.

Benefit Bridge uses `document.modelContext.registerTool(...)`; it does not depend on the deprecated `navigator.modelContext` API.

## 4. Challenge recording

Use `docs/DEMO_SCRIPT.md` as the ~75-second recording script.

Capture these proof moments:

- source-grounded benefit orientation
- Benefit Passport claims vs evidence
- evidence reuse
- Application Studio provenance
- explicit human review gate
- WebMCP tool inspector / simulator
- `submissionAllowed: false`
- closing line: **11 read-only tools. 0 submission tools.**

## 5. Release gate

Do not call the submission finished until all are true:

- [ ] GitHub launch checks are green
- [ ] standalone public repository exists
- [ ] public Netlify production URL exists
- [ ] `/api/evaluate` works in production
- [ ] native WebMCP is verified in Chrome
- [ ] 11 tools are discoverable
- [ ] no consequential submission tool is exposed
- [ ] mobile + desktop visual pass completed
- [ ] ~75-second demo recorded
- [ ] README contains production URL + challenge link

**Authority contract:** agents prepare; people authorise; authorities decide.
