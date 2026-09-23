'use strict';

// Everything drawn in code, in world units (the world is 400 wide).
// Two plateaus with a cake each, a ridge in front of each cake, and a pond
// between the cliffs where the capybara waits.

const OUTLINE = '#4a2a35';
const GROUND = 520; // plateau height (y grows downwards)
const WATER_Y = 672;
const POND_L = 173; // where the cliffs meet the water
const POND_R = 227;
const CAKE_W = 92;
const CAKE_H = 76;
const CANDY = ['#ff5c9a', '#ffd84d', '#5cc8ff', '#7ee07e', '#b98cff', '#ff3b5c', '#ff9a4d'];

// ---------- Terrain ----------
function groundHalf(x) {
  if (x < 124) return GROUND;
  if (x < 160) {
    const t = (x - 124) / 36; // ridge rising towards the middle
    return GROUND - 40 * (0.5 - 0.5 * Math.cos(Math.PI * t));
  }
  if (x < 174) {
    const t = (x - 160) / 14; // cliff down to the pond
    return 480 + 220 * t * t;
  }
  return 700;
}

function groundY(x) {
  if (x < 0 || x > 400) return GROUND;
  return x <= 200 ? groundHalf(x) : groundHalf(400 - x);
}

function isWater(x, y) {
  return y > WATER_Y && x > POND_L && x < POND_R;
}

function drawSky(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#8fd3ff');
  g.addColorStop(1, '#e9f8ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawBackdrop(ctx, time) {
  // distant hills
  ctx.fillStyle = '#c4ead0';
  for (const [x, y, rx, ry] of [[40, 470, 160, 90], [230, 480, 190, 110], [420, 465, 170, 95]]) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, Math.PI, 0);
    ctx.fill();
  }
  // drifting clouds
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  [[60, 230, 1], [250, 280, 0.8], [380, 210, 0.9]].forEach(([x0, y, s], i) => {
    const x = ((x0 + time * (6 + i * 2)) % 520) - 60;
    ctx.beginPath();
    ctx.arc(x, y, 14 * s, 0, Math.PI * 2);
    ctx.arc(x + 16 * s, y - 7 * s, 17 * s, 0, Math.PI * 2);
    ctx.arc(x + 34 * s, y, 13 * s, 0, Math.PI * 2);
    ctx.fill();
  });
}

function terrainPath(ctx) {
  ctx.moveTo(-600, 2000);
  ctx.lineTo(-600, GROUND);
  for (let x = 0; x <= 400; x += 2) ctx.lineTo(x, groundY(x));
  ctx.lineTo(1000, GROUND);
  ctx.lineTo(1000, 2000);
  ctx.closePath();
}

