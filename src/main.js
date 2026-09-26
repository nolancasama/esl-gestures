import './styles.css';
import { TIMING, POSE } from './config/timing.js';
import { EASED_OVERRIDES, PROP_CONFIG } from './config/gestures.js';
import { QUALITY } from './config/quality.js';
import { DEFAULT_POOL, VOCAB_BY_VERB } from './config/vocab.js';
import { getRecognizer } from './core/gestures/index.js';
import { createPoseNormalizer } from './core/pose/normalize.js';
import { PoseHistory } from './core/pose/history.js';
import {
  createCatchBallState,
  createCupState,
  createCuttingBoardState,
  createOnigiriState,
  createWashBubblesState
} from './core/props/index.js';
import { createHintManager } from './core/session/hints.js';
import { createSession } from './core/session/session.js';
import { createDetector } from './app/pose/index.js';
import { createCanvasRenderer, renderDemo, renderSetup } from './app/render/index.js';
import { GameAudio } from './app/audio.js';
import { DebugPanel, mutableGestureConfig } from './app/debug.js';

const params = new URLSearchParams(location.search);
const simulate = params.get('simulate') === '1';
const simulateFail = params.get('simulateFail');
const debugEnabled = params.get('debug') === '1';
const forcedVerbs = simulate
  ? [...new Set((params.get('verbs') || '')
    .split(',')
    .map((verb) => verb.trim().toLowerCase())
    .filter((verb) => DEFAULT_POOL.includes(verb)))]
  : [];
const CATCH_TARGET = Object.freeze({ x: 1.05, y: -0.55 });

const $ = (selector) => document.querySelector(selector);
const screens = {
  title: $('[data-testid="title-screen"]'),
  setup: $('[data-testid="setup-screen"]'),
  round: $('[data-testid="round-screen"]'),
  end: $('[data-testid="end-screen"]')
};
const ui = {
  setupCanvas: $('#setup-canvas'), setupGuidance: $('#setup-guidance'), setupStatus: $('#setup-status'),
  setupNotice: $('[data-testid="setup-notice"]'), gameCanvas: $('#game-canvas'), cameraStage: $('#camera-stage'),
  choiceStage: $('#choice-stage'), word: $('#word'), gloss: $('#gloss'), count: $('#round-count'),
  meter: $('#meter-fill'), hint: $('#hint-status'), watch: $('#watch-button'), skip: $('#skip-button'), success: $('#success'),
  ratingLabel: $('#rating-label'), ratingStars: $('#rating-stars'), cameraToggle: $('#camera-toggle'),
  soundToggle: $('#sound-toggle'), streak: $('#streak-badge'), endCount: $('#end-count'), endStreak: $('#end-streak'), endResults: $('#end-results'),
  practice: $('#practice-again')
};

const video = document.createElement('video');
video.muted = true;
video.playsInline = true;
const renderer = createCanvasRenderer(ui.gameCanvas);
const audio = new GameAudio();
const normalizer = createPoseNormalizer();
const history = new PoseHistory();
const debugPanel = new DebugPanel({
  panel: $('#debug-panel'), values: $('#debug-values'), sliders: $('#debug-sliders'),
  copyButton: $('#copy-config'), recordButton: $('#record-poses')
});

let screen = 'title';
let mode = null;
let detector = null;
let session = null;
let roundNumber = 0;
let item = null;
let itemStartedAt = 0;
let hintManager = null;
let recognizer = null;
let gestureConfig = null;
let propController = null;
let propState = null;
let latestFrame = null;
let latestNormPose = null;
let recognition = { detected: false, evidence: 0, quality: 0, debug: {} };
let maxStage = 0;
let wrongFirst = false;
let watched = false;
let completing = false;
let ttsTimer = null;
let nextTimer = null;
let cameraVisible = true;
let inferenceFps = 0;
let inferenceDelegate = null;
let lastCameraTrackStates = [];
let renderFps = 0;
let lastRenderAt = performance.now();
let setupOkaySince = null;
let setupReady = false;
let currentNotice = '';
let renderRunning = false;
let renderHandle = null;

function setScreen(name) {
  screen = name;
  document.body.dataset.screen = name;
  for (const [key, element] of Object.entries(screens)) element.hidden = key !== name;
}

function makePropController(verb, t) {
  const seed = `${params.get('seed') || 'classroom'}:${session?.index ?? 0}:${verb}`;
  if (verb === 'drink') return createCupState({ seed, gesture: gestureConfig });
  if (verb === 'eat') return createOnigiriState({ seed, gesture: gestureConfig });
  if (verb === 'cut') return createCuttingBoardState();
  if (verb === 'catch') return createCatchBallState({ seed: 4, target: CATCH_TARGET, launchTime: t });
  if (verb === 'wash') return createWashBubblesState();
  return null;
}

