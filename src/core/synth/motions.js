import { neutralSkeleton } from './skeleton.js';

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wave01 = (phase) => (1 - Math.cos(phase)) / 2;

function setArm(pose, side, wristX, wristY, bend = 0.18, z = -0.03) {
  const shoulder = pose[`${side}Shoulder`];
  pose[`${side}Wrist`] = { x: wristX, y: wristY, z };
  pose[`${side}Elbow`] = {
    x: shoulder.x * 0.2 + wristX * 0.8 + (side === 'l' ? -bend : bend),
    y: shoulder.y * 0.25 + wristY * 0.75 + bend,
    z: z * 0.55
  };
}

function idle(t, opts = {}) {
  const pose = neutralSkeleton();
  const sway = Math.sin(TAU * t / 4200) * 0.045;
  const breath = Math.sin(TAU * t / 2700) * 0.018;
  pose.root.x = sway;
  pose.nose.y += breath;
  pose.lShoulder.y += breath * 0.45;
  pose.rShoulder.y += breath * 0.45;
  pose.lWrist.x += Math.sin(TAU * t / 3100) * 0.035;
  pose.rWrist.x += Math.sin(TAU * t / 3500 + 1.1) * 0.035;
  if (opts.idleVariant === 'fidget') {
    pose.root.x += Math.sin(TAU * t / 6500) * 0.08;

    if (t >= 2400 && t <= 2750) {
      const local = t - 2400;
      const amount = local < 75 ? wave01(Math.PI * local / 75)
        : local <= 275 ? 1
          : 1 - wave01(Math.PI * (local - 275) / 75);
      setArm(pose, 'r', 0.78 * (1 - amount) + 0.12 * amount, 1.34 * (1 - amount) - 0.92 * amount, 0.08);
    }

    if (t >= 8200 && t <= 9000) {
      const local = t - 8200;
      const amount = local < 100 ? wave01(Math.PI * local / 100)
        : local <= 700 ? 1
          : 1 - wave01(Math.PI * (local - 700) / 100);
      const scratchX = -0.86 + (local >= 100 && local <= 700 ? 0.045 * Math.sin(TAU * local / 180) : 0);
      setArm(pose, 'l', -0.78 * (1 - amount) + scratchX * amount, 1.34 * (1 - amount) - 1.38 * amount, 0.08);
    }
  }
  return pose;
}

function jump(t) {
  const pose = neutralSkeleton();
  const phase = (t % 1050) / 1050;
  // A short crouch makes the airborne portion visually obvious. The rolling
  // shoulder baseline still sees a clean rise and return.
  let lift;
  if (phase < 0.18) lift = 0.13 * Math.sin(Math.PI * phase / 0.18);
  else if (phase < 0.78) lift = -0.62 * Math.sin(Math.PI * (phase - 0.18) / 0.6);
  else lift = 0;
  pose.root.y = lift;
  const arms = clamp(-lift / 0.62, 0, 1);
  setArm(pose, 'l', -0.9 - arms * 0.12, 1.15 - arms * 2.05, 0.12);
  setArm(pose, 'r', 0.9 + arms * 0.12, 1.15 - arms * 2.05, 0.12);
  pose.lKnee.y += arms * 0.2;
  pose.rKnee.y += arms * 0.2;
  return pose;
}

function locomotion(t, running) {
  const pose = neutralSkeleton();
  const hz = running ? 2.15 : 0.92;
  const amplitude = running ? 0.92 : 0.62;
  const phase = TAU * hz * t / 1000;
  const swing = Math.sin(phase);
  setArm(pose, 'l', -0.67 - swing * 0.22, 0.73 + swing * amplitude, 0.22);
  setArm(pose, 'r', 0.67 - swing * 0.22, 0.73 - swing * amplitude, 0.22);
  pose.lKnee.y -= Math.max(0, -swing) * (running ? 0.7 : 0.3);
  pose.rKnee.y -= Math.max(0, swing) * (running ? 0.7 : 0.3);
  pose.root.y = Math.abs(Math.sin(phase)) * (running ? -0.07 : -0.025);
  return pose;
}

function dance(t) {
  const pose = neutralSkeleton();
  const phase = TAU * t / 920;
  const slower = TAU * t / 1700;
  pose.root.x = 0.18 * Math.sin(slower);
  pose.root.y = -0.12 * Math.abs(Math.sin(phase));
  setArm(pose, 'l', -0.95 - 0.48 * Math.sin(phase), 0.15 + 0.92 * Math.cos(phase), 0.12);
  setArm(pose, 'r', 0.95 + 0.48 * Math.sin(phase + 1.6), 0.15 + 0.92 * Math.cos(phase + 1.6), 0.12);
  pose.nose.x += 0.12 * Math.sin(slower + 0.7);
  return pose;
}

function swim(t) {
  const pose = neutralSkeleton();
  const phase = TAU * 1.18 * t / 1000;
  const stroke = (sidePhase, side) => {
    const xSign = side === 'l' ? -1 : 1;
    const x = xSign * (0.72 + 0.72 * Math.cos(sidePhase));
    const y = 0.25 + 0.78 * Math.sin(sidePhase);
    setArm(pose, side, x, y, 0.08, -0.18 * Math.cos(sidePhase));
  };
  stroke(phase, 'l');
  stroke(phase + Math.PI, 'r');
  return pose;
}