function drawTerrain(ctx) {
  ctx.beginPath();
  terrainPath(ctx);
  ctx.fillStyle = '#7a5236';
  ctx.fill();

  // darker soil layers
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(60, 35, 20, 0.25)';
  ctx.lineWidth = 5;
  for (let y = GROUND + 30; y < 760; y += 34) {
    ctx.beginPath();
    for (let x = -600; x <= 1000; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.05 + y) * 4);
    ctx.stroke();
  }
  ctx.restore();

  // grass on top
  ctx.beginPath();
  ctx.moveTo(-600, GROUND);
  for (let x = 0; x <= 400; x += 2) {
    const y = groundY(x);
    if (x > 161 && x < 239) {
      // no grass down the cliffs
      if (x + 2 >= 239) ctx.moveTo(x + 2, groundY(x + 2));
      continue;
    }
    ctx.lineTo(x, y);
  }
  ctx.lineTo(1000, GROUND);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#5bb33f';
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.strokeStyle = '#8fdc6a';
  ctx.lineWidth = 3;
  ctx.stroke();

  // a few flowers on the ridges
  for (const x of [128, 140, 262, 276]) {
    const y = groundY(x) - 5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd84d';
    ctx.beginPath();
    ctx.arc(x, y, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWater(ctx, time) {
  ctx.fillStyle = 'rgba(70, 175, 230, 0.88)';
  ctx.beginPath();
  ctx.moveTo(POND_L, 710);
  for (let x = POND_L; x <= POND_R; x += 2) ctx.lineTo(x, WATER_Y + Math.sin(x * 0.3 + time * 3) * 1.5);
  ctx.lineTo(POND_R, 710);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = POND_L; x <= POND_R; x += 2) ctx.lineTo(x, WATER_Y + Math.sin(x * 0.3 + time * 3) * 1.5);
  ctx.stroke();
}

// ---------- Cake (local coords, CAKE_W × CAKE_H box) ----------
function cakePath(ctx) {
  ctx.moveTo(0, 22);
  ctx.lineTo(0, 62);
  ctx.arcTo(0, 72, 10, 72, 10);
  ctx.lineTo(82, 72);
  ctx.arcTo(92, 72, 92, 62, 10);
  ctx.lineTo(92, 22);
  ctx.ellipse(46, 16, 46, 11, 0, 0, Math.PI, true);
  ctx.closePath();
}

function drawCakeBase(ctx) {
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.ellipse(46, 72, 54, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#e3f1ff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  ctx.beginPath();
  cakePath(ctx);
  ctx.fillStyle = '#fff3e0';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(230, 190, 150, 0.35)'; // side shading
  ctx.fillRect(70, 0, 30, 80);
  ctx.restore();
  ctx.lineWidth = 3.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(46, 16, 46, 11, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawFlag(ctx, color) {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(78, 18);
  ctx.lineTo(78, -14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(78, -14);
  ctx.lineTo(96, -8);
  ctx.lineTo(78, -2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ---------- Launcher: a little piping-bag cannon ----------
function drawLauncher(ctx, x, y, angle, color, recoil, active) {
  ctx.save();
  ctx.translate(x, y);
  if (active) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(0, -4, 16, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.rotate(angle);
  ctx.translate(-recoil * 5, 0);
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.lineTo(14, -4);
  ctx.lineTo(22, -2.5);
  ctx.lineTo(22, 2.5);
  ctx.lineTo(14, 4);
  ctx.lineTo(-6, 6);
  ctx.quadraticCurveTo(-11, 0, -6, -6);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUTLINE;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = '#d9dde3'; // metal nozzle
  ctx.fillRect(18, -3, 6, 6);
  ctx.strokeRect(18, -3, 6, 6);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(x, y + 3, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#6b4a3a';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

// ---------- Pieces ----------
function drawPiece(ctx, p) {
  switch (p.kind) {
    case 'sprinkle': {
      const cx = Math.cos(p.rot) * 3.2;
      const cy = Math.sin(p.rot) * 3.2;
      ctx.lineCap = 'round';
      ctx.lineWidth = 2.3;
      ctx.strokeStyle = 'rgba(70, 25, 45, 0.25)';
      ctx.beginPath();
      ctx.moveTo(p.x - cx + 0.5, p.y - cy + 0.7);
      ctx.lineTo(p.x + cx + 0.5, p.y + cy + 0.7);
      ctx.stroke();
      ctx.strokeStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(p.x - cx, p.y - cy);
      ctx.lineTo(p.x + cx, p.y + cy);
      ctx.stroke();
      break;
    }
    case 'ball': {
      ctx.fillStyle = '#c98a12';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffc93c';
      ctx.beginPath();
      ctx.arc(p.x - 0.6, p.y - 0.6, p.r * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff6c9';
      ctx.beginPath();
      ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'blob': {
      ctx.fillStyle = '#6b3a26';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      for (let i = 0; i < 5; i++) {
        const a = p.seed + i * 1.26;
        const d = p.r * 0.95;
        ctx.moveTo(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
        ctx.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, p.r * 0.38, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 230, 210, 0.3)';
      ctx.beginPath();
      ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.25, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'drip': {
      const tip = p.y + p.len;
      ctx.lineCap = 'round';
      ctx.lineWidth = p.w;
      ctx.strokeStyle = '#6b3a26';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, tip);
      ctx.stroke();
      ctx.fillStyle = '#6b3a26';
      ctx.beginPath();
      ctx.arc(p.x, tip, p.w * 0.72, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'puddle': {
      ctx.fillStyle = '#6b3a26';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r * 1.5, p.r * 0.45, p.rot, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}

// Weapon button icons, 40×40 box.
const WEAPON_ICONS = {
  sprinkles(ctx) {
    [[12, 13, 0.6, 0], [26, 11, 2.2, 1], [20, 22, 1.1, 2], [11, 29, 2.6, 4], [29, 28, 0.2, 6]].forEach(
      ([x, y, rot, c]) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1.6, 1.6);
        drawPiece(ctx, { kind: 'sprinkle', x: 0, y: 0, rot, color: CANDY[c] });
        ctx.restore();
      }
    );
  },
  chocoball(ctx) {
    drawPiece(ctx, { kind: 'ball', x: 20, y: 20, r: 12 });
  },
  drip(ctx) {
    ctx.save();
    ctx.translate(20, 16);
    ctx.scale(1.4, 1.4);
    drawPiece(ctx, { kind: 'drip', x: -4, y: 0, len: 12, w: 4 });
    drawPiece(ctx, { kind: 'drip', x: 5, y: 0, len: 7, w: 3.5 });
    drawPiece(ctx, { kind: 'blob', x: 0, y: 0, r: 7, seed: 0.4 });
    ctx.restore();
  },
};

// ---------- Capybara (faces right at facing = 1) ----------
//   opts: facing (1 / -1), s (scale), mouth (0..1 open), blink, happy
function drawCapybara(ctx, x, y, opts) {
  const { facing = 1, s = 1, mouth = 0, blink = false, happy = false } = opts;
  const FUR = '#b07a4c';
  const DARK = '#8a5a35';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5;

  // legs
  ctx.fillStyle = DARK;
  for (const lx of [-20, -8, 10, 20]) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(lx - 4, -8, 8, 10, 3) : ctx.rect(lx - 4, -8, 8, 10);
    ctx.fill();
    ctx.stroke();
  }

  // body
  ctx.beginPath();
  ctx.ellipse(-4, -22, 32, 19, 0, 0, Math.PI * 2);
  ctx.fillStyle = FUR;
  ctx.fill();
  ctx.stroke();

  // lower jaw (opens when eating)
  if (mouth > 0.05) {
    ctx.beginPath();
    ctx.moveTo(28, -24);
    ctx.lineTo(46, -24 + mouth * 8);
    ctx.lineTo(44, -16 + mouth * 9);
    ctx.lineTo(26, -17);
    ctx.closePath();
    ctx.fillStyle = DARK;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e07a8a';
    ctx.beginPath();
    ctx.ellipse(38, -23 + mouth * 4, 6, 2 + mouth * 2, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // big blocky head
  ctx.beginPath();
  ctx.moveTo(14, -46);
  ctx.lineTo(40, -44);
  ctx.quadraticCurveTo(50, -43, 50, -33);
  ctx.lineTo(49, -27);
  ctx.quadraticCurveTo(48, -21 - mouth * 3, 40, -21 - mouth * 3);
  ctx.lineTo(18, -18);
  ctx.quadraticCurveTo(8, -30, 14, -46);
  ctx.fillStyle = FUR;
  ctx.fill();
  ctx.stroke();

  // ear
  ctx.beginPath();
  ctx.ellipse(17, -46, 4.5, 3.5, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = DARK;
  ctx.fill();
  ctx.stroke();

  // eye
  ctx.fillStyle = OUTLINE;
  if (happy) {
    ctx.beginPath();
    ctx.arc(31, -35, 3, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  } else if (blink) {
    ctx.beginPath();
    ctx.moveTo(28, -35);
    ctx.lineTo(34, -35);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(31, -36, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // nostril + cheek
  ctx.beginPath();
  ctx.ellipse(46, -35, 1.6, 2.4, 0.3, 0, Math.PI * 2);
  ctx.fill();
  if (happy) {
    ctx.fillStyle = 'rgba(255, 120, 150, 0.5)';
    ctx.beginPath();
    ctx.arc(34, -27, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // a little orange on its head
  ctx.beginPath();
  ctx.arc(24, -52, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#ff9a2e';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(27, -58.5, 3.5, 1.8, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = '#6cc24a';
  ctx.fill();

  ctx.restore();
}
