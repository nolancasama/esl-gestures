# esl-gestures — MVP spec

A browser game for Japanese elementary classrooms: an English verb appears, the
child recalls its meaning and acts it out, the webcam (pose landmarks, fully
local) recognises the gesture, and the child gets an immediate, playful reaction.

**Educational loop:** English word → recall meaning → act it out → feedback.
Gesture "quality" is a game reward only. It never decides whether the child knows
the word.

Product priorities, in order: reliability · instantly understandable ·
vocabulary recall · forgiving detection · fun feedback · polish.

Out of scope until tested with real students: abstract verbs, trained
classifiers, multiplayer, accounts, leaderboards, online services, progression,
story, 3D.

---

## 1. Platform and stack

- Chrome on school Chromebooks. Vite + plain ES modules, no framework. Only
  runtime dependency: `@mediapipe/tasks-vision` (Pose Landmarker **lite**, one
  model instance only).
- **All assets are self-hosted and loaded from our own origin**: the WASM files
  (copied from `node_modules/@mediapipe/tasks-vision/wasm` into `public/mediapipe/wasm/`
  by a script, run automatically before `dev`/`build`) and
  `public/models/pose_landmarker_lite.task` (committed). No CDN. School networks
  often block CDNs, and our privacy statement depends on this.
- No network requests other than same-origin static assets. No analytics. No
  server. Webcam frames never leave the page.
- Try the GPU delegate first and fall back to CPU. If the model fails to load,
  go to no-camera mode with a short Japanese notice. The game never dead-ends.
- Camera: `getUserMedia({video:{width:640,height:480,facingMode:'user'}})`, no audio.
  The video is drawn **mirrored**.
- Inference runs `detectForVideo` at most every `TIMING.inferenceIntervalMs`
  (default 55 ms, about 18 Hz), and skips frames whose video time has not changed.
  Rendering uses one `requestAnimationFrame` loop that draws video, props and
  overlays onto one canvas. HUD DOM (word, meter, hint text) is updated only when
  its value changes. The meter uses a CSS transform or a canvas bar, never
  per-frame layout.
- Leaving the game (end screen, back to title, `pagehide`) stops all tracks and
  closes the landmarker.

## 2. Framing reality (change from the original plan)

A Chromebook on a desk sees a child from about the chest up. Most children will
not stand back far enough for their knees to be visible. So **every gesture must
be recognisable from the upper body alone**: nose, shoulders, elbows, wrists.
Hips and knees add evidence when visible but are never required.

- walk/run: alternating arm swing, plus knee lift when knees are visible.
- jump: vertical bounce of the shoulders and nose relative to a rolling baseline.

Setup check: nose + both shoulders + at least one wrist, visibility ≥
`POSE.minVisibility`, for about 0.5 s → "OK!". The guidance asks the child to step
back until both hands fit above their head. It never blocks: START is always
available.

## 3. Coordinates and the frozen core interfaces

The core (`src/core/**`) is pure JS with no DOM, runs under `node --test`, and is
used unchanged by the browser app.

```js
// Raw frame, from the detector or from the synthetic generator.
// x,y are normalised image coords (0..1, y down) ALREADY MIRRORED to display
// space (x' = 1 - x). v = visibility 0..1. 33 MediaPipe landmarks.
PoseFrame = { t /* ms */, landmarks: [{x,y,z,v} x33] | null }

// normalizePose(frame, aspect) -> NormPose
// Origin = shoulder midpoint. Unit = shoulder width (S), smoothed with an EMA so
// one bad frame cannot rescale everything. x right, y down, both in S units,
// with x scaled by aspect so units are isotropic.
NormPose = { t, ok, scale /* S in px-normalised units */, origin:{x,y},
             p: { nose, lShoulder, rShoulder, lElbow, rElbow, lWrist, rWrist,
                  lHip, rHip, lKnee, rKnee, mouth /* mid of 9,10 */ },  // each {x,y,v}
             raw: PoseFrame }

// PoseHistory: ring buffer of NormPose covering HISTORY.windowMs (2500 ms).
// push(np), window(ms) -> NormPose[], latest(), clear(). It also keeps an
// absolute-baseline series (shoulder-mid y in image space) for jump.

// Every recognizer module exports
createRecognizer(config) -> {
  reset(),
  update(history, ctx) -> { detected, evidence /*0..1*/, quality /*0..100*/, debug:{} },
}
// ctx = { t, props }  where props is the verb's prop state (below) or null.
// Once detected is true it stays true until reset().
```