function processPoseFrame(frame) {
  latestFrame = frame;
  debugPanel.addFrame(frame);
  const aspect = simulate ? 1 : ((video.videoWidth || 640) / (video.videoHeight || 480));
  latestNormPose = normalizer.normalizePose(frame, aspect);

  if (screen === 'setup') {
    updateSetupCheck(frame);
    return;
  }
  if (screen !== 'round' || mode !== 'camera' || !item || completing) return;

  history.push(latestNormPose);
  propController ??= makePropController(item.verb, frame.t);
  propState = propController?.update(history, frame.t) ?? null;
  recognition = recognizer.update(history, { t: frame.t, props: propState });
  if (recognition.detected) completeRecognised(recognition.quality);
}

function updateSetupCheck(frame) {
  const points = frame?.landmarks;
  const visible = (index) => (points?.[index]?.v ?? 0) >= POSE.minVisibility;
  const basic = visible(0) && visible(11) && visible(12);
  const wristCount = Number(visible(15)) + Number(visible(16));
  const now = performance.now();
  if (basic && wristCount >= 1) setupOkaySince ??= now;
  else setupOkaySince = null;
  setupReady = setupOkaySince != null && now - setupOkaySince >= POSE.setupHoldMs;
  if (setupReady) {
    ui.setupGuidance.textContent = 'OK!';
    ui.setupStatus.textContent = 'じゅんび できたよ';
  } else if (!basic) {
    ui.setupGuidance.textContent = 'カメラの まえに たってね';
    ui.setupStatus.textContent = 'かおと かたが みえるかな？';
  } else if (wristCount < 2) {
    ui.setupGuidance.textContent = 'りょうてが みえるように してね';
    ui.setupStatus.textContent = 'もうすこし うしろに さがってね';
  } else {
    ui.setupGuidance.textContent = 'もうすこし うしろに さがってね';
    ui.setupStatus.textContent = 'そのまま まってね';
  }
}

async function openCameraSetup() {
  stopRoundWork();
  mode = 'camera';
  setScreen('setup');
  startRenderLoop();
  currentNotice = '';
  ui.setupNotice.hidden = true;
  ui.setupStatus.textContent = 'よみこみちゅう…';
  latestFrame = null;
  latestNormPose = null;
  setupOkaySince = null;
  setupReady = false;
  inferenceFps = 0;
  inferenceDelegate = null;
  lastCameraTrackStates = [];
  debugPanel.show(debugEnabled);
  detector = createDetector({
    video,
    simulate,
    simulateFail,
    synthOptions: { catchTarget: CATCH_TARGET },
    onFrame: processPoseFrame,
    onInference: ({ fps, delegate }) => {
      inferenceFps = fps;
      inferenceDelegate = delegate;
    },
    onError: cameraFailed
  });
  try {
    await detector.start();
    if (screen === 'setup') ui.setupStatus.textContent = 'カメラの まえに たってね';
  } catch (error) {
    cameraFailed(error);
  }
}

function cameraFailed(error) {
  console.warn('Camera mode unavailable; using no-camera mode.', error?.message || error);
  detector?.stop();
  detector = null;
  currentNotice = 'カメラを つかえなかったので、カメラなしで あそびます。';
  ui.setupNotice.textContent = currentNotice;
  ui.setupNotice.hidden = false;
  mode = 'choice';
  setTimeout(() => {
    if (screen === 'setup') beginRound('choice');
  }, 450);
}

function beginRound(selectedMode = mode) {
  mode = selectedMode;
  clearTimeout(nextTimer);
  // A fixed seed would replay the same order every round; ?seed= stays reproducible per round number.
  roundNumber += 1;
  const sessionOptions = {
    seed: params.get('seed') ? `${params.get('seed')}:${roundNumber}` : Math.floor(Math.random() * 2 ** 32)
  };
  if (selectedMode === 'camera' && forcedVerbs.length) {
    sessionOptions.pool = forcedVerbs;
    sessionOptions.shuffle = false; // debug pools play in the given order
  }
  session = createSession(sessionOptions);
  setScreen('round');
  startRenderLoop();
  ui.cameraStage.hidden = selectedMode !== 'camera';
  ui.choiceStage.hidden = selectedMode === 'camera';
  ui.cameraToggle.hidden = selectedMode !== 'camera';
  debugPanel.show(debugEnabled && selectedMode === 'camera');
  updateStreakHud(false);
  beginItem();
}

