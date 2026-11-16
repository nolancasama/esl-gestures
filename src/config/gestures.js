const common = Object.freeze({ gain: 1, decay: 0.15, directionChangeEpsilon: 0.15 });

export const GESTURE_CONFIG = Object.freeze({
  jump: Object.freeze({ ...common, baselineMs: 1000, baselineAlpha: 0.05, rise: 0.35, smallRise: 0.22, returnTolerance: 0.16, maxBounceMs: 900, armsUpY: -0.35, armsUpQuality: 1, armsDownQuality: 0.5, clearGain: 1.08, smallGain: 0.56, amplitudePerfect: 0.65 }),
  run: Object.freeze({ ...common, analysisMs: 1800, minAmplitude: 0.5, slowFrequencyHz: 0.8, minFrequencyHz: 1.6, phaseThreshold: -0.15, matchGain: 0.58, slowGain: 0.32, amplitudePerfect: 1.1, frequencyPerfectHz: 2.8, minHalfCycles: 3 }),
  walk: Object.freeze({ ...common, analysisMs: 2200, minAmplitude: 0.3, minFrequencyHz: 0.6, phaseThreshold: 0.15, matchGain: 0.52, amplitudePerfect: 0.9, frequencyPerfectHz: 1.8, minHalfCycles: 2 }),
  dance: Object.freeze({ ...common, analysisMs: 1200, energyThreshold: 1.4, directionChangeWindowMs: 1200, minDirectionChanges: 3, matchGain: 0.65, energyPerfect: 7, changePerfect: 9 }),
  swim: Object.freeze({ ...common, analysisMs: 2200, minExcursion: 1, minCycles: 2, cycleGain: 0.55, amplitudePerfect: 2, speedPerfect: 3 }),
  fly: Object.freeze({ ...common, minSpread: 2.2, maxVerticalOffset: 0.8, holdMs: 600, holdGain: 1.72, spreadPerfect: 3.3, flapPerfect: 0.8 }),
  climb: Object.freeze({ ...common, reachY: -0.4, returnY: 0.05, rearmDrop: 0.45, eventsNeeded: 3, alternateGain: 0.44, repeatGain: 0.22, repeatQuality: 0.5, reachPerfect: -1.25 }),
  catch: Object.freeze({ ...common, catchDistance: 0.9, catchGain: 1.1, distancePerfect: 0.2, qualitySpeed: 0.8 }),
  drink: Object.freeze({ ...common, mouthDistance: 0.9, holdMs: 750, holdGain: 2.05, distancePerfect: 0.18, holdQuality: 0.7 }),
  eat: Object.freeze({ ...common, mouthDistance: 0.9, resetDistance: 1.2, approachesNeeded: 2, approachGain: 0.65, singleHoldMs: 800, holdGain: 1.3, distancePerfect: 0.18, qualitySpeed: 0.7 }),
  cut: Object.freeze({ ...common, boardMinY: 0.3, boardMaxY: 1.6, boardHalfWidth: 1.3, strokeDistance: 0.42, resetDistance: 0.2, minStrokeMs: 120, minStrokeGapMs: 250, strokesNeeded: 3, strokeGain: 0.44, amplitudePerfect: 0.8, qualitySpeed: 0.8 }),
  wash: Object.freeze({ ...common, maxHandDistance: 1.1, minRelativeSpeed: 0.35, minDirectionChanges: 1, holdMs: 1200, holdGain: 0.86, speedPerfect: 3, changesPerfect: 4 }),
  stop: Object.freeze({ ...common, minPalmHeight: -0.2, minSeparation: 0.65, maxPositionRange: 0.45, holdMs: 700, holdGain: 1.48, stillPerfect: 0.12 })
});

export const EASED_OVERRIDES = Object.freeze({
  jump: Object.freeze({ rise: 0.2625, smallRise: 0.165, returnTolerance: 0.2 }),
  run: Object.freeze({ minAmplitude: 0.375, minHalfCycles: 2 }),
  walk: Object.freeze({ minAmplitude: 0.225, minHalfCycles: 1 }),
  dance: Object.freeze({ energyThreshold: 1.05, minDirectionChanges: 2, matchGain: 0.35 }),
  swim: Object.freeze({ minExcursion: 0.75, minCycles: 1 }),
  fly: Object.freeze({ minSpread: 1.65, maxVerticalOffset: 1, holdMs: 420, holdGain: 2.4571428571428573 }),
  climb: Object.freeze({ reachY: -0.3, rearmDrop: 0.3375, eventsNeeded: 2, alternateGain: 0.66, repeatGain: 0.33 }),
  catch: Object.freeze({ catchDistance: 1.125 }),
  drink: Object.freeze({ mouthDistance: 1.125, holdMs: 700, holdGain: 2.928571428571429 }),
  eat: Object.freeze({ mouthDistance: 1.125, resetDistance: 1.5, singleHoldMs: 560 }), // still 2 approaches: one brief face touch must not count as eating
  cut: Object.freeze({ boardMinY: 0.1375, boardMaxY: 1.7625, boardHalfWidth: 1.625, }), // zone only: a shorter stroke or fewer strokes lets single-frame tracking spikes pass as cutting
  wash: Object.freeze({ maxHandDistance: 1.375, minRelativeSpeed: 0.2625, minDirectionChanges: 1, holdMs: 840, holdGain: 1.2285714285714286 }),
  stop: Object.freeze({ minPalmHeight: -0.15, minSeparation: 0.4875, maxPositionRange: 0.5625, holdMs: 490, holdGain: 2.1142857142857143 })
});

export const PROP_CONFIG = Object.freeze({
  pickup: Object.freeze({
    horizontalOffset: 1.5,
    verticalOffset: 0.6,
    pickupDistance: 0.8,
    followAlpha: 0.5,
    autoAttachGlideMs: 250,
    easedScale: 1.25
  }),
  propHand: Object.freeze({ nearMouthDistance: 1.05, boardPadding: 0.15 }),
  cup: Object.freeze({ tiltStartDistance: 1.2, maxTiltRadians: 1.15 }),
  onigiri: Object.freeze({ biteResetDistance: 1.2, maxBites: 3 }),
  board: Object.freeze({ centerX: 0, centerY: 0.95, halfWidth: 1.3, minY: 0.3, maxY: 1.6 }),
  catch: Object.freeze({ targetMinY: -1.2, targetMaxY: 0.3, targetMaxX: 1.4, torsoHalfWidth: 0.45, torsoMinY: -0.15, torsoMaxY: 1.15, launchX: 2.4, launchY: -2, missFadeMs: 400 }),
  wash: Object.freeze({ spawnPerUnit: 5, bubbleLifetimeMs: 1100, maxBubbles: 24 })
});