Recognition is **target-conditioned**: only the current verb's recognizer runs.
We never classify "which verb is this". That makes the game far more forgiving:
WALK doesn't have to reject running, and DANCE may accept almost anything.

### Evidence model

Each recognizer turns matching motion into evidence increments with a slow decay:
`evidence = clamp(evidence + gain*match*dt - decay*dt)`. Recognition happens when
`evidence >= 1`. Decay is gentle (default 0.15/s), so pauses don't wipe progress.
The meter shows `evidence`. Quality accumulates alongside: the best or averaged
amplitude, speed and repetition components, mapped so that
**quality at detection is always ≥ 50**. That keeps the rating bands meaningful.

### Rating bands (QUALITY in config)

50–69 GOOD! ★ · 70–89 GREAT! ★★ · 90–100 PERFECT! ★★★. Never show a percentage
(debug excepted). Any detection passes.

## 4. Vocabulary and gestures

Kana glosses, because many elementary students can't read the kanji yet
(泳ぐ is a 3rd-grade kanji).

| verb | gloss | group | rule (S = shoulder widths, all thresholds in `GESTURE_CONFIG`) |
|---|---|---|---|
| jump | ジャンプする | body | shoulder-mid rises ≥ ~0.35 S above its 1 s rolling baseline and returns within ~0.9 s; each bounce is an event. 1 clear bounce or 2 small ones. Arms-up-while-jumping adds quality. |
| run | はしる | body | alternating wrist oscillation (L/R in antiphase, vertical or diagonal) with amplitude ≥ ~0.5 S and frequency ≥ ~1.6 Hz. Slower pumping still fills the meter at half rate, so it never dead-ends. Knee alternation adds when visible. |
| walk | あるく | body | the same alternating swing, amplitude ≥ ~0.3 S, any frequency ≥ ~0.6 Hz. Fast running also passes. |
| dance | おどる | body | sustained motion energy (sum of wrist/elbow/nose/shoulder speed in S/s) above a low threshold, with direction changes, over ~2 s. Extremely forgiving. |
| swim | およぐ | body | repeated broad arm strokes: per wrist, a path excursion ≥ ~1.0 S per cycle, ≥ 2 cycles. Crawl (alternating) and breaststroke (symmetric) both count. |
| fly | そらをとぶ | body | both wrists wide (wrist-to-wrist horizontal ≥ ~2.2 S), near shoulder height (\|dy\| ≤ ~0.8 S), held ~0.6 s cumulative. Flapping the same spread arms also counts. |
| climb | のぼる | body | alternating reach events: a wrist rises above the shoulder line (≤ −0.4 S) and comes back down, alternating hands, ≥ 3 events. Same-hand repeats count at half value. |
| catch | キャッチする | prop | see props. One catch passes. |
| drink | のむ | prop | the prop hand's wrist within ~0.9 S of the mouth, held ~0.5 s cumulative. |
| eat | たべる | prop | the prop hand approaches the mouth (≤ ~0.9 S): 2 approaches, or one held ≥ 0.8 s. |
| cut | きる | prop | a wrist inside the cutting-board zone makes ≥ 3 down-strokes of ≥ ~0.3 S. |
| wash | あらう | body+fx | wrists within ~1.1 S of each other with relative oscillating motion (rubbing), ~1.2 s cumulative. Bubbles are cosmetic. |

`stop` (open palm pushed forward/held) is defined in config as a spare verb and
is not in the default pool.

### Props (pure state in core, drawn by the UI)

Props anchor to the **prop hand**: the wrist that has moved most in the last
0.5 s, re-evaluated only while it is not near the mouth or board. So left-handed
children work automatically.

- **drink:** a cup follows the prop hand and tilts as the hand nears the mouth.
- **eat:** an onigiri follows the prop hand. A "bite" mark appears on each approach.
- **Pick-up (drink, eat; added 2026-09-26).** The cup/onigiri first *rests* at a
  pickup spot beside the body: display-space `(±1.5 S, +0.6 S)` from the shoulder
  midpoint, side chosen at random per item (`PROP_CONFIG.pickup`). It becomes
  **held** when any visible wrist is within `pickupDistance` (~0.8 S) of the spot;
  that wrist becomes the prop hand and is **locked for the rest of the item** (no
  re-selection by travel). It is also held automatically — it glides to the hand
  over ~250 ms — the moment any wrist comes within `mouthDistance` of the mouth,
  so pick-up is an affordance, **never a gate**: a child who mimes drinking before
  the cup is even visible still succeeds. While held, a frame where the locked
  wrist is not visible keeps the prop at its last position and still held (jitter
  never drops it). Rendered position is smoothed (EMA, `PROP_CONFIG.pickup.followAlpha`
  ~0.5) and may trail the wrist; recognition always uses landmarks, never the
  rendered position. The drink/eat recognizers are unchanged apart from reading the
  locked hand from the prop state.
