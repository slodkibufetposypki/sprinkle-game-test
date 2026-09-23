'use strict';

// Everything drawn in code, in world units. The world is 800 × 450 (landscape):
// a cake castle on each river bank, a wooden cannon tower in front of each,
// and the king capybara sitting in the river between them.

const OUTLINE = '#4a2a35';
const WORLD_W = 800;
const WORLD_H = 450;
const GROUND = 350; // bank height (y grows downwards)
const RIVERBED = 432;
const WATER_Y = 386;
const CASTLE_W = 150;
const CASTLE_H = 190;
const CANDY = ['#ff5c9a', '#ffd84d', '#5cc8ff', '#7ee07e', '#b98cff', '#ff3b5c', '#ff9a4d'];
const GLITTER = ['#ffe07a', '#fff6c9', '#ffd1f0', '#ffffff', '#ffc93c'];
const PINK_ICING = '#ff7eb6';

// Castle tiers in castle-local coords (castle box is CASTLE_W × CASTLE_H).
const TIERS = [
  { x: 0, y: 120, w: 150, h: 70 },
  { x: 19, y: 62, w: 112, h: 58 },
  { x: 38, y: 18, w: 74, h: 44 },
];

// ---------- Terrain ----------
function groundHalf(x) {
  if (x < 290) return GROUND;
  if (x < 328) {
    const t = (x - 290) / 38; // bank sloping into the river
    return GROUND + (RIVERBED - GROUND) * (0.5 - 0.5 * Math.cos(Math.PI * t));
  }
  return RIVERBED;
}

function groundY(x) {
  if (x < 0 || x > WORLD_W) return GROUND;
  return x <= WORLD_W / 2 ? groundHalf(x) : groundHalf(WORLD_W - x);
}

// where the banks meet the water surface
const RIVER_L = (() => {
  let x = 290;
  while (groundHalf(x) < WATER_Y) x += 0.5;
  return x;
})();
const RIVER_R = WORLD_W - RIVER_L;

