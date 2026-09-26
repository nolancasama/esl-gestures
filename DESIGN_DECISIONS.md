# Design Decisions

This file records meaningful product, UX, visual, architectural, or behavioral decisions for this project.

For each significant decision, record:

- Date
- What was decided or changed
- Why
- Previous approach, if relevant
- Rejected alternatives, if useful

Only record decisions that may be useful to understand later.

Do NOT record:
- trivial UI adjustments
- routine bug fixes
- formatting changes
- mechanical refactors with no design consequence
- every individual code modification

Git is the source of truth for detailed code-change history.

A useful rule:

> If a future developer or AI could reasonably ask, "Why is it designed this way?", record the answer here.

---

## 2026-09-24 — MVP design (full detail in SPEC.md)

- **Upper-body-first recognition.** A desk Chromebook camera sees chest-up; knees are bonus evidence, never required. Walk/run = alternating arm swing, jump = shoulder bounce. Rejected: requiring full-body framing (children won't reliably stand far enough back).
- **Target-conditioned recognition.** Only the current verb's recognizer runs; we never classify which verb was performed. Far more forgiving; walk may accept running, dance accepts nearly anything. Rejected: a multi-class classifier.
- **Kana glosses** (およぐ, not 泳ぐ) — many elementary students can't read the kanji yet.
- **Recognition live from t=0; hints advance only while evidence is low**, so a child mid-gesture isn't interrupted by scaffolding.
- **Teacher override keys** (Enter/P pass, S skip) and a 20 s auto-advance, so recognition failure can never trap a class.
- **One synthetic stick-figure motion source** drives the demo hint, the no-camera choice cards, recognizer tests and `?simulate=1` headless playthroughs. Accepted risk: recognizers tuned to our own synthetic motion; real tuning goes through the debug recorder.
- **Self-hosted MediaPipe WASM + lite model, no CDN** — school networks block CDNs, and the "not uploaded" privacy line must be literally true (playthrough asserts no off-origin requests).
- **"Needed help" = reached the kana-gloss stage or later, skipped, or a wrong first pick** (context scene alone doesn't count; it's a mild hint). Recycled 3–6 items later, max once per verb, max 3 per round.

## 2026-09-24 — Pure core integration details

- **Pose normalization has explicit per-stream state.** The frozen `normalizePose(frame, aspect)` export uses an EMA scale, while `createPoseNormalizer()` provides isolated EMA state for a camera stream, simulation, or test. A backwards timestamp or aspect-ratio change resets that state so an old stream cannot distort a new one.
- **Prop and synthetic catch coordinates are display-space shoulder units.** Mirroring transforms the synthetic reaching arm but leaves the requested catch target in display space. This lets order B pass the same target from catch prop state to `poseAt()` without applying its own mirror conversion.
- **Initial prop-hand ties are deterministic.** Movement ties default to the right hand, except the cutting board prefers the only wrist inside its zone. Once a hand is near the mouth or board it stays locked as specified, avoiding mid-action prop swaps.

## 2026-09-24 — Real-landmark robustness

- **Oscillation uses extreme-tracking hysteresis.** Direction changes count only after a signal retreats a configured distance from its latest extreme, preventing frame-to-frame landmark jitter from manufacturing gesture cycles while retaining forgiving amplitude thresholds.
- **Pose scale has a torso-assisted, decaying floor.** Shoulder width is backed by nose-to-shoulder-mid distance and a slowly decaying recent peak. Side-on shoulder collapse therefore cannot abruptly inflate S-unit motion, while genuine camera-distance changes still settle within roughly two seconds.

## 2026-09-24 — Browser delivery and automated playthrough

- **MediaPipe's runtime is copied during Vite lifecycle hooks.** `predev` and
  `prebuild` mirror the installed package's complete WASM directory into public
  assets, while the pinned lite task model is stored separately in
  `public/models/`. This keeps runtime URLs base-path-relative and same-origin
  without committing package-generated WASM files as authored source.
- **Browser automation consumes semantic UI state.** Playthrough assertions use
  accessible button text for human actions and stable `data-*` values for verbs,
  hint stages, choices, and screen state. The latter are an intentional testing
  boundary: parsing translated visual copy would make recycling and teacher-key
  checks fragile.
- **The playthrough owns a production preview.** It builds, starts a strict-port
  Vite preview, and rejects console/page errors and off-origin requests in every
  scenario. Playwright remains a development-machine tool rather than a project
  dependency; the script first uses a local package and then the prescribed
  `C:/Users/nolan/ui-verify/node_modules` fallback.

## 2026-09-24 — Round viewport fit

- **The round reserves fixed content rows around a flexible 4:3 stage.** The word
  scales with both viewport width and height, while the camera or choice stage
  takes the remaining height and is contained at the camera aspect ratio. This
  keeps the meter, hint, SKIP, and toggles visible without scrolling on supported
  classroom viewport sizes.