- **cut:** the board and a vegetable sit at a fixed zone, lower-centre of the
  body (0.3–1.6 S below the shoulder line, ±1.3 S horizontally). The knife follows
  the prop hand whenever it is inside the zone. Slices appear per stroke.
- **catch:** a ball launches from a top corner. It is deterministic given its
  launch time and target, and flies about 1.4 s to a target point chosen within
  reach: −1.2 to +0.3 S vertically and ±1.4 S horizontally from the shoulder
  midpoint, never on the torso. It is caught if **any** wrist is within ~0.9 S of
  it during the arrival window (−0.3/+0.4 s). A caught ball sticks to the hand.
  A missed ball fades and a new one launches after 0.6 s. There is no failure
  message.
- **wash:** bubbles spawn between the hands in proportion to rubbing motion.

Context scenes (hint stage 1) are simple canvas-drawn backgrounds and props:
water tint and bubbles (swim), sky and clouds (fly), climbing wall (climb),
track lines (run), path (walk), disco dots (dance), trampoline (jump), sink
(wash). For the prop verbs, the prop itself **is** the context. It fades in at
stage 1 and is invisible before it. Recognition runs from t = 0 either way.

## 5. Round flow

**Title → Camera setup → Round → End.** The title page has two big buttons:
カメラであそぶ and カメラなし.

**Setup:** live mirrored preview, skeleton dots, one line of guidance
(「カメラの まえに たってね」, 「もうすこし うしろに さがってね」,
「りょうてが みえるように してね」). The privacy line is always visible:
「カメラの えいぞうは この たんまつの なかだけで しょりされ、アップロードされません。」
START and カメラなし are shown. If the camera is denied or fails, a notice appears
and the game goes to no-camera mode.

**Item timeline** (all values in `TIMING`, recognition live the whole time):

| t | stage |
|---|---|
| 0 | word only (huge, top). TTS speaks it after 0.4 s (can be toggled off). |
| 2.5 s | stage 1: context scene or prop fades in. |
| 5.5 s | stage 2: kana gloss appears under the word. |
| 9 s | stage 3: the demo stick figure loops in a corner, and SKIP grows prominent. |
| 20 s | auto-advance: 「またあとで！」, counted as skipped. |

A stage advances only if `evidence < 0.35` at that moment. A child who is already
mid-gesture isn't interrupted, and the check is repeated every 0.5 s. The small
SKIP button is always present. A small **みてみる** (watch) button is also always
present from stage 1: it jumps straight to stage 3 (gloss + demo), which counts as
"needed help" like any stage ≥ 2.

**Eased recognition (added 2026-09-26).** On entering stage 3 (by time or by
みてみる) the current recognizer is re-created with its **eased** config:
`GESTURE_CONFIG[verb]` merged with `EASED_OVERRIDES[verb]` from
`src/config/gestures.js`. Overrides are explicit per-verb values, derived by this
rule: distance/zone tolerances ×1.25, minimum amplitudes/spreads/excursions ×0.75,
required counts −1 (minimum 1), hold times ×0.7. Evidence restarts from 0, which
costs little because stage 3 is only reached while evidence < 0.35. Stage 3 also
enlarges the drink/eat pickup radius by the same ×1.25. `idle` must still trigger no
eased recognizer except dance (< 0.5 evidence). **Teacher keys:** `Enter`/`P` = teacher pass
(counts as recognised, no rating shown, recorded as `teacherPass`). `S` = skip.
`Esc` = back to title.

**Success:** word + GOOD/GREAT/PERFECT + stars, a synthesized chime (WebAudio, no
audio files), a star/confetti burst, and TTS repeats the word. After 1.6 s the next
item starts.