function isWater(x, y) {
  return y > WATER_Y && x > RIVER_L && x < RIVER_R;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function outlined(ctx, fill, width = 2.5) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

// ---------- Static scenery (baked once per resize) ----------
function drawSky(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#6ec3ff');
  g.addColorStop(0.6, '#bfe6ff');
  g.addColorStop(1, '#fff1e6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function cloud(ctx, x, y, s) {
  ctx.beginPath();
  ctx.arc(x, y, 14 * s, 0, Math.PI * 2);
  ctx.arc(x + 16 * s, y - 8 * s, 18 * s, 0, Math.PI * 2);
  ctx.arc(x + 36 * s, y - 2 * s, 15 * s, 0, Math.PI * 2);
  ctx.arc(x + 50 * s, y + 4 * s, 10 * s, 0, Math.PI * 2);
  ctx.rect(x, y, 50 * s, 12 * s);
  ctx.fill();
}

function drawBackdrop(ctx) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  cloud(ctx, 60, 60, 1.1);
  cloud(ctx, 520, 40, 0.9);
  cloud(ctx, 720, 90, 0.8);
  cloud(ctx, -180, 90, 1);
  cloud(ctx, 900, 50, 1);

  // candy mountains with cream caps
  for (const [x, peak, w] of [[-120, 150, 180], [60, 175, 150], [230, 130, 170], [560, 140, 170], [740, 165, 160], [920, 150, 180]]) {
    ctx.beginPath();
    ctx.moveTo(x - w, 330);
    ctx.quadraticCurveTo(x - w * 0.3, peak - 10, x, peak);
    ctx.quadraticCurveTo(x + w * 0.3, peak - 10, x + w, 330);
    ctx.closePath();
    ctx.fillStyle = '#e9b8a6';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#fff6ea';
    ctx.beginPath();
    ctx.moveTo(x - w, peak + 30);
    for (let i = 0; i <= 10; i++) {
      const px = x - w + (i / 10) * w * 2;
      ctx.lineTo(px, peak + 26 + (i % 2 ? 14 : 0));
    }
    ctx.lineTo(x + w, peak - 40);
    ctx.lineTo(x - w, peak - 40);
    ctx.fill();
    ctx.restore();
  }

  // distant cake castle on a hill
  ctx.fillStyle = '#9fd48b';
  ctx.beginPath();
  ctx.ellipse(400, 300, 150, 70, 0, Math.PI, 0);
  ctx.fill();
  const TOWER = '#fff3ea';
  const ROOF = '#ff9cc5';
  for (const [x, y, w, h] of [[370, 200, 60, 50], [352, 215, 16, 35], [432, 215, 16, 35], [388, 180, 24, 22]]) {
    ctx.fillStyle = TOWER;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = ROOF;
    ctx.beginPath();
    ctx.moveTo(x - 3, y);
    ctx.lineTo(x + w / 2, y - Math.max(12, w * 0.6));
    ctx.lineTo(x + w + 3, y);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(160, 110, 110, 0.5)';
  ctx.fillRect(393, 232, 14, 18);

  // green rolling hills
  ctx.fillStyle = '#8fd07a';
  for (const [x, rx, ry] of [[-100, 260, 60], [150, 220, 45], [650, 220, 45], [900, 260, 60]]) {
    ctx.beginPath();
    ctx.ellipse(x, 335, rx, ry, 0, Math.PI, 0);
    ctx.fill();
  }
  // lollipop trees
  for (const [x, y, c] of [[250, 300, '#ff9cc5'], [275, 306, '#7ee07e'], [525, 302, '#ffd84d'], [548, 298, '#ff9cc5']]) {
    ctx.fillStyle = '#c9a27a';
    ctx.fillRect(x - 1.5, y, 3, 22);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

function terrainPath(ctx) {
  ctx.moveTo(-600, 1200);
  ctx.lineTo(-600, GROUND);
  for (let x = 0; x <= WORLD_W; x += 2) ctx.lineTo(x, groundY(x));
  ctx.lineTo(1400, GROUND);
  ctx.lineTo(1400, 1200);
  ctx.closePath();
}

function drawTerrain(ctx) {
  ctx.beginPath();
  terrainPath(ctx);
  ctx.fillStyle = '#7fcf5f';
  ctx.fill();
  ctx.save();
  ctx.clip();
  // dirt edge along the river banks
  ctx.fillStyle = '#9a6a45';
  ctx.beginPath();
  for (let x = 270; x <= 530; x += 2) ctx.lineTo(x, groundY(x) + 4);
  ctx.lineTo(530, 1200);
  ctx.lineTo(270, 1200);
  ctx.fill();
  // grass tufts
  ctx.fillStyle = '#6bbd4c';
  for (let x = -560; x < 1380; x += 23) {
    const y = groundY(x) + 12 + ((x * 7) % 30);
    if (x > 280 && x < 520) continue;
    ctx.beginPath();
    ctx.ellipse(x, y, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // grass edge on top
  ctx.beginPath();
  ctx.moveTo(-600, GROUND);
  for (let x = 0; x <= WORLD_W; x += 2) ctx.lineTo(x, groundY(x));
  ctx.lineTo(1400, GROUND);
  ctx.strokeStyle = '#5fb043';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // flowers
  for (const [x, c] of [[12, '#ff9cc5'], [230, '#ffffff'], [262, '#ffd84d'], [540, '#ffffff'], [566, '#ff9cc5'], [790, '#ffd84d']]) {
    const y = groundY(x) + 10;
    ctx.fillStyle = c;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(x + Math.cos(i * 1.26) * 3, y + Math.sin(i * 1.26) * 3, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffb238';
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // wooden fence in the foreground corners
  for (const [x0, x1] of [[-300, 40], [760, 1100]]) {
    ctx.fillStyle = '#b57a4a';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    for (let x = x0; x <= x1; x += 34) {
      ctx.beginPath();
      roundRectPath(ctx, x - 5, 392, 10, 50, 3);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    roundRectPath(ctx, x0 - 10, 404, x1 - x0 + 20, 8, 3);
    ctx.fill();
    ctx.stroke();
  }
}

// Wooden cannon tower in front of each castle (side: 0 left, 1 right).
function drawTower(ctx, side) {
  const cx = side === 0 ? 212 : WORLD_W - 212;
  ctx.strokeStyle = OUTLINE;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#a8703f';
  for (const dx of [-20, 18]) {
    ctx.beginPath();
    roundRectPath(ctx, cx + dx - 3, 252, 6, GROUND - 252 + 2, 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.strokeStyle = '#7d5230';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 18, 262);
  ctx.lineTo(cx + 16, 340);
  ctx.moveTo(cx + 16, 262);
  ctx.lineTo(cx - 18, 340);
  ctx.stroke();
  ctx.beginPath();
  roundRectPath(ctx, cx - 30, 248, 60, 8, 2);
  ctx.fillStyle = '#c28a52';
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ---------- River (animated) ----------
const LILIES = [[352, 406, 9], [372, 418, 7], [447, 404, 8], [430, 422, 6]];

function drawRiver(ctx, time) {
  const g = ctx.createLinearGradient(0, WATER_Y, 0, RIVERBED);
  g.addColorStop(0, 'rgba(90, 205, 235, 0.9)');
  g.addColorStop(1, 'rgba(40, 150, 210, 0.95)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(RIVER_L - 2, WATER_Y);
  for (let x = RIVER_L; x <= RIVER_R; x += 4) ctx.lineTo(x, WATER_Y + Math.sin(x * 0.12 + time * 2.5) * 1.2);
  ctx.lineTo(RIVER_R + 2, WATER_Y);
  for (let x = RIVER_R; x >= RIVER_L; x -= 4) ctx.lineTo(x, Math.max(WATER_Y, groundY(x)) + 1);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    const x = RIVER_L + 15 + ((i * 37 + time * 12) % (RIVER_R - RIVER_L - 30));
    const y = WATER_Y + 8 + (i % 3) * 10;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 10, y);
    ctx.stroke();
  }

  for (const [x, y, r] of LILIES) {
    ctx.fillStyle = '#5cb85c';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, 0.3, Math.PI * 2 - 0.1);
    ctx.closePath();
    ctx.fill();
  }
  for (const [x, y] of [[372, 414], [447, 400]]) {
    ctx.fillStyle = '#ff9cc5';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(x + i * 3, y - 3, 2.4, 5, i * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---------- Cake castle (castle-local coords) ----------
function castlePath(ctx) {
  for (const t of TIERS) roundRectPath(ctx, t.x, t.y, t.w, t.h, 8);
  ctx.moveTo(TIERS[2].x + TIERS[2].w, TIERS[2].y + 2);
  ctx.ellipse(75, TIERS[2].y + 2, TIERS[2].w / 2, 9, 0, 0, Math.PI * 2);
}

// side: 0 = left castle (banner on the left), 1 = right castle
function drawCastle(ctx, color, side) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // banner on the outer side
  const bx = side === 0 ? -16 : CASTLE_W + 2;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(bx + 7, 40);
  ctx.lineTo(bx + 7, 190);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx, 60);
  ctx.lineTo(bx + 14, 60);
  ctx.lineTo(bx + 14, 118);
  ctx.lineTo(bx + 7, 110);
  ctx.lineTo(bx, 118);
  ctx.closePath();
  outlined(ctx, color, 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(bx + 4, 78, 6, 5);
  ctx.fillRect(bx + 3, 83, 8, 5);

  // board under the castle
  ctx.beginPath();
  ctx.ellipse(75, 189, 84, 5, 0, 0, Math.PI * 2);
  outlined(ctx, '#e3f1ff', 2);

  // sponge tiers, bottom to top
  for (const t of TIERS) {
    ctx.beginPath();
    roundRectPath(ctx, t.x, t.y, t.w, t.h, 8);
    const g = ctx.createLinearGradient(t.x, 0, t.x + t.w, 0);
    g.addColorStop(0, '#f7d493');
    g.addColorStop(0.7, '#f1c47a');
    g.addColorStop(1, '#dca663');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // airy sponge texture
    ctx.fillStyle = 'rgba(190, 130, 70, 0.28)';
    for (let i = 0; i < t.w * t.h * 0.004; i++) {
      const px = t.x + ((i * 37.7) % t.w);
      const py = t.y + 12 + ((i * 23.3) % (t.h - 16));
      ctx.beginPath();
      ctx.arc(px, py, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    // cream filling at the top of the tier
    ctx.fillStyle = '#fff6e8';
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(t.x + t.w, t.y);
    ctx.lineTo(t.x + t.w, t.y + 8);
    for (let x = t.x + t.w; x >= t.x; x -= 8) ctx.lineTo(x, t.y + 8 + (Math.round(x / 8) % 2 ? 3 : 0));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    roundRectPath(ctx, t.x, t.y, t.w, t.h, 8);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }

  // cream dome on top
  const top = TIERS[2];
  ctx.beginPath();
  ctx.ellipse(75, top.y + 2, top.w / 2, 9, 0, 0, Math.PI * 2);
  outlined(ctx, '#fff6e8', 2.5);

  // flags
  for (const fx of [50, 100]) {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fx, top.y);
    ctx.lineTo(fx, top.y - 30);
    ctx.stroke();
    ctx.beginPath();
    const dir = side === 0 ? 1 : -1;
    ctx.moveTo(fx, top.y - 30);
    ctx.lineTo(fx + 16 * dir, top.y - 25);
    ctx.lineTo(fx, top.y - 19);
    ctx.closePath();
    outlined(ctx, color, 1.5);
  }
}

// ---------- Cannon ----------
function drawCannon(ctx, x, y, angle, color, recoil, active) {
  if (active) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.translate(-recoil * 6, 0);
  ctx.beginPath();
  roundRectPath(ctx, -10, -7, 34, 14, 6);
  outlined(ctx, '#3e4452', 2);
  ctx.beginPath();
  roundRectPath(ctx, 20, -9, 8, 18, 3);
  outlined(ctx, '#565e70', 2);
  ctx.fillStyle = color;
  ctx.fillRect(2, -7, 6, 14);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(-6, -5, 26, 3);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y + 5, 7, 0, Math.PI * 2);
  outlined(ctx, '#8a5a35', 2);
  ctx.beginPath();
  ctx.arc(x, y + 5, 2, 0, Math.PI * 2);
  ctx.fillStyle = OUTLINE;
  ctx.fill();
}

// Signpost on the bank pointing at the tastier cake (dir -1 / 1).
function drawSign(ctx, x, dir) {
  const y = groundY(x);
  ctx.fillStyle = '#a8703f';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  roundRectPath(ctx, x - 3, y - 34, 6, 36, 2);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.translate(x, y - 40);
  ctx.scale(dir || 1, 1);
  ctx.beginPath();
  ctx.moveTo(-20, -9);
  ctx.lineTo(12, -9);
  ctx.lineTo(22, 0);
  ctx.lineTo(12, 9);
  ctx.lineTo(-20, 9);
  ctx.closePath();
  outlined(ctx, '#c9935c', 2);
  // tiny cake on the sign
  ctx.fillStyle = '#fff6e8';
  ctx.fillRect(-11, -3, 11, 7);
  ctx.fillStyle = PINK_ICING;
  ctx.fillRect(-11, -4, 11, 2.5);
  ctx.restore();
}

// ---------- Pieces ----------
function drawPiece(ctx, p) {
  switch (p.kind) {
    case 'sprinkle': {
      const cx = Math.cos(p.rot) * 3.4;
      const cy = Math.sin(p.rot) * 3.4;
      ctx.lineCap = 'round';
      ctx.lineWidth = 2.4;
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
    case 'glitter': {
      const s = p.size || 1.6;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - s * 1.6);
      ctx.lineTo(p.x + s * 0.5, p.y - s * 0.5);
      ctx.lineTo(p.x + s * 1.6, p.y);
      ctx.lineTo(p.x + s * 0.5, p.y + s * 0.5);
      ctx.lineTo(p.x, p.y + s * 1.6);
      ctx.lineTo(p.x - s * 0.5, p.y + s * 0.5);
      ctx.lineTo(p.x - s * 1.6, p.y);
      ctx.lineTo(p.x - s * 0.5, p.y - s * 0.5);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'ball': {
      ctx.fillStyle = '#b47a0e';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffc93c';
      ctx.beginPath();
      ctx.arc(p.x - 0.6, p.y - 0.6, p.r * 0.82, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff6c9';
      ctx.beginPath();
      ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'blob': {
      ctx.fillStyle = PINK_ICING;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      for (let i = 0; i < 5; i++) {
        const a = p.seed + i * 1.26;
        const d = p.r * 0.95;
        ctx.moveTo(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
        ctx.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, p.r * 0.38, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.25, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'drip': {
      const tip = p.y + p.len;
      ctx.lineCap = 'round';
      ctx.lineWidth = p.w;
      ctx.strokeStyle = PINK_ICING;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, tip);
      ctx.stroke();
      ctx.fillStyle = PINK_ICING;
      ctx.beginPath();
      ctx.arc(p.x, tip, p.w * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = p.w * 0.25;
      ctx.beginPath();
      ctx.moveTo(p.x - p.w * 0.2, p.y + 1);
      ctx.lineTo(p.x - p.w * 0.2, tip - 1);
      ctx.stroke();
      break;
    }
    case 'puddle': {
      ctx.fillStyle = PINK_ICING;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r * 1.5, p.r * 0.45, p.rot, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'strawberry': {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.beginPath();
      ctx.moveTo(0, 9);
      ctx.bezierCurveTo(-10, 2, -9, -8, 0, -7);
      ctx.bezierCurveTo(9, -8, 10, 2, 0, 9);
      outlined(ctx, '#ff3b5c', 1.5);
      ctx.fillStyle = '#ffe07a';
      for (const [sx, sy] of [[-3, -2], [3, -2], [0, 2], [-4, 3], [4, 3], [0, -4]]) {
        ctx.beginPath();
        ctx.ellipse(sx, sy, 0.7, 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#5cb85c';
      ctx.beginPath();
      ctx.moveTo(-6, -7);
      ctx.lineTo(0, -4);
      ctx.lineTo(6, -7);
      ctx.lineTo(0, -10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'swirl': {
      ctx.save();
      ctx.translate(p.x, p.y);
      for (const [r, y] of [[9, 3], [7, -3], [4.5, -8]]) {
        ctx.beginPath();
        ctx.ellipse(0, y, r, r * 0.6, 0, 0, Math.PI * 2);
        outlined(ctx, '#fffaf2', 1.5);
      }
      ctx.beginPath();
      ctx.arc(0, -12, 2, 0, Math.PI * 2);
      outlined(ctx, '#fffaf2', 1.5);
      ctx.restore();
      break;
    }
    case 'cherry': {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 4);
      ctx.quadraticCurveTo(p.x + 2, p.y - 12, p.x + 7, p.y - 14);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
      outlined(ctx, '#e8203f', 1.5);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(p.x - 2, p.y - 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}

// Weapon button icons, 40×40 box.
const WEAPON_ICONS = {
  sprinkles(ctx) {
    ctx.save();
    ctx.scale(1.5, 1.5);
    [[9, 9, 0.6, 0], [18, 8, 2.2, 1], [14, 15, 1.1, 2], [8, 19, 2.6, 4], [20, 19, 0.2, 6]].forEach(([x, y, rot, c]) =>
      drawPiece(ctx, { kind: 'sprinkle', x, y, rot, color: CANDY[c] })
    );
    ctx.restore();
  },
  glitter(ctx) {
    drawPiece(ctx, { kind: 'glitter', x: 20, y: 20, size: 8, color: '#ffc93c' });
    drawPiece(ctx, { kind: 'glitter', x: 30, y: 10, size: 3.5, color: '#ffe07a' });
    drawPiece(ctx, { kind: 'glitter', x: 10, y: 30, size: 3, color: '#ff9cc5' });
    drawPiece(ctx, { kind: 'glitter', x: 32, y: 30, size: 2.5, color: '#ffe07a' });
  },
  trio(ctx) {
    drawPiece(ctx, { kind: 'ball', x: 20, y: 12, r: 7 });
    drawPiece(ctx, { kind: 'ball', x: 12, y: 26, r: 7 });
    drawPiece(ctx, { kind: 'ball', x: 28, y: 26, r: 7 });
  },
  drip(ctx) {
    ctx.save();
    ctx.translate(20, 15);
    ctx.scale(1.3, 1.3);
    drawPiece(ctx, { kind: 'drip', x: -5, y: 0, len: 13, w: 4.5 });
    drawPiece(ctx, { kind: 'drip', x: 5, y: 0, len: 8, w: 4 });
    drawPiece(ctx, { kind: 'blob', x: 0, y: 0, r: 7.5, seed: 0.4 });
    ctx.restore();
  },
};

// Little plain cake for the player badges, 40×40 box.
function drawCakeIcon(ctx) {
  ctx.save();
  ctx.translate(5, 5);
  ctx.scale(0.2, 0.16);
  for (const t of TIERS) {
    ctx.beginPath();
    roundRectPath(ctx, t.x, t.y, t.w, t.h, 8);
    ctx.fillStyle = '#f3c77e';
    ctx.fill();
    ctx.fillStyle = '#fff6e8';
    ctx.fillRect(t.x, t.y, t.w, 12);
    ctx.lineWidth = 8;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- Capybara (faces right at facing = 1) ----------
//   opts: facing (1 / -1), s (scale), mouth (0..1 open), blink, happy, crown
function drawCapybara(ctx, x, y, opts) {
  const { facing = 1, s = 1, mouth = 0, blink = false, happy = false, crown = false } = opts;
  const FUR = '#b07a4c';
  const DARK = '#8a5a35';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5;

  ctx.fillStyle = DARK;
  for (const lx of [-20, -8, 10, 20]) {
    ctx.beginPath();
    roundRectPath(ctx, lx - 4, -8, 8, 10, 3);
    ctx.fill();
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.ellipse(-4, -22, 32, 19, 0, 0, Math.PI * 2);
  ctx.fillStyle = FUR;
  ctx.fill();
  ctx.stroke();

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

  ctx.beginPath();
  ctx.ellipse(17, -46, 4.5, 3.5, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = DARK;
  ctx.fill();
  ctx.stroke();

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

  ctx.beginPath();
  ctx.ellipse(46, -35, 1.6, 2.4, 0.3, 0, Math.PI * 2);
  ctx.fill();
  if (happy) {
    ctx.fillStyle = 'rgba(255, 120, 150, 0.5)';
    ctx.beginPath();
    ctx.arc(34, -27, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (crown) {
    ctx.beginPath();
    ctx.moveTo(14, -48);
    ctx.lineTo(13, -62);
    ctx.lineTo(19, -55);
    ctx.lineTo(24, -66);
    ctx.lineTo(29, -55);
    ctx.lineTo(35, -62);
    ctx.lineTo(34, -48);
    ctx.closePath();
    outlined(ctx, '#ffcc33', 2);
    ctx.fillStyle = '#ff5c9a';
    ctx.beginPath();
    ctx.arc(24, -53, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