function fly(t) {
  const pose = neutralSkeleton();
  const flap = 0.42 * Math.sin(TAU * t / 720);
  setArm(pose, 'l', -1.48, -0.05 + flap, 0.03);
  setArm(pose, 'r', 1.48, -0.05 + flap, 0.03);
  return pose;
}

function climb(t, opts = {}) {
  const pose = neutralSkeleton();
  const phase = TAU * t / 1050;
  const leftReach = wave01(phase);
  const rightReach = wave01(phase + Math.PI);
  const baseY = opts.climbVariant === 'above-shoulders' ? -0.05 : 0.7;
  const reachDistance = opts.climbVariant === 'above-shoulders' ? 1 : 1.72;
  setArm(pose, 'l', -0.64, baseY - leftReach * reachDistance, 0.1);
  setArm(pose, 'r', 0.64, baseY - rightReach * reachDistance, 0.1);
  pose.lKnee.y -= rightReach * 0.35;
  pose.rKnee.y -= leftReach * 0.35;
  return pose;
}

function catchMotion(t, opts = {}) {
  const pose = neutralSkeleton();
  const requested = opts.catchTarget || opts.target || { x: 1.05, y: -0.55 };
  const requestedX = Number(requested.x);
  const requestedY = Number(requested.y);
  const target = {
    x: clamp((Number.isFinite(requestedX) ? requestedX : 1.05) * (opts.mirror ? -1 : 1), -1.4, 1.4),
    y: clamp(Number.isFinite(requestedY) ? requestedY : -0.55, -1.2, 0.3)
  };
  const cycle = t % 2300;
  // Meet the ball at the nominal 1.4 s flight arrival, then draw it inward.
  const reach = cycle < 1050 ? 0 : cycle < 1400 ? wave01(Math.PI * (cycle - 1050) / 350) : cycle < 1800 ? 1 : 1 - wave01(Math.PI * (cycle - 1800) / 350);
  const inward = cycle > 1450 && cycle < 2050 ? wave01(Math.PI * (cycle - 1450) / 600) : 0;
  const handX = target.x * reach * (1 - inward * 0.45);
  const handY = 1.1 * (1 - reach) + target.y * reach + inward * 0.6;
  if (target.x < 0) setArm(pose, 'l', handX, handY, 0.08, -0.25);
  else setArm(pose, 'r', handX, handY, 0.08, -0.25);
  return pose;
}

function drink(t) {
  const pose = neutralSkeleton();
  const cycle = t % 2100;
  const progress = cycle < 350 ? wave01(Math.PI * cycle / 350) : cycle < 1600 ? 1 : cycle < 1950 ? 1 - wave01(Math.PI * (cycle - 1600) / 350) : 0;
  setArm(pose, 'r', 0.84 * (1 - progress) + 0.12 * progress, 1.15 * (1 - progress) - 0.93 * progress, 0.08, -0.3);
  return pose;
}

function eat(t) {
  const pose = neutralSkeleton();
  const phase = (t % 1050) / 1050;
  const progress = phase < 0.28 ? wave01(Math.PI * phase / 0.28) : phase < 0.58 ? 1 : phase < 0.86 ? 1 - wave01(Math.PI * (phase - 0.58) / 0.28) : 0;
  setArm(pose, 'l', -0.82 * (1 - progress) - 0.12 * progress, 1.12 * (1 - progress) - 0.91 * progress, 0.08, -0.25);
  return pose;
}

function cut(t) {
  const pose = neutralSkeleton();
  const phase = (t % 620) / 620;
  const down = phase < 0.58 ? wave01(Math.PI * phase / 0.58) : 1 - wave01(Math.PI * (phase - 0.58) / 0.42);
  // The whole stroke remains inside the specified board zone.
  setArm(pose, 'r', 0.48, 0.42 + down * 0.78, 0.06, -0.2);
  pose.lWrist = { x: -0.48, y: 0.9, z: -0.05 };
  pose.lElbow = { x: -0.67, y: 0.57, z: -0.02 };
  return pose;
}

function wash(t) {
  const pose = neutralSkeleton();
  const phase = TAU * 2.1 * t / 1000;
  setArm(pose, 'l', -0.24 + 0.22 * Math.sin(phase), 0.72 + 0.16 * Math.cos(phase), 0.04, -0.18);
  setArm(pose, 'r', 0.24 - 0.22 * Math.sin(phase), 0.72 - 0.16 * Math.cos(phase), 0.04, -0.18);
  return pose;
}

function stop(t) {
  const pose = neutralSkeleton();
  const lift = clamp(t / 420, 0, 1);
  setArm(pose, 'r', 0.8 - 0.08 * lift, 1.28 - 1.78 * lift, 0.05, -0.62 * lift);
  // A tiny settling movement, followed by a steady open palm.
  if (t > 420) pose.rWrist.y += 0.025 * Math.exp(-(t - 420) / 250) * Math.sin((t - 420) / 45);
  return pose;
}

export const MOTIONS = Object.freeze({
  idle,
  jump,
  run: (t) => locomotion(t, true),
  walk: (t) => locomotion(t, false),
  dance,
  swim,
  fly,
  climb,
  catch: catchMotion,
  drink,
  eat,
  cut,
  wash,
  stop
});

export function motionAt(verb, tMs, opts = {}) {
  const motion = MOTIONS[verb];
  if (!motion) throw new RangeError(`Unknown synthetic motion: ${verb}`);
  return motion(Math.max(0, tMs), opts);
}
