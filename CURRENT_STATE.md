# Current State

## What exists

- Pure gesture recognition, pose normalization/history, prop state, full-pool round sessions,
  hint timing, configuration, and synthetic pose generation in `src/core/` and
  `src/config/`.
- A plain-module Vite browser app with camera and simulated detectors, canvas
  presentation, HUD/screens, no-camera choices, audio/TTS, teacher controls, and
  local debug tooling.
- Drink/eat props support deterministic resting pickup spots, locked-hand pickup
  and mouth auto-attach; the round HUD includes the みてみる stage-3 shortcut,
  eased stage-3 recognition, and current/best clean-success streaks.
- Self-hosted MediaPipe support. `predev` and `prebuild` copy the package WASM
  runtime to `public/mediapipe/wasm/`. The lite pose model is present at
  `public/models/pose_landmarker_lite.task` (5,777,746 bytes), with verified
  SHA-256 `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`.
- `scripts/playthrough.mjs` covers a simulated camera round, a no-camera round,
  camera-denial fallback, teacher keys, one-pass round checks, browser errors, and the
  same-origin-only runtime rule. Representative frames are written to `shots/`.

## How to run

```text
npm run dev
npm test
npm run build
npm run playthrough
```

Use `?simulate=1` to run without a webcam, `?simulate=1&simulateFail=swim` to
hold that verb idle for end-screen help-list checks,
`?simulate=1&verbs=drink,eat,...` to force a simulated round order,
`?seed=x` for a reproducible shuffle (rounds are otherwise randomly shuffled), and
`?debug=1` for live pose and recognizer diagnostics.

`npm run playthrough` uses a project-local Playwright when available, otherwise
the installation at `C:/Users/nolan/ui-verify/node_modules`. It builds and starts
its own Vite preview on `127.0.0.1:4173` by default; set `PLAYTHROUGH_PORT` if that
port is occupied.

## Known issues / remaining acceptance

- Recognition thresholds and Chromebook performance still require the human
  checks in SPEC.md with real children, varied framing, and a real webcam.
- Browser speech voices differ by ChromeOS image; speech is optional and the app
  continues when `speechSynthesis` or a suitable voice is unavailable.
- Playwright is intentionally not added as a project dependency; the prescribed
  external installation must remain available unless one is added locally.

## Next Steps

1. Owner: real-webcam check in Chrome (`npm run dev`, then `?debug=1`) for jump, fly, swim, climb, wash, drink, cut and catch, with a few different people and desk-distance framing.
2. Tune thresholds from real motion: in debug mode, **Record** the frames of a gesture that failed or false-fired, then adjust `src/config/gestures.js`. The synthetic tests prove only that recognizers match our own stick-figure motions.
3. Chromebook performance: check that inference FPS in debug stays ≥ 15.
