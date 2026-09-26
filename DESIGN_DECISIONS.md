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

## 2026-09-26 — Review of the expanded "AR verb game" plan

An expanded plan (50 verbs, AR props, contextual scenes) was reviewed against this build. Most of it was already implemented; the deltas:

- **Accepted, modified: drink/eat pick-up.** The cup/onigiri now rests at a pickup spot and attaches to the hand that reaches it, then stays locked to that hand through jitter. Modified so pick-up is an affordance, **not a gate**: a hand reaching the mouth auto-attaches the prop. Rejected the plan's strict grab-then-mouth sequence, because the prop is invisible until hint stage 1, so gating would fail the child who recalled the word fastest. Object identity already disambiguates drink from eat, since recognition is target-conditioned.
- **Accepted: みてみる (watch) button** as the plan's "Tap to watch" fallback. It jumps to the demo stage and counts as needed help.
- **Rejected: a ghost demo before a verb's first appearance.** Showing the motion before the child acts gives the meaning away, which defeats English-first recall. The demo stays a late hint (stage 3) or appears on request.
- **Accepted: eased tolerance at stage 3** (the plan's "enlarge tolerance zones"), as explicit per-verb `EASED_OVERRIDES` rather than a global multiplier, because evidence models differ per recognizer.
- **Accepted: streaks, with no speed bonus.** Needing help silently resets the streak; there are no lives and no negative feedback. The speed bonus was dropped because it rewards the students who least need it and adds a scoring concept for little gain.
- **Kept over the plan: arm-swing walk.** The plan wanted legs AND arms; desk framing hides the legs (see the MVP entry), so knees stay bonus evidence.
- **Kept over the plan: context scenes arrive as hint stage 1, not from t=0.** An underwater scene at t=0 would give SWIM away.
- **Deferred: the other 38 verbs** (including the abstract-verb scenes), until the 12 MVP verbs have passed the real-webcam and Chromebook checks. The plan itself sets this gate.
- **Easing exceptions (cut, eat).** The generic easing rule made both fire on the idle fixture: cut counted two single-frame wrist spikes as strokes, and one brief face touch counted as eating. Eased cut therefore enlarges only the board zone, and eased eat keeps 2 approaches and loosens only distance and hold time. The rule still applies to the other verbs.
