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
