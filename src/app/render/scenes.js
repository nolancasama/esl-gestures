const TAU = Math.PI * 2;

function cloud(ctx, x, y, size) {
  ctx.beginPath();
  ctx.arc(x, y, size * 0.32, Math.PI, 0);
  ctx.arc(x + size * 0.35, y - size * 0.18, size * 0.42, Math.PI, 0.12);
  ctx.arc(x + size * 0.78, y, size * 0.3, Math.PI * 1.1, 0);
  ctx.closePath();
  ctx.fill();
}

/** Lightweight context backgrounds. Call behind the video/figure. */
export function drawContextScene(ctx, verb, bounds, alpha = 1, t = 0) {
  if (!(alpha > 0) || !verb) return;
  const { x, y, width, height } = bounds;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  if (verb === 'swim') {
    ctx.fillStyle = 'rgba(52, 174, 219, .35)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = 'rgba(211, 247, 255, .8)';
    ctx.lineWidth = Math.max(2, width * 0.004);
    for (let row = 0; row < 5; row += 1) {
      ctx.beginPath();
      const baseY = y + height * (0.25 + row * 0.16);
      for (let px = 0; px <= width; px += 16) {
        const py = baseY + Math.sin(px / 42 + t / 500 + row) * 5;
        if (px === 0) ctx.moveTo(x + px, py); else ctx.lineTo(x + px, py);
      }
      ctx.stroke();
    }
  } else if (verb === 'fly') {
    const gradient = ctx.createLinearGradient(0, y, 0, y + height);
    gradient.addColorStop(0, '#8edbff');
    gradient.addColorStop(1, '#e8f9ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = 'rgba(255,255,255,.82)';
    cloud(ctx, x + width * 0.12, y + height * 0.22, width * 0.14);
    cloud(ctx, x + width * 0.7, y + height * 0.34, width * 0.18);
  } else if (verb === 'climb') {
    ctx.fillStyle = '#d8c9b2';
    ctx.fillRect(x, y, width, height);
    for (let row = 0; row < 6; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const cx = x + width * (0.12 + col * 0.2) + (row % 2) * width * 0.05;
        const cy = y + height * (0.1 + row * 0.17);
        ctx.fillStyle = ['#ee6c4d', '#4b83c3', '#f3b33d'][((row * 5 + col) % 3)];
        ctx.beginPath();
        ctx.ellipse(cx, cy, 10 + (col % 2) * 5, 6 + (row % 2) * 4, col, 0, TAU);
        ctx.fill();
      }
    }
  } else if (verb === 'run') {
    ctx.fillStyle = '#c86d55';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = Math.max(3, width * 0.006);
    for (let i = 1; i < 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x, y + height * i / 5);
      ctx.lineTo(x + width, y + height * i / 5);
      ctx.stroke();
    }
  } else if (verb === 'walk') {
    ctx.fillStyle = '#acd68a';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = '#e8d6a8';
    ctx.beginPath();
    ctx.moveTo(x + width * 0.35, y + height);
    ctx.quadraticCurveTo(x + width * 0.65, y + height * 0.5, x + width * 0.43, y);
    ctx.lineTo(x + width * 0.62, y);
    ctx.quadraticCurveTo(x + width * 0.8, y + height * 0.55, x + width * 0.72, y + height);
    ctx.closePath();
    ctx.fill();
  } else if (verb === 'dance') {
    ctx.fillStyle = '#33235c';
    ctx.fillRect(x, y, width, height);
    for (let i = 0; i < 24; i += 1) {
      const pulse = 0.55 + 0.45 * Math.sin(t / 220 + i * 1.7);
      ctx.fillStyle = `hsla(${(i * 47 + t / 20) % 360}, 85%, 65%, ${pulse})`;
      ctx.beginPath();
      ctx.arc(x + ((i * 83) % 100) / 100 * width, y + ((i * 37) % 100) / 100 * height, 3 + (i % 3) * 2, 0, TAU);
      ctx.fill();
    }
  } else if (verb === 'jump') {
    ctx.fillStyle = '#dff4ff';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = '#4b556b';
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height * 0.88, width * 0.27, height * 0.065, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#f2cc53';
    ctx.lineWidth = Math.max(4, width * 0.01);
    ctx.stroke();
  } else if (verb === 'wash') {
    ctx.fillStyle = '#dff8ff';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = '#e9eef0';
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height * 0.85, width * 0.3, height * 0.11, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#6e8f9c';
    ctx.lineWidth = Math.max(3, width * 0.007);
    ctx.stroke();
  }
  ctx.restore();
}