function beginItem() {
  item = session.current();
  if (!item) return showEnd();
  completing = false;
  wrongFirst = false;
  watched = false;
  maxStage = 0;
  itemStartedAt = performance.now();
  recognition = { detected: false, evidence: 0, quality: 0, debug: {} };
  hintManager = createHintManager(mode === 'choice' ? { ...TIMING, glossStageMs: 6000 } : undefined);
  history.clear();
  normalizer.reset();
  propController = null;
  propState = null;
  gestureConfig = mutableGestureConfig(item.verb);
  recognizer = getRecognizer(item.verb, gestureConfig);
  debugPanel.setVerb(item.verb, gestureConfig);
  latestNormPose = null;
  detector?.setTarget(item.verb);

  screens.round.dataset.verb = item.verb;
  screens.round.dataset.stage = '0';
  ui.word.textContent = item.verb.toUpperCase();
  ui.gloss.textContent = '';
  ui.count.textContent = `${session.index + 1} / ${session.queue.length}`;
  ui.meter.style.transform = 'scaleX(0)';
  ui.hint.textContent = 'からだで やってみよう！';
  ui.hint.dataset.stage = '0';
  ui.watch.hidden = true;
  ui.skip.classList.remove('prominent');
  ui.success.hidden = true;
  renderer.clear();
  if (mode === 'choice') buildChoiceCards();
  clearTimeout(ttsTimer);
  ttsTimer = setTimeout(() => audio.speak(item.verb), TIMING.speechDelayMs);
  updatePublicState();
}

function choiceVerbs(target) {
  const candidates = DEFAULT_POOL.filter((verb) => verb !== target);
  let hash = [...target].reduce((sum, char) => sum + char.charCodeAt(0), session.index * 7);
  const picked = [target];
  while (picked.length < 3) {
    const candidate = candidates[hash % candidates.length];
    if (!picked.includes(candidate)) picked.push(candidate);
    hash = (hash * 13 + 11) % 997;
  }
  return picked.sort((a, b) => ((a.charCodeAt(0) + session.index) % 3) - ((b.charCodeAt(0) + session.index) % 3));
}

function buildChoiceCards() {
  ui.choiceStage.replaceChildren();
  for (const verb of choiceVerbs(item.verb)) {
    const button = document.createElement('button');
    button.className = 'choice-card';
    button.dataset.testid = 'choice-card';
    button.dataset.verb = verb;
    button.setAttribute('aria-label', `${verb} の うごき`);
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 360;
    button.append(canvas);
    button.addEventListener('click', () => pickChoice(button, verb));
    ui.choiceStage.append(button);
  }
}

function pickChoice(button, verb) {
  if (completing || button.disabled) return;
  if (verb !== item.verb) {
    wrongFirst = true;
    button.disabled = true;
    button.classList.add('wrong');
    audio.wrong();
    updatePublicState();
    return;
  }
  completeRecognised(null, { choice: true });
}

function ratingFor(quality) {
  const value = Math.max(QUALITY.detectionMinimum, Math.min(QUALITY.maximum, Number(quality) || QUALITY.detectionMinimum));
  if (value >= QUALITY.perfect.min) return QUALITY.perfect;
  if (value >= QUALITY.great.min) return QUALITY.great;
  return QUALITY.good;
}

function completeRecognised(quality, { teacherPass = false, choice = false } = {}) {
  if (completing) return;
  completing = true;
  clearTimeout(ttsTimer);
  const rating = choice ? { label: 'GREAT!', stars: 2 } : ratingFor(quality);
  ui.ratingLabel.textContent = teacherPass ? 'NICE!' : rating.label;
  ui.ratingStars.textContent = teacherPass ? '' : '★'.repeat(rating.stars);
  ui.success.hidden = false;
  if (!teacherPass) {
    renderer.celebrate({ stars: rating.stars });
    audio.success();
  }
  audio.speak(item.verb);
  const outcome = {
    recognised: true,
    teacherPass,
    quality: teacherPass || choice ? null : quality,
    maxStage,
    watched,
    wrongFirst,
    timeMs: performance.now() - itemStartedAt
  };
  nextTimer = setTimeout(() => finishItem(outcome), TIMING.successDelayMs);
  updatePublicState();
}

function skipItem(auto = false) {
  if (completing || !item) return;
  completing = true;
  clearTimeout(ttsTimer);
  ui.hint.textContent = auto ? 'またあとで！' : 'つぎに いこう！';
  ui.meter.style.transform = 'scaleX(0)';
  nextTimer = setTimeout(() => finishItem({
    skipped: true, maxStage, watched, wrongFirst, timeMs: performance.now() - itemStartedAt
  }), auto ? 700 : 350);
  updatePublicState();
}

