import { spawn } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shots = resolve(root, 'shots');
const host = '127.0.0.1';
const port = Number(process.env.PLAYTHROUGH_PORT || 4173);
const origin = `http://${host}:${port}`;
const verbs = new Set([
  'jump', 'run', 'walk', 'dance', 'swim', 'fly',
  'climb', 'catch', 'drink', 'eat', 'cut', 'wash', 'stop',
]);
const viewportSizes = [
  { width: 1366, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 1920, height: 1080 },
];

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let preview;
let browser;

function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32' && command.endsWith('.cmd'),
      ...options,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolveRun();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code ?? signal}`));
    });
  });
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch (localError) {
    const fallback = 'C:/Users/nolan/ui-verify/node_modules/playwright/index.mjs';
    try {
      await access(fallback);
      return await import(pathToFileURL(fallback).href);
    } catch {
      throw new Error(
        'Playwright was not found locally or at C:/Users/nolan/ui-verify/node_modules.\n'
          + `Local import error: ${localError.message}`,
      );
    }
  }
}

async function waitForPreview(timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin, { redirect: 'manual' });
      if (response.ok || response.status === 304) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  }
  throw new Error(`Vite preview did not start at ${origin}: ${lastError?.message || 'timeout'}`);
}

function instrument(page, name) {
  const failures = [];
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => failures.push(`page: ${error.message}`));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if ((url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'ws:' || url.protocol === 'wss:')
      && url.origin !== origin) {
      failures.push(`off-origin request: ${request.url()}`);
    }
  });
  return () => {
    if (failures.length) {
      throw new Error(`${name} emitted browser errors:\n${[...new Set(failures)].join('\n')}`);
    }
  };
}

async function firstVisible(page, selectors, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if (await locator.isVisible().catch(() => false)) return locator;
    }
    await page.waitForTimeout(75);
  }
  throw new Error(`None of these selectors became visible: ${selectors.join(', ')}`);
}

async function isAnyVisible(page, selectors) {
  for (const selector of selectors) {
    if (await page.locator(selector).first().isVisible().catch(() => false)) return true;
  }
  return false;
}

const endSelectors = [
  '[data-testid="end-screen"]',
  '[data-screen="end"]',
  'text=よくできました！',
];

const titleCamera = (page) => firstVisible(page, [
  '[data-testid="title-camera"]',
  'button:has-text("カメラであそぶ")',
]);
const titleNoCamera = (page) => firstVisible(page, [
  '[data-testid="title-no-camera"]',
  'button:has-text("カメラなし")',
]);
const setupStart = (page) => firstVisible(page, [
  '[data-testid="setup-start"]',
  '[data-screen="setup"] button:has-text("START")',
  'button:has-text("START")',
], 30_000);
const endScreen = (page) => firstVisible(page, endSelectors, 180_000);

async function readCurrentVerb(page) {
  const attributes = [
    ['[data-testid="round-screen"][data-verb]', 'data-verb'],
    ['[data-screen="round"][data-verb]', 'data-verb'],
    ['[data-current-verb]', 'data-current-verb'],
    ['[data-testid="word"][data-verb]', 'data-verb'],
  ];
  for (const [selector, attribute] of attributes) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      const value = await locator.getAttribute(attribute);
      if (verbs.has(value)) return value;
    }
  }
  const word = page.locator('[data-testid="word"], .word, h1').first();
  const text = (await word.textContent().catch(() => ''))?.trim().toLowerCase();
  return verbs.has(text) ? text : null;
}

async function readStage(page) {
  for (const selector of ['[data-stage]', '[data-testid="hint-stage"]']) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      const raw = await locator.getAttribute('data-stage') || await locator.textContent();
      const stage = Number.parseInt(raw, 10);
      if (Number.isFinite(stage)) return stage;
    }
  }
  return null;
}

async function waitForVerbChange(page, previous, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await isAnyVisible(page, endSelectors)) return null;
    const current = await readCurrentVerb(page);
    if (current && current !== previous) return current;
    await page.waitForTimeout(100);
  }
  throw new Error(`Round did not advance from ${previous || 'the current item'}`);
}

async function assertRoundControlsFit(page, label) {
  for (const viewport of viewportSizes) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => new Promise((resolveFrame) => {
      requestAnimationFrame(() => requestAnimationFrame(resolveFrame));
    }));
    const boxes = await page.evaluate(() => Object.fromEntries([
      ['meter', document.querySelector('.meter-shell')],
      ['hint', document.querySelector('#hint-status')],
      ['watch', document.querySelector('#watch-button')],
      ['skip', document.querySelector('#skip-button')],
    ].map(([name, element]) => {
      if (!element) return [name, null];
      const rect = element.getBoundingClientRect();
      return [name, { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }];
    })));
    for (const [name, box] of Object.entries(boxes)) {
      if (!box || box.left < -0.5 || box.top < -0.5
        || box.right > viewport.width + 0.5 || box.bottom > viewport.height + 0.5) {
        throw new Error(`${label}: ${name} is outside ${viewport.width}x${viewport.height}: ${JSON.stringify(box)}`);
      }
    }
  }
}

function assertRecycle(sequence, verb, label) {
  const first = sequence.indexOf(verb);
  const second = sequence.indexOf(verb, first + 1);
  if (first < 0 || second < 0) {
    throw new Error(`${label}: expected ${verb} to appear once and then be recycled; got ${sequence.join(', ')}`);
  }
  const positionsLater = second - first;
  if (positionsLater < 3 || positionsLater > 6) {
    throw new Error(`${label}: recycled ${verb} appeared ${positionsLater} positions later, expected 3-6 (${sequence.join(', ')})`);
  }
}

async function readEndResults(page, label) {
  const stateRecords = await page.evaluate(() => window.__ESL_GESTURES_STATE__?.summary?.records ?? null);
  if (Array.isArray(stateRecords) && stateRecords.length) {
    return stateRecords.map((record) => ({
      verb: record.verb,
      recognised: record.recognised === true,
      recycled: record.recycled === true,
    }));
  }
  const rows = page.locator('[data-testid="end-result"][data-verb]');
  const count = await rows.count();
  if (!count) {
    throw new Error(`${label}: end result rows need data-testid="end-result" plus data-verb and data-recognised attributes.`);
  }
  const results = [];
  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index);
    results.push({
      verb: await row.getAttribute('data-verb'),
      recognised: await row.getAttribute('data-recognised') === 'true',
      recycled: await row.getAttribute('data-recycled') === 'true',
    });
  }
  return results;
}

async function cameraRound() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const assertClean = instrument(page, 'simulated camera round');
  const sequence = [];
  let current = null;
  let currentSince = 0;
  let stageZeroShot = false;
  let stageOneShot = false;
  let stageThreeShot = false;
  let successShot = false;
  let watchTapped = false;
  let streakSeen = false;

  await page.goto(`${origin}/?simulate=1&simulateFail=swim`);
  await (await titleCamera(page)).click();
  const start = await setupStart(page);
  await page.waitForTimeout(350);
  await page.screenshot({ path: resolve(shots, 'setup.png'), fullPage: true });
  await start.click();
  await firstVisible(page, ['[data-testid="round-screen"]']);
  await assertRoundControlsFit(page, 'simulated camera round');

  const deadline = Date.now() + 190_000;
  while (Date.now() < deadline) {
    if (await isAnyVisible(page, endSelectors)) break;
    const verb = await readCurrentVerb(page);
    if (verb && verb !== current) {
      current = verb;
      currentSince = Date.now();
      sequence.push(verb);
      if (!stageZeroShot) {
        await page.screenshot({ path: resolve(shots, 'word-stage-0.png'), fullPage: true });
        stageZeroShot = true;
      }
    }
    if (!successShot && await isAnyVisible(page, [
      '[data-testid="success"]:not([hidden])',
      '[data-state="success"]',
      'text=/^(GOOD|GREAT|PERFECT)!/',
    ])) {
      await page.screenshot({ path: resolve(shots, 'success-rating.png'), fullPage: true });
      successShot = true;
    }
    if (current === 'swim') {
      const elapsed = Date.now() - currentSince;
      const stage = await readStage(page);
      if (!stageOneShot && (stage >= 1 || elapsed >= 2_800)) {
        await page.screenshot({ path: resolve(shots, 'stage-1-context.png'), fullPage: true });
        stageOneShot = true;
      }
      if (!watchTapped && stage >= 1) {
        await page.locator('[data-testid="watch-button"]').click();
        await page.waitForFunction(() => Number(document.querySelector('[data-testid="round-screen"]')?.dataset.stage) === 3);
        watchTapped = true;
      }
      if (!stageThreeShot && stage >= 3) {
        await page.screenshot({ path: resolve(shots, 'stage-3-demo.png'), fullPage: true });
        stageThreeShot = true;
      }
    }
    if (!streakSeen) {
      const badge = page.locator('[data-testid="streak-badge"]');
      if (await badge.isVisible().catch(() => false)) {
        const count = Number.parseInt((await badge.textContent())?.match(/\d+/)?.[0] || '0', 10);
        streakSeen = count >= 2;
      }
    }
    await page.waitForTimeout(80);
  }

  await endScreen(page);
  await page.screenshot({ path: resolve(shots, 'end-screen.png'), fullPage: true });
  for (const [name, captured] of Object.entries({ stageZeroShot, stageOneShot, stageThreeShot, successShot })) {
    if (!captured) throw new Error(`simulated camera round did not capture ${name}`);
  }
  if (!watchTapped) throw new Error('simulated camera round did not tap みてみる at stage 1');
  if (!streakSeen) throw new Error('simulated camera round did not show the streak badge after two clean successes');
  assertRecycle(sequence, 'swim', 'simulated camera round');
  const results = await readEndResults(page, 'simulated camera round');
  const failed = results.filter((result) => !result.recognised);
  if (failed.length !== 1 || failed[0].verb !== 'swim' || failed[0].recycled) {
    throw new Error(`simulated camera round expected only the original swim to fail: ${JSON.stringify(results)}`);
  }
  if (!results.some((result) => result.verb === 'swim' && result.recycled && result.recognised)) {
    throw new Error(`simulated camera round did not recognise recycled swim: ${JSON.stringify(results)}`);
  }
  assertClean();
  await context.close();
}

async function cardForVerb(page, verb) {
  return firstVisible(page, [
    `[data-testid="choice-card"][data-verb="${verb}"]`,
    `[data-choice-verb="${verb}"]`,
    `button[data-verb="${verb}"]`,
    `button[aria-label="${verb}"]`,
  ]);
}

async function noCameraRound() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const assertClean = instrument(page, 'no-camera round');
  const sequence = [];
  let failedVerb;

  await page.goto(origin);
  await (await titleNoCamera(page)).click();
  await firstVisible(page, ['[data-testid="no-camera-cards"]', '[data-choice-verb]', '[data-testid="choice-card"]']);
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(shots, 'no-camera-cards.png'), fullPage: true });
  await assertRoundControlsFit(page, 'no-camera round');

  const deadline = Date.now() + 100_000;
  while (Date.now() < deadline) {
    if (await isAnyVisible(page, endSelectors)) break;
    const verb = await readCurrentVerb(page);
    if (!verb) {
      await page.waitForTimeout(75);
      continue;
    }
    if (sequence.at(-1) === verb) {
      await page.waitForTimeout(75);
      continue;
    }
    sequence.push(verb);
    if (!failedVerb) {
      const cards = page.locator('[data-testid="choice-card"][data-verb], [data-choice-verb], button[data-verb]');
      const count = await cards.count();
      let wrong;
      for (let index = 0; index < count; index += 1) {
        const card = cards.nth(index);
        const choice = await card.getAttribute('data-verb') || await card.getAttribute('data-choice-verb');
        if (choice && choice !== verb && await card.isVisible()) {
          wrong = card;
          break;
        }
      }
      if (!wrong) throw new Error('No-camera cards need data-verb or data-choice-verb attributes for playthrough assertions.');
      await wrong.click();
      failedVerb = verb;
      await page.waitForTimeout(180);
    }
    await (await cardForVerb(page, verb)).click();
    await waitForVerbChange(page, verb, 8_000);
  }

  await endScreen(page);
  assertRecycle(sequence, failedVerb, 'no-camera round');
  const results = await readEndResults(page, 'no-camera round');
  if (results.some((result) => !result.recognised)) {
    throw new Error(`no-camera round should finish every choice successfully: ${JSON.stringify(results)}`);
  }
  assertClean();
  await context.close();
}

async function cameraDeniedFallback() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const assertClean = instrument(page, 'camera denied fallback');
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => { throw new DOMException('Permission denied by playthrough', 'NotAllowedError'); },
      },
    });
  });
  await page.goto(origin);
  await (await titleCamera(page)).click();
  await firstVisible(page, [
    '[data-testid="camera-notice"]',
    '[data-testid="setup-notice"]',
    '[role="alert"]',
    'text=/カメラ.*(つかえ|使え|なし)/',
  ], 30_000);
  await firstVisible(page, ['[data-testid="no-camera-cards"]', '[data-choice-verb]', '[data-testid="choice-card"]'], 15_000);
  assertClean();
  await context.close();
}

async function teacherKeys() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const assertClean = instrument(page, 'teacher keys');
  await page.goto(`${origin}/?simulate=1`);
  await (await titleCamera(page)).click();
  await (await setupStart(page)).click();
  const first = await firstVisible(page, ['[data-testid="word"]', '[data-current-verb]', '[data-testid="round-screen"]']);
  await first.waitFor({ state: 'visible' });
  const firstVerb = await readCurrentVerb(page);
  if (!firstVerb) throw new Error('Teacher-key scenario could not read the first verb.');
  await page.keyboard.press('p');
  const secondVerb = await waitForVerbChange(page, firstVerb, 8_000);
  if (!secondVerb) throw new Error('P teacher-pass ended the round unexpectedly.');
  await page.keyboard.press('s');
  await waitForVerbChange(page, secondVerb, 8_000);
  await page.keyboard.press('Escape');
  await firstVisible(page, ['[data-testid="title-screen"]', '[data-screen="title"]', 'button:has-text("カメラであそぶ")']);
  assertClean();
  await context.close();
}

async function propInteractions() {
  const ordered = ['drink', 'eat', 'cut', 'catch', 'wash', 'fly', 'climb', 'swim'];
  const capture = ordered.slice(0, 5);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const assertClean = instrument(page, 'simulated prop interactions');
  await page.goto(`${origin}/?simulate=1&verbs=${ordered.join(',')}`);
  await (await titleCamera(page)).click();
  await (await setupStart(page)).click();

  for (const expected of capture) {
    await page.waitForFunction((verb) => {
      const state = window.__ESL_GESTURES_STATE__;
      return state?.verb === verb && (state.evidence > 0 || state.completing);
    }, expected, { timeout: 10_000 });
    await page.screenshot({ path: resolve(shots, `prop-${expected}.png`) });
    const completingNow = await page.evaluate(() => window.__ESL_GESTURES_STATE__?.completing === true);
    if (!completingNow) await page.keyboard.press('p');
    await waitForVerbChange(page, expected, 10_000);
  }

  assertClean();
  await context.close();
}

async function realDetectorSmoke() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const assertClean = instrument(page, 'real detector smoke');
  await page.addInitScript(() => {
    window.__PLAYTHROUGH_STREAMS__ = [];
    const original = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if (!original) return;
    navigator.mediaDevices.getUserMedia = async (...args) => {
      const stream = await original(...args);
      window.__PLAYTHROUGH_STREAMS__.push(stream);
      return stream;
    };
  });
  let modelResponse = null;
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.endsWith('/models/pose_landmarker_lite.task')) {
      modelResponse = { url: response.url(), ok: response.ok() };
    }
  });

  await page.goto(`${origin}/?debug=1`);
  await (await titleCamera(page)).click();
  await page.waitForFunction(() => {
    try {
      const values = JSON.parse(document.querySelector('#debug-values')?.textContent || '{}');
      return ['GPU', 'CPU'].includes(values.delegate) && values.inferenceFps > 0;
    } catch {
      return false;
    }
  }, null, { timeout: 10_000 });
  if (!modelResponse?.ok || new URL(modelResponse.url).origin !== origin) {
    throw new Error(`real detector model did not load successfully from this origin: ${JSON.stringify(modelResponse)}`);
  }

  await (await setupStart(page)).click();
  await firstVisible(page, ['[data-testid="round-screen"]']);
  await page.keyboard.press('Escape');
  await firstVisible(page, ['[data-testid="title-screen"]']);
  const trackStates = await page.evaluate(() => (window.__PLAYTHROUGH_STREAMS__ || [])
    .flatMap((stream) => stream.getVideoTracks()).map((track) => track.readyState));
  if (!trackStates.length || trackStates.some((state) => state !== 'ended')) {
    throw new Error(`real detector camera tracks were not stopped: ${JSON.stringify(trackStates)}`);
  }
  assertClean();
  await context.close();
}

async function main() {
  await mkdir(shots, { recursive: true });
  await run(npm, ['run', 'build']);
  const vite = resolve(root, 'node_modules', 'vite', 'bin', 'vite.js');
  preview = spawn(process.execPath, [vite, 'preview', '--host', host, '--port', String(port), '--strictPort'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  preview.stdout.on('data', (chunk) => process.stdout.write(chunk));
  preview.stderr.on('data', (chunk) => process.stderr.write(chunk));
  await waitForPreview();

  const playwright = await loadPlaywright();
  browser = await playwright.chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  await cameraRound();
  await noCameraRound();
  await cameraDeniedFallback();
  await teacherKeys();
  await propInteractions();
  await realDetectorSmoke();
  console.log(`Playthrough passed. Screenshots saved in ${shots}.`);
}

try {
  await main();
} finally {
  await browser?.close().catch(() => {});
  preview?.kill();
}