function cup(ctx, point, state, size) {
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(state.tilt || 0);
  ctx.fillStyle = '#35b7df';
  ctx.strokeStyle = '#12354c';
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.beginPath();
  ctx.roundRect(-size * 0.44, -size * 0.55, size * 0.88, size, size * 0.12);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size * 0.47, -size * 0.08, size * 0.3, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.restore();
}

function onigiri(ctx, point, state, size) {
  ctx.fillStyle = '#fffbea';
  ctx.strokeStyle = '#27354a';
  ctx.lineWidth = Math.max(2, size * 0.08);
  ctx.beginPath();
  ctx.moveTo(point.x, point.y - size * 0.65);
  ctx.quadraticCurveTo(point.x - size * 0.6, point.y + size * 0.35, point.x - size * 0.42, point.y + size * 0.5);
  ctx.lineTo(point.x + size * 0.42, point.y + size * 0.5);
  ctx.quadraticCurveTo(point.x + size * 0.6, point.y + size * 0.35, point.x, point.y - size * 0.65);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#244c38';
  ctx.fillRect(point.x - size * 0.3, point.y + size * 0.08, size * 0.6, size * 0.43);
  ctx.fillStyle = '#f4c6b8';
  for (let i = 0; i < (state.biteCount || 0); i += 1) {
    ctx.beginPath();
    ctx.arc(point.x + size * (0.36 - i * 0.14), point.y - size * (0.34 - i * 0.12), size * 0.11, 0, TAU);
    ctx.fill();
  }
}

/** Draw core prop snapshots. Positions are in shoulder-relative units. */
export function drawPropState(ctx, verb, state, mapNorm, options = {}) {
  if (!state || state.visible === false || typeof mapNorm !== 'function') return;
  const size = options.size ?? 42;
  ctx.save();
  if (verb === 'drink' && Number.isFinite(state.x)) {
    cup(ctx, mapNorm(state), state, size);
  } else if (verb === 'eat' && Number.isFinite(state.x)) {
    onigiri(ctx, mapNorm(state), state, size);
  } else if (verb === 'cut') {
    const board = state.board || { centerX: 0, centerY: 0.95, halfWidth: 1.3, minY: 0.3, maxY: 1.6 };
    const topLeft = mapNorm({ x: board.centerX - board.halfWidth, y: board.minY });
    const bottomRight = mapNorm({ x: board.centerX + board.halfWidth, y: board.maxY });
    ctx.fillStyle = '#d69752';
    ctx.strokeStyle = '#704421';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#70a94e';
    ctx.beginPath();
    ctx.ellipse((topLeft.x + bottomRight.x) / 2, (topLeft.y + bottomRight.y) / 2, size * 0.7, size * 0.26, 0, 0, TAU);
    ctx.fill();
    for (const slice of state.slices || []) {
      const at = mapNorm({ x: slice.x, y: board.centerY });
      ctx.strokeStyle = '#e7f0cb';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(at.x, at.y - size * 0.25);
      ctx.lineTo(at.x, at.y + size * 0.25);
      ctx.stroke();
    }
    if (state.knife?.visible) {
      const at = mapNorm(state.knife);
      ctx.strokeStyle = '#eef7fa';
      ctx.lineWidth = Math.max(6, size * 0.18);
      ctx.beginPath();
      ctx.moveTo(at.x - size * 0.75, at.y + size * 0.12);
      ctx.lineTo(at.x, at.y);
      ctx.stroke();
      ctx.strokeStyle = '#563b2e';
      ctx.beginPath();
      ctx.moveTo(at.x, at.y);
      ctx.lineTo(at.x + size * 0.38, at.y - size * 0.15);
      ctx.stroke();
    }
  } else if (verb === 'catch' && state.ball) {
    const at = mapNorm(state.ball);
    ctx.globalAlpha *= state.ball.alpha ?? 1;
    ctx.fillStyle = '#ff8538';
    ctx.strokeStyle = '#833719';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(at.x, at.y, size * 0.44, 0, TAU);
    ctx.fill();
    ctx.stroke();
  } else if (verb === 'wash') {
    ctx.strokeStyle = '#a5ecff';
    ctx.lineWidth = 3;
    for (const bubble of state.bubbles || []) {
      const at = mapNorm(bubble);
      ctx.globalAlpha = bubble.alpha ?? 1;
      ctx.beginPath();
      ctx.arc(at.x, at.y - (1 - (bubble.alpha ?? 1)) * size, size * (0.12 + (bubble.id % 4) * 0.06), 0, TAU);
      ctx.stroke();
    }
  }
  ctx.restore();
}