function finishItem(outcome) {
  const result = session.complete(outcome);
  updateStreakHud(result.record.recognised && !result.record.teacherPass && !result.record.skipped);
  if (result.done) showEnd();
  else beginItem();
}

function updateStreakHud(bump) {
  const value = session?.currentStreak ?? 0;
  const label = `れんぞく ${value}`;
  if (ui.streak.textContent !== label) ui.streak.textContent = label;
  ui.streak.hidden = value < 2;
  if (bump && value >= 2) {
    ui.streak.classList.remove('bump');
    void ui.streak.offsetWidth;
    ui.streak.classList.add('bump');
  }
}

function showEnd() {
  clearTimeout(ttsTimer);
  clearTimeout(nextTimer);
  detector?.stop();
  detector = null;
  stopRenderLoop();
  const summary = session.summary();
  setScreen('end');
  ui.endCount.textContent = `${summary.wordCount} words`;
  ui.endStreak.hidden = summary.bestStreak < 2;
  ui.endStreak.textContent = summary.bestStreak >= 2 ? `ベスト れんぞく ${summary.bestStreak}` : '';
  ui.endResults.replaceChildren();
  for (const result of summary.verbs) {
    const attempts = summary.records.filter(({ verb }) => verb === result.verb);
    const row = document.createElement('div');
    row.className = 'result-chip';
    row.dataset.testid = 'end-result';
    row.dataset.verb = result.verb;
    row.dataset.recognised = String(result.recognised);
    row.dataset.teacherPass = String(result.teacherPass);
    row.dataset.skipped = String(result.skipped);
    row.dataset.recycled = String(attempts.some(({ recycled }) => recycled));
    const stars = result.teacherPass ? '✓'
      : result.quality == null ? (mode === 'choice' && result.recognised ? '★★' : '—')
        : '★'.repeat(ratingFor(result.quality).stars);
    row.innerHTML = `${result.verb.toUpperCase()} <span>${stars}</span>`;
    ui.endResults.append(row);
  }
  ui.practice.hidden = summary.neededHelp.length === 0;
  ui.practice.querySelector('p').textContent = summary.neededHelp.map((verb) => verb.toUpperCase()).join(' · ');
  window.__ESL_GESTURES_STATE__ = { ...window.__ESL_GESTURES_STATE__, summary };
}

function applyHintState(state) {
  if (state.stage !== maxStage) {
    const priorStage = maxStage;
    maxStage = state.stage;
    screens.round.dataset.stage = String(maxStage);
    ui.hint.dataset.stage = String(maxStage);
    ui.watch.hidden = mode !== 'camera' || maxStage < 1 || maxStage >= 3;
    if (maxStage >= 2) ui.gloss.textContent = VOCAB_BY_VERB[item.verb].gloss;
    if (maxStage >= 3) ui.skip.classList.add('prominent');
    if (priorStage < 3 && maxStage >= 3 && mode === 'camera') {
      gestureConfig = { ...gestureConfig, ...EASED_OVERRIDES[item.verb] };
      recognizer = getRecognizer(item.verb, gestureConfig);
      recognition = { detected: false, evidence: 0, quality: 0, debug: {} };
      debugPanel.setVerb(item.verb, gestureConfig);
      propController?.setPickupDistanceScale?.(PROP_CONFIG.pickup.easedScale);
    }
  }
  for (const event of state.events) {
    if (event.type === 'autoAdvance') skipItem(true);
  }
}

function updateHint(now) {
  if (screen !== 'round' || !item || completing) return;
  const elapsed = Math.max(0, now - itemStartedAt);
  const state = hintManager.update(elapsed, mode === 'camera' ? recognition.evidence : 0);
  applyHintState(state);
  if (mode === 'choice' && elapsed >= 6000) ui.gloss.textContent = VOCAB_BY_VERB[item.verb].gloss;
}

function updatePublicState() {
  window.__ESL_GESTURES_STATE__ = {
    screen, mode, verb: item?.verb ?? null, stage: maxStage, evidence: recognition.evidence,
    completing, wrongFirst, watched, streak: session?.currentStreak ?? 0,
    bestStreak: session?.bestStreak ?? 0, records: session?.records ?? [], queue: session?.queue ?? [],
    detector: {
      delegate: inferenceDelegate,
      inferenceFps,
      cameraTrackStates: lastCameraTrackStates
    }
  };
}