**Streak (added 2026-09-26).** A streak counts consecutive items recognised
(camera) or picked right first time (no-camera) *without* needing help (stage ≤ 1,
no skip, no teacher pass). The HUD shows a small flame/star badge `れんぞく N` only
when N ≥ 2 and bumps it on success. Needing help or skipping resets it silently to 0:
no message, no sound, no lost lives. Speed earns nothing. The end screen shows the best
streak of the round.

**Round:** 8 distinct verbs drawn from the 12 by shuffling. Before a round is
built, verbs that needed help in the previous round in this page session are put
first.

**Recycling:** an item is "needed help" if it reached stage 2 or later, was
skipped or auto-advanced, or (no-camera) had a wrong pick first. It is re-inserted
3–6 positions later. If fewer items remain, it goes at the end, and never directly
after itself. Each verb is recycled at most once per round, and at most 3 recycled
items per round (so at most 11 items, about 3 minutes).

**Per-item record:** `{verb, recycled, recognised, teacherPass, skipped,
maxStage, quality, timeMs, watched}` (`watched` = みてみる was tapped).

**End screen:** 「よくできました！」, "N words", the list of verbs with stars, and
"もういちど れんしゅう" listing verbs that needed help, and the best streak
(when ≥ 2). Buttons: もういちど / タイトル.

## 6. No-camera mode

The same session, hint and recycling logic. The screen shows the word, then three
animated stick-figure cards (the target plus 2 random distractors, shuffled),
driven by the same demo animations as the hint. Tap the right one → success
feedback (no quality rating, just GREAT! ★★). Tap a wrong one → it greys out and
shakes gently, a soft tone plays, and the child can pick again. The kana gloss
appears at 6 s.

## 7. Demo animations = test fixtures = simulate mode

`src/core/synth/` defines, per verb, a keyframed **2D stick-figure motion** that
generates full `PoseFrame`s over time (`generateFrames(verb, {durationMs, fps,
scale, offsetX, offsetY, mirror, speed, noise, dropout, seed})`). This one source
drives three things:

1. the demo figure (hint stage 3) and the no-camera choice cards;
2. the recognizer unit tests;
3. **simulate mode** (`?simulate=1`): the detector is replaced by a synthetic
   stream that stands idle for 3 s and then performs the current target verb, so
   a full camera round can be played headlessly by Playwright.

There is also an `idle` motion: standing with sway, breathing, small hand drift
and fidgeting.

Because the recognizers are partly tuned against these synthetic motions,
passing tests alone does not mean they work on real children. Real tuning uses
the debug recorder (§8).

## 8. Debug mode (`?debug=1`)

Overlays the skeleton with per-landmark visibility, and shows FPS (render and
inference), the target verb, hint stage, evidence, raw quality, and the
recognizer's `debug` values live. A panel has sliders for the current verb's
`GESTURE_CONFIG` entry, applied live. "Copy config" puts the JSON on the
clipboard. **Record** saves the last 10 s of raw `PoseFrame`s as a JSON download
(still local). These recordings are how thresholds get tuned against real children.

## 9. Configuration

Every threshold lives in `src/config/`: `gestures.js` (`GESTURE_CONFIG`, one
entry per verb), `timing.js` (`TIMING`, `HISTORY`, `POSE`), `quality.js`
(`QUALITY` bands), and `vocab.js` (verbs, glosses, groups, default pool). There
are no magic numbers in the recognizers.

## 10. Acceptance

**Automated (worker/controller):**
- `npm test`: every verb's synthetic motion is recognised by its own recognizer
  within 6 s, across a variation matrix of 3 seeds × scale {0.6, 1, 1.4} ×
  mirror × speed {0.75, 1.3} × noise and dropout. `idle` for 15 s triggers
  **no** recognizer except `dance`, and dance must stay below 0.5 evidence. There
  are also session and recycling tests.
- `npm run build` is clean.
- `npm run playthrough` (Playwright, `?simulate=1`): a full camera round and a
  full no-camera round, with no console errors. It asserts that **no request
  leaves the origin**, and checks the recycled-word placement. It also runs
  camera-denied → fallback and teacher keys. It captures screenshots of the setup,
  mid-word hint stages, success and end screens.

**Human (owner, not automatable):** real webcam in Chrome, model loads after a
refresh, the 5 body gestures (jump, fly, swim, climb, wash) and 3 prop
interactions (drink, cut, catch) work for 5 different people, and Chromebook
performance is usable (≥ 15 inference FPS in debug).
