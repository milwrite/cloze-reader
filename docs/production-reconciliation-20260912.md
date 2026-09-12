# Source reconciliation for the responsive Worker release

Recovered on September 12, 2026 from the serving `cloze` Worker in Cloudflare account `452c33847cf5cb1e46f391fca32fd1b5`.

- URL: https://cloze.ailab-452.workers.dev
- Release: `cloze-responsive-20260911`
- Serving Worker version: `053cf003-15d1-4472-8f85-1e10b7ef5540`
- Reconciliation base: `4de9bc0`, branch `codex/cuny-game-suite`

The responsive frontend and direct Workers AI implementation were live but absent from this Git branch. Downloaded the serving Worker through Cloudflare's script content API and recovered its maintainable TypeScript source. The restored source compiles **byte for byte** to the downloaded module:

```
SHA-256 616b068eaa795e9defdb6a7a2a21470cf13c910eda877f3b7f04d7da26208398
```

The original module is checked in under `test/fixtures/production-20260911.js`. It contains application code, not credentials. Fifteen differential scenarios compare the recovered TypeScript against this deployed fixture, alongside the three existing work-persistence tests.

Restored frontend files: `index.html`, `src/accountWork.js`, `src/aiService.js`, `src/clozeGameEngine.js`, `src/app.js`, and `src/styles.css`. The other nine served JavaScript modules already matched Git. Reindented the production CSS with PostCSS and verified that its parsed rule tree was unchanged. The restored frontend includes mobile input sizing, login startup, retry handling, blank fields, and hint disclosure behavior.

The serving configuration uses the `AI` binding directly; a gateway API key is not needed. Anonymous play is allowed. CUNY Login is required for saved work. A session/identity outage does not prevent a guest from starting an exercise. Model generation requires nonempty visible text and rejects unsupported streaming.

Validation: TypeScript check, all 18 tests, frontend build, and Wrangler dry run pass. This reconciliation does not require republishing an identical Worker or changing its live release label. It records the exact production source in Git so later changes have a verifiable baseline.

The root README's older Hugging Face/Python deployment sections describe legacy hosting. `wrangler.jsonc` and `worker/` define the current Cloudflare runtime.

## Mobile follow-up

Browser QA after recovery found that the production blank field inherits text smaller than 16px at phone width. A separate follow-up adds a 16px minimum for text inputs, selects, and textareas on narrow screens, while retaining larger inherited text. This CSS-only follow-up is intentionally newer than the recovered frontend. The Worker module still builds to the same bytes. Chromium verifies the computed input size and layout; a physical iPhone keyboard check remains outstanding.