function render(now) {
  if (!renderRunning) return;
  const dt = now - lastRenderAt;
  if (dt > 0) renderFps = renderFps ? renderFps * .9 + (1000 / dt) * .1 : 1000 / dt;
  lastRenderAt = now;
  if (screen === 'setup') {
    renderSetup(ui.setupCanvas, {
      video, videoVisible: !simulate, poseFrame: latestFrame, now,
      debug: debugEnabled, drawIdleBackground: true
    });
    if (debugEnabled) debugPanel.update({
      renderFps: +renderFps.toFixed(1), inferenceFps: +inferenceFps.toFixed(1),
      delegate: inferenceDelegate, target: null, stage: 0
    });
    updatePublicState();
  } else if (screen === 'round' && item) {
    updateHint(now);
    const elapsed = Math.max(0, now - itemStartedAt);
    if (mode === 'camera') {
      renderer.render({
        video, videoVisible: cameraVisible && !simulate, poseFrame: latestFrame, normPose: latestNormPose,
        verb: item.verb, stage: maxStage, propState, debug: debugEnabled, now, itemElapsed: elapsed,
        showDemo: maxStage >= 3, demoTime: elapsed, simulatedPlayer: simulate,
        normalizationAspect: simulate ? 1 : undefined
      });
      ui.meter.style.transform = `scaleX(${Math.max(0, Math.min(1, recognition.evidence))})`;
      if (debugEnabled) debugPanel.update({
        renderFps: +renderFps.toFixed(1), inferenceFps: +inferenceFps.toFixed(1), target: item.verb,
        delegate: inferenceDelegate,
        stage: maxStage, evidence: +recognition.evidence.toFixed(3), rawQuality: +recognition.quality.toFixed(1),
        recognizer: recognition.debug
      });
    } else {
      for (const button of ui.choiceStage.querySelectorAll('.choice-card')) {
        renderDemo(button.querySelector('canvas'), button.dataset.verb, elapsed, { prop: true });
      }
    }
    updatePublicState();
  }
  renderHandle = requestAnimationFrame(render);
}

function startRenderLoop() {
  if (renderRunning) return;
  renderRunning = true;
  lastRenderAt = performance.now();
  renderHandle = requestAnimationFrame(render);
}

function stopRenderLoop() {
  renderRunning = false;
  if (renderHandle !== null) cancelAnimationFrame(renderHandle);
  renderHandle = null;
}

function stopRoundWork() {
  clearTimeout(ttsTimer);
  clearTimeout(nextTimer);
  const cameraTracks = detector?.stream?.getTracks?.() ?? [];
  detector?.stop();
  lastCameraTrackStates = cameraTracks.map((track) => track.readyState);
  detector = null;
  completing = false;
  item = null;
  history.clear();
  renderer.clear();
}

function goTitle() {
  stopRoundWork();
  stopRenderLoop();
  mode = null;
  setScreen('title');
  debugPanel.show(false);
  updatePublicState();
}

$('[data-testid="title-camera"]').addEventListener('click', openCameraSetup);
$('[data-testid="title-no-camera"]').addEventListener('click', () => beginRound('choice'));
$('[data-testid="setup-start"]').addEventListener('click', () => beginRound('camera'));
$('[data-testid="setup-no-camera"]').addEventListener('click', () => { detector?.stop(); detector = null; beginRound('choice'); });
ui.skip.addEventListener('click', () => skipItem(false));
ui.watch.addEventListener('click', () => {
  if (mode !== 'camera' || completing || maxStage < 1 || maxStage >= 3) return;
  watched = true;
  applyHintState(hintManager.jumpTo(3, performance.now() - itemStartedAt));
  updatePublicState();
});
ui.cameraToggle.addEventListener('click', () => {
  cameraVisible = !cameraVisible;
  ui.cameraToggle.classList.toggle('off', !cameraVisible);
});
ui.soundToggle.addEventListener('click', () => {
  audio.setEnabled(!audio.enabled);
  ui.soundToggle.classList.toggle('off', !audio.enabled);
  ui.soundToggle.textContent = audio.enabled ? '🔊' : '🔇';
});
$('#again-button').addEventListener('click', () => mode === 'camera' ? openCameraSetup() : beginRound('choice'));
$('#title-button').addEventListener('click', goTitle);

document.addEventListener('keydown', (event) => {
  if (screen !== 'round' || event.repeat) return;
  if (event.key === 'Enter' || event.key.toLowerCase() === 'p') completeRecognised(null, { teacherPass: true });
  else if (event.key.toLowerCase() === 's') skipItem(false);
  else if (event.key === 'Escape') goTitle();
});

window.addEventListener('pagehide', () => {
  detector?.stop();
  stopRenderLoop();
  renderer.destroy();
  audio.close();
});

debugPanel.show(false);
updatePublicState();
