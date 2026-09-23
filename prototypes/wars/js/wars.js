'use strict';

// Sprinkle Wars – prototype.
// Two cakes, turn-based shots over the pond. Every hit decorates the ENEMY's
// cake. After the last round the capybara eats the tastiest cake – its owner loses.

// ---------- UI text ----------
const STRINGS = {
  players: ['Pink', 'Blue'],
  turn: (name) => `${name}'s turn`,
  round: (n, total) => `Round ${n}/${total}`,
  hint: 'Pull back and let go to shoot at the other cake',
  yum: (pct) => `Yum ${pct}%`,
  weapons: { sprinkles: 'Sprinkles', chocoball: 'Golden Chocoball', drip: 'Chocolate Drip' },
  hungry: 'The capybara is hungry…',
  wins: (name) => `${name} wins!`,
  ateCake: (name) => `The capybara ate ${name}'s cake – it was too tasty!`,
  draw: 'Draw!',
  ateBoth: 'Both cakes were equally tasty, so the capybara ate both.',
  playAgain: 'Play again',
};

// ---------- Tuning ----------
const PLAYER_COLORS = ['#ff5c9a', '#4db8ff'];
const ROUNDS = 5;
const GRAVITY = 600;
const MAX_SPEED = 520;
const MAX_PULL = 140; // world units of pull for full power
const MIN_PULL = 10;
const PREVIEW_TIME = 0.4; // s of trajectory shown while aiming
const VIEW = { x: 0, y: 170, w: 400, h: 550 };
const CELL = 2; // tastiness grid cell, world units
const MAX_TASTE = 3; // per-cell cap
const PAD = 26; // extra room around the cake layer (flag, drips)
const SUBSTEPS = 3;

const KINDS = {
  sprinkle: { r: 2, bounce: 0.25, friction: 14, stamp: 6, value: 1.5 },
  ball: { r: 5.5, bounce: 0.55, friction: 1.5, stamp: 12, value: 3 },
  blob: { r: 7, bounce: 0, friction: 30, stamp: 14, value: 1.5 },
};

const WEAPONS = {
  sprinkles: { ammo: Infinity, count: 22, kind: 'sprinkle' },
  chocoball: { ammo: 2, count: 1, kind: 'ball' },
  drip: { ammo: 2, count: 1, kind: 'blob' },
};

const LAUNCHERS = [
  { x: 114, y: 511, facing: 1 },
  { x: 286, y: 511, facing: -1 },
];
const CAKE_X = [14, 294];

// capybara stands here to eat cake 0 / cake 1
const EAT_SPOTS = [
  { x: 134, facing: -1 },
  { x: 266, facing: 1 },
];

// ---------- DOM ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const litter = document.createElement('canvas'); // pieces that ended up on the ground
const litterCtx = litter.getContext('2d');

const ui = {
  hud: document.getElementById('hud'),
  turn: document.getElementById('turn'),
  round: document.getElementById('round'),
  banner: document.getElementById('banner'),
  weapons: document.getElementById('weapons'),
  result: document.getElementById('result'),
  resultTitle: document.getElementById('result-title'),
  resultText: document.getElementById('result-text'),
  again: document.getElementById('again'),
};

// ---------- Cake mask (same shape for both cakes) ----------
const MASK_W = Math.ceil(CAKE_W / CELL);
const MASK_H = Math.ceil(CAKE_H / CELL);
const MASK = (() => {
  const c = document.createElement('canvas');
  c.width = MASK_W;
  c.height = MASK_H;
  const m = c.getContext('2d', { willReadFrequently: true });
  m.setTransform(1 / CELL, 0, 0, 1 / CELL, 0, 0);
  m.beginPath();
  cakePath(m);
  m.fill();
  const data = m.getImageData(0, 0, MASK_W, MASK_H).data;
  const mask = new Uint8Array(MASK_W * MASK_H);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 127 ? 1 : 0;
  return mask;
})();
const MASK_TOTAL = MASK.reduce((a, b) => a + b, 0);

// ---------- State ----------
const state = {
  W: 0,
  H: 0,
  dpr: 1,
  scale: 1,
  ox: 0,
  oy: 0,
  time: 0,
  cakes: [],
  turn: 0,
  phase: 'aim', // aim | flight | between | finale | over
  timer: 0,
  weapon: 'sprinkles',
  ammo: [],
  projectiles: [],
  drips: [],
  litterPieces: [],
  fx: [],
  aim: { active: false, id: null, sx: 0, sy: 0, cx: 0, cy: 0 },
  angles: [-0.9, Math.PI + 0.9],
  recoil: [0, 0],
  capy: null,
  squeakAt: 0,
};

function player() {
  return state.turn % 2;
}

function makeCake(owner) {
  const layer = document.createElement('canvas');
  return {
    owner,
    x: CAKE_X[owner],
    y: GROUND - CAKE_H,
    cells: new Float32Array(MASK_W * MASK_H),
    sum: 0,
    stuck: [],
    bites: [],
    eaten: false,
    layer,
    lctx: layer.getContext('2d'),
  };
}

function taste(c) {
  return c.sum / (MASK_TOTAL * MAX_TASTE);
}

function inCake(c, lx, ly) {
  const gx = Math.floor(lx / CELL);
  const gy = Math.floor(ly / CELL);
  if (gx < 0 || gy < 0 || gx >= MASK_W || gy >= MASK_H) return false;
  return MASK[gy * MASK_W + gx] === 1;
}

function stamp(c, lx, ly, radius, value) {
  const r = radius / CELL;
  const cx = lx / CELL;
  const cy = ly / CELL;
  for (let gy = Math.max(0, Math.floor(cy - r)); gy <= Math.min(MASK_H - 1, Math.ceil(cy + r)); gy++) {
    for (let gx = Math.max(0, Math.floor(cx - r)); gx <= Math.min(MASK_W - 1, Math.ceil(cx + r)); gx++) {
      const dx = gx + 0.5 - cx;
      const dy = gy + 0.5 - cy;
      if (dx * dx + dy * dy > r * r) continue;
      const i = gy * MASK_W + gx;
      if (!MASK[i]) continue;
      const next = Math.min(MAX_TASTE, c.cells[i] + value);
      c.sum += next - c.cells[i];
      c.cells[i] = next;
    }
  }
}

// ---------- Setup ----------
function reset() {
  state.cakes = [makeCake(0), makeCake(1)];
  state.turn = 0;
  state.projectiles = [];
  state.drips = [];
  state.litterPieces = [];
  state.fx = [];
  state.ammo = [0, 1].map(() => ({ sprinkles: Infinity, chocoball: WEAPONS.chocoball.ammo, drip: WEAPONS.drip.ammo }));
  state.weapon = 'sprinkles';
  state.capy = { x: 200, y: WATER_Y + 16, look: 0, facing: 1, mouth: 0, happy: false, blinkAt: 2 };
  ui.result.classList.add('hidden');
  layout();
  startTurn(true);
}

function startTurn(first) {
  state.phase = 'aim';
  state.aim.active = false;
  const p = player();
  if (state.ammo[p][state.weapon] <= 0) state.weapon = 'sprinkles';
  ui.turn.textContent = STRINGS.turn(STRINGS.players[p]);
  ui.turn.style.color = PLAYER_COLORS[p];
  ui.round.textContent = STRINGS.round(Math.floor(state.turn / 2) + 1, ROUNDS);
  buildWeapons();
  showBanner(first ? STRINGS.hint : STRINGS.turn(STRINGS.players[p]), first ? '#4a2a35' : PLAYER_COLORS[p]);
}

// ---------- Layout ----------
function layout() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 3);
  state.W = window.innerWidth;
  state.H = window.innerHeight;
  canvas.width = Math.round(state.W * state.dpr);
  canvas.height = Math.round(state.H * state.dpr);

  const top = ui.hud.getBoundingClientRect().bottom + 4;
  const bottom = ui.weapons.getBoundingClientRect().top - 4;
  const availH = Math.max(100, bottom - top);
  state.scale = Math.min(state.W / VIEW.w, availH / VIEW.h);
  state.ox = (state.W - VIEW.w * state.scale) / 2 - VIEW.x * state.scale;
  // pond sits just above the buttons; any extra height becomes sky
  state.oy = bottom - (VIEW.y + VIEW.h) * state.scale;

  const k = state.scale * state.dpr;
  for (const c of state.cakes) {
    c.layer.width = Math.ceil((CAKE_W + PAD * 2) * k);
    c.layer.height = Math.ceil((CAKE_H + PAD * 2) * k);
    redrawCake(c);
  }
  litter.width = Math.ceil(VIEW.w * k);
  litter.height = Math.ceil(VIEW.h * k);
  litterCtx.setTransform(k, 0, 0, k, -VIEW.x * k, -VIEW.y * k);
  for (const p of state.litterPieces) drawPiece(litterCtx, p);
}

function cakeTransform(c) {
  const k = state.scale * state.dpr;
  c.lctx.setTransform(k, 0, 0, k, PAD * k, PAD * k);
}

function redrawCake(c) {
  c.lctx.setTransform(1, 0, 0, 1, 0, 0);
  c.lctx.clearRect(0, 0, c.layer.width, c.layer.height);
  if (c.eaten) return;
  cakeTransform(c);
  drawCakeBase(c.lctx);
  for (const p of c.stuck) drawPiece(c.lctx, p);
  drawFlag(c.lctx, PLAYER_COLORS[c.owner]);
  for (const b of c.bites) biteCake(c, b, false);
}

function biteCake(c, b, remember = true) {
  if (remember) c.bites.push(b);
  c.lctx.save();
  c.lctx.globalCompositeOperation = 'destination-out';
  c.lctx.beginPath();
  c.lctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  c.lctx.arc(b.x + b.r * 0.2, b.y + b.r * 0.85, b.r * 0.7, 0, Math.PI * 2);
  c.lctx.arc(b.x + b.r * 0.1, b.y - b.r * 0.85, b.r * 0.7, 0, Math.PI * 2);
  c.lctx.fill();
  c.lctx.restore();
}

function toWorld(sx, sy) {
  return { x: (sx - state.ox) / state.scale, y: (sy - state.oy) / state.scale };
}

// ---------- Weapons UI ----------
function buildWeapons() {
  ui.weapons.textContent = '';
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const ammo = state.ammo[player()];
  for (const id of Object.keys(WEAPONS)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'weapon-btn';
    btn.setAttribute('aria-label', STRINGS.weapons[id]);
    btn.classList.toggle('active', id === state.weapon);
    btn.disabled = ammo[id] <= 0;

    const icon = document.createElement('canvas');
    icon.width = icon.height = 40 * dpr;
    const ictx = icon.getContext('2d');
    ictx.setTransform(dpr, 0, 0, dpr, 0, 0);
    WEAPON_ICONS[id](ictx);
    btn.appendChild(icon);

    if (ammo[id] !== Infinity) {
      const badge = document.createElement('span');
      badge.className = 'ammo';
      badge.textContent = ammo[id];
      btn.appendChild(badge);
    }

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (state.phase !== 'aim' || ammo[id] <= 0) return;
      state.weapon = id;
      buildWeapons();
      Sfx.play(900, 0.06, 'triangle', 0.1);
    });
    ui.weapons.appendChild(btn);
  }
}

let bannerTimer = 0;
function showBanner(text, color) {
  ui.banner.textContent = text;
  ui.banner.style.color = color;
  ui.banner.classList.remove('show');
  void ui.banner.offsetWidth;
  ui.banner.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => ui.banner.classList.remove('show'), 1800);
}

// ---------- Aiming ----------
function muzzle(p, angle) {
  const L = LAUNCHERS[p];
  return { x: L.x + Math.cos(angle) * 22, y: L.y + Math.sin(angle) * 22 };
}

// Launch velocity from the current pull (null when the pull is too short).
function aimVelocity() {
  const a = state.aim;
  const dx = (a.sx - a.cx) / state.scale;
  const dy = (a.sy - a.cy) / state.scale;
  const len = Math.hypot(dx, dy);
  if (len < MIN_PULL) return null;
  const speed = (Math.min(len, MAX_PULL) / MAX_PULL) * MAX_SPEED;
  return { vx: (dx / len) * speed, vy: (dy / len) * speed, angle: Math.atan2(dy, dx), power: speed / MAX_SPEED };
}

canvas.addEventListener('pointerdown', (e) => {
  if (state.phase !== 'aim' || state.aim.active) return;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch (err) {
    // synthetic/test events have no real pointer to capture
  }
  Object.assign(state.aim, { active: true, id: e.pointerId, sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY });
});

canvas.addEventListener('pointermove', (e) => {
  const a = state.aim;
  if (!a.active || e.pointerId !== a.id) return;
  a.cx = e.clientX;
  a.cy = e.clientY;
  const v = aimVelocity();
  if (v) state.angles[player()] = v.angle;
});

function endAim(e) {
  const a = state.aim;
  if (!a.active || e.pointerId !== a.id) return;
  a.active = false;
  const v = aimVelocity();
  if (v && e.type === 'pointerup') fire(v);
}
canvas.addEventListener('pointerup', endAim);
canvas.addEventListener('pointercancel', endAim);

ui.again.addEventListener('click', reset);
window.addEventListener('resize', layout);

function fire(v) {
  const p = player();
  const w = WEAPONS[state.weapon];
  if (w.ammo !== Infinity) state.ammo[p][state.weapon]--;
  state.angles[p] = v.angle;
  state.recoil[p] = 1;
  const m = muzzle(p, v.angle);
  for (let i = 0; i < w.count; i++) {
    // a sprinkle shot is a spray: small random differences in speed and angle
    const spread = w.count > 1 ? 1 : 0;
    const a = v.angle + (Math.random() - 0.5) * 0.14 * spread;
    const speed = Math.hypot(v.vx, v.vy) * (1 + (Math.random() - 0.5) * 0.16 * spread);
    state.projectiles.push({
      kind: w.kind,
      x: m.x,
      y: m.y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      rot: Math.random() * Math.PI,
      r: KINDS[w.kind].r,
      color: CANDY[(Math.random() * CANDY.length) | 0],
      seed: Math.random() * 6,
      rest: 0,
    });
  }
  state.phase = 'flight';
  state.timer = 0;
  buildWeapons();
  Sfx.noise(0.25, 0.25, 700, 0, 2500);
  Sfx.play(220, 0.12, 'sine', 0.25, 90);
}

// ---------- Physics ----------
function stepProjectile(p, h) {
  const K = KINDS[p.kind];
  p.vy += GRAVITY * h;
  const px = p.x;
  p.x += p.vx * h;
  p.y += p.vy * h;
  if (p.kind === 'sprinkle') p.rot = Math.atan2(p.vy, p.vx);

  if (p.x < -60 || p.x > 460 || p.y > 780) return (p.dead = true);

  if (isWater(p.x, p.y)) {
    splash(p.x, WATER_Y, p.kind === 'sprinkle' ? 3 : 10);
    if (p.kind !== 'sprinkle') Sfx.play(700, 0.12, 'sine', 0.18, 200);
    return (p.dead = true);
  }

  for (const c of state.cakes) {
    if (!c.eaten && inCake(c, p.x - c.x, p.y - c.y)) {
      hitCake(c, p);
      return (p.dead = true);
    }
  }

  const g = groundY(p.x);
  if (p.y + p.r <= g) {
    p.onGround = false;
    return;
  }
  const depth = p.y + p.r - g;
  if (depth > 10) {
    // ran into a steep cliff side: bounce back horizontally
    p.x = px;
    p.vx = -p.vx * K.bounce;
    return;
  }
  if (p.kind === 'blob') {
    settle({ kind: 'puddle', x: p.x, y: g - 1, r: p.r, rot: slopeAngle(p.x) });
    Sfx.noise(0.12, 0.15, 400);
    return (p.dead = true);
  }

  // bounce off the ground and slide along its slope
  const slope = (groundY(p.x + 1) - groundY(p.x - 1)) / 2;
  const nl = Math.hypot(slope, 1);
  const nx = slope / nl;
  const ny = -1 / nl;
  p.y = g - p.r;
  let vn = p.vx * nx + p.vy * ny;
  if (vn < 0) {
    if (vn < -80 && p.kind === 'ball') Sfx.play(420, 0.07, 'triangle', 0.15, 250);
    const e = vn < -30 ? K.bounce : 0;
    p.vx -= (1 + e) * vn * nx;
    p.vy -= (1 + e) * vn * ny;
  }
  vn = p.vx * nx + p.vy * ny;
  const tx = -ny;
  const ty = nx;
  const vt = (p.vx * tx + p.vy * ty) * Math.max(0, 1 - K.friction * h);
  p.vx = vn * nx + vt * tx;
  p.vy = vn * ny + vt * ty;
  p.onGround = true;

  if (Math.hypot(p.vx, p.vy) < 14) {
    p.rest += h;
    if (p.rest > 0.25) {
      settle({ kind: p.kind, x: p.x, y: p.y, r: p.r, rot: Math.random() * Math.PI, color: p.color, seed: p.seed });
      p.dead = true;
    }
  } else {
    p.rest = 0;
  }
}

function slopeAngle(x) {
  return Math.atan2(groundY(x + 2) - groundY(x - 2), 4);
}

function settle(piece) {
  state.litterPieces.push(piece);
  if (state.litterPieces.length > 900) state.litterPieces.shift();
  drawPiece(litterCtx, piece);
}

function hitCake(c, p) {
  const K = KINDS[p.kind];
  const lx = p.x - c.x;
  const ly = p.y - c.y;
  const piece = { kind: p.kind, x: lx, y: ly, r: p.r, rot: Math.random() * Math.PI, color: p.color, seed: p.seed };
  c.stuck.push(piece);
  cakeTransform(c);
  drawPiece(c.lctx, piece);
  stamp(c, lx, ly, K.stamp, K.value);

  if (p.kind === 'sprinkle') {
    Sfx.tick();
  } else if (p.kind === 'ball') {
    Sfx.play(1320, 0.18, 'triangle', 0.15);
    Sfx.play(1760, 0.2, 'triangle', 0.1, 0, 0.06);
    sparkle(p.x, p.y);
  } else {
    Sfx.noise(0.18, 0.3, 350);
    Sfx.play(200, 0.15, 'sine', 0.2, 110);
    const n = 2 + ((Math.random() * 2) | 0);
    for (let i = 0; i < n; i++) {
      state.drips.push({
        cake: c,
        kind: 'drip',
        x: lx + (i - (n - 1) / 2) * p.r * 0.9,
        y: ly,
        len: 0,
        max: 12 + Math.random() * 35,
        w: 3.5 + Math.random() * 2.5,
        speed: 40 + Math.random() * 25,
        stamped: 0,
      });
    }
  }
  reactCapybara();
}

function updateDrips(dt) {
  state.drips = state.drips.filter((d) => {
    d.len += d.speed * dt;
    d.speed *= 1 - 0.5 * dt;
    const tip = d.y + d.len;
    if (d.len - d.stamped >= 3) {
      stamp(d.cake, d.x, tip, d.w / 2 + 2, 1);
      d.stamped = d.len;
    }
    if (d.len < d.max && inCake(d.cake, d.x, tip - 2) && !d.cake.eaten) return true;
    const piece = { kind: 'drip', x: d.x, y: d.y, len: d.len, w: d.w };
    d.cake.stuck.push(piece);
    cakeTransform(d.cake);
    drawPiece(d.cake.lctx, piece);
    return false;
  });
}

// ---------- Effects ----------
function splash(x, y, n) {
  for (let i = 0; i < n; i++) {
    state.fx.push({ kind: 'drop', x, y, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 120, life: 0.6, color: '#bfe9ff', size: 2 });
  }
}

function sparkle(x, y) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    state.fx.push({ kind: 'spark', x, y, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, life: 0.5, color: '#fff3a0', size: 2.5 });
  }
}

function crumbs(x, y) {
  for (let i = 0; i < 12; i++) {
    state.fx.push({
      kind: 'drop',
      x,
      y,
      vx: (Math.random() - 0.5) * 160,
      vy: -40 - Math.random() * 140,
      life: 0.9,
      color: pick(['#fff3e0', '#ffffff', '#f2d3a8', ...CANDY]),
      size: 2 + Math.random() * 2,
    });
  }
}

function hearts(x, y) {
  for (let i = 0; i < 5; i++) {
    state.fx.push({ kind: 'heart', x: x + (Math.random() - 0.5) * 30, y, vx: (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 30, life: 1.6, color: '#ff5c9a', size: 5 });
  }
}

function pick(list) {
  return list[(Math.random() * list.length) | 0];
}

function updateFx(dt) {
  for (const f of state.fx) {
    if (f.kind !== 'heart') f.vy += GRAVITY * 0.8 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.life -= dt;
  }
  state.fx = state.fx.filter((f) => f.life > 0);
}

// ---------- Capybara ----------
function reactCapybara() {
  if (state.time < state.squeakAt) return;
  state.squeakAt = state.time + 1.2;
  Sfx.play(1500, 0.06, 'sine', 0.08, 1900);
  Sfx.play(1600, 0.06, 'sine', 0.08, 2100, 0.09);
}

function capyLookTarget() {
  const d = taste(state.cakes[1]) - taste(state.cakes[0]);
  return Math.max(-1, Math.min(1, d * 12));
}

function startFinale() {
  state.phase = 'finale';
  const [a, b] = state.cakes.map(taste);
  const targets = Math.abs(a - b) < 0.002 ? [0, 1] : [a > b ? 0 : 1];
  const capy = state.capy;
  capy.script = [{ type: 'sniff', t: 0, dur: 1.8 }];
  for (const i of targets) {
    capy.script.push({ type: 'hop', t: 0, dur: 0.7, cake: i });
    capy.script.push({ type: 'eat', t: 0, dur: 6 * 0.42, cake: i, bites: 0 });
  }
  capy.script.push({ type: 'done', t: 0, dur: 1.2 });
  capy.targets = targets;
  ui.weapons.textContent = '';
  ui.turn.textContent = STRINGS.hungry;
  ui.turn.style.color = '#b07a4c';
  ui.round.textContent = '';
}

function updateCapybara(dt) {
  const capy = state.capy;
  capy.blinkAt -= dt;
  if (capy.blinkAt < -0.12) capy.blinkAt = 2 + Math.random() * 3;

  if (state.phase !== 'finale') {
    capy.look += (capyLookTarget() - capy.look) * Math.min(1, dt * 3);
    capy.facing = capy.look >= 0 ? 1 : -1;
    return;
  }

  const step = capy.script[0];
  if (!step) return;
  step.t += dt;
  const k = Math.min(1, step.t / step.dur);

  if (step.type === 'sniff') {
    capy.facing = Math.sin(step.t * 7) > 0 ? 1 : -1;
    if (k > 0.75) capy.facing = capy.targets[0] === 0 ? -1 : 1;
    if (Math.random() < dt * 3) Sfx.noise(0.08, 0.06, 2500);
  } else if (step.type === 'hop') {
    if (!step.from) {
      step.from = { x: capy.x, y: capy.y };
      Sfx.play(300, 0.3, 'sine', 0.2, 700);
      splash(capy.x, WATER_Y, 12);
    }
    const spot = EAT_SPOTS[step.cake];
    const toY = groundY(spot.x);
    capy.facing = spot.facing;
    capy.x = step.from.x + (spot.x - step.from.x) * k;
    capy.y = step.from.y + (toY - step.from.y) * k - Math.sin(Math.PI * k) * 90;
  } else if (step.type === 'eat') {
    const c = state.cakes[step.cake];
    const phase = (step.t / 0.42) % 1;
    capy.mouth = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
    const bitesDue = Math.min(6, Math.floor(step.t / 0.42 + 0.5));
    while (step.bites < bitesDue) {
      const i = step.bites++;
      const dir = EAT_SPOTS[step.cake].facing; // -1: eating from the right side
      const bx = dir < 0 ? CAKE_W - 6 - i * 18 : 6 + i * 18;
      biteCake(c, { x: bx, y: 18 + Math.random() * 38, r: 20 });
      crumbs(c.x + bx, c.y + 40);
      Sfx.noise(0.12, 0.35, 900);
      Sfx.play(140, 0.08, 'square', 0.08, 90);
      capy.x += dir * 14;
      capy.y = groundY(capy.x);
      if (i === 5) {
        c.eaten = true;
        redrawCake(c);
      }
    }
  } else if (step.type === 'done') {
    capy.mouth = 0;
    if (!capy.happy) {
      capy.happy = true;
      hearts(capy.x, capy.y - 60);
      Sfx.sweet();
    }
  }

  if (k >= 1) {
    capy.script.shift();
    if (!capy.script.length) showResult();
  }
}

function showResult() {
  state.phase = 'over';
  const t = state.capy.targets;
  if (t.length > 1) {
    ui.resultTitle.textContent = STRINGS.draw;
    ui.resultText.textContent = STRINGS.ateBoth;
    ui.resultTitle.style.color = '#4a2a35';
  } else {
    const loser = t[0];
    const winner = 1 - loser;
    ui.resultTitle.textContent = STRINGS.wins(STRINGS.players[winner]);
    ui.resultTitle.style.color = PLAYER_COLORS[winner];
    ui.resultText.textContent = STRINGS.ateCake(STRINGS.players[loser]);
  }
  ui.again.textContent = STRINGS.playAgain;
  ui.result.classList.remove('hidden');
}

// ---------- Update ----------
function update(dt) {
  state.time += dt;
  const h = dt / SUBSTEPS;
  for (let s = 0; s < SUBSTEPS; s++) {
    for (const p of state.projectiles) if (!p.dead) stepProjectile(p, h);
  }
  state.projectiles = state.projectiles.filter((p) => !p.dead);
  updateDrips(dt);
  updateFx(dt);
  updateCapybara(dt);
  for (let i = 0; i < 2; i++) state.recoil[i] = Math.max(0, state.recoil[i] - dt * 5);

  if (state.phase === 'flight') {
    state.timer += dt;
    if ((!state.projectiles.length && !state.drips.length) || state.timer > 8) {
      state.projectiles = [];
      state.phase = 'between';
      state.timer = 0;
    }
  } else if (state.phase === 'between') {
    state.timer += dt;
    if (state.timer > 0.6) {
      state.turn++;
      if (state.turn >= ROUNDS * 2) startFinale();
      else startTurn(false);
    }
  }
}

// ---------- Render ----------
function render() {
  const { dpr, scale } = state;
  const k = dpr * scale;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawSky(ctx, state.W, state.H);

  ctx.setTransform(k, 0, 0, k, dpr * state.ox, dpr * state.oy);
  drawBackdrop(ctx, state.time);
  drawTerrain(ctx);
  ctx.drawImage(litter, VIEW.x, VIEW.y, VIEW.w, VIEW.h);

  for (const c of state.cakes) {
    ctx.drawImage(c.layer, c.x - PAD, c.y - PAD, CAKE_W + PAD * 2, CAKE_H + PAD * 2);
  }
  for (const d of state.drips) {
    ctx.save();
    ctx.translate(d.cake.x, d.cake.y);
    drawPiece(ctx, d);
    ctx.restore();
  }

  for (let i = 0; i < 2; i++) {
    const L = LAUNCHERS[i];
    const active = state.phase === 'aim' && player() === i;
    drawLauncher(ctx, L.x, L.y, state.angles[i], PLAYER_COLORS[i], state.recoil[i], active);
  }

  const capy = state.capy;
  drawCapybara(ctx, capy.x, capy.y + (state.phase === 'aim' || state.phase === 'flight' || state.phase === 'between' ? Math.sin(state.time * 2) * 1.5 : 0), {
    facing: capy.facing,
    s: 0.85,
    mouth: capy.mouth,
    blink: capy.blinkAt < 0,
    happy: capy.happy,
  });
  drawWater(ctx, state.time);

  for (const p of state.projectiles) drawPiece(ctx, p);
  drawAimPreview();
  drawMeters();
  drawFx();
}

function drawAimPreview() {
  if (state.phase !== 'aim' || !state.aim.active) return;
  const v = aimVelocity();
  if (!v) return;
  const m = muzzle(player(), v.angle);
  let { x, y } = m;
  let { vx, vy } = v;
  const h = 1 / 60;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeStyle = 'rgba(74, 42, 53, 0.5)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= PREVIEW_TIME * 60; i++) {
    vy += GRAVITY * h;
    x += vx * h;
    y += vy * h;
    if (y > groundY(x)) break;
    if (i % 3 === 0) {
      ctx.beginPath();
      ctx.arc(x, y, 2.4 - i / 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  // power ring around the launcher
  const L = LAUNCHERS[player()];
  ctx.strokeStyle = PLAYER_COLORS[player()];
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(L.x, L.y, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v.power);
  ctx.stroke();
}

function drawMeters() {
  for (const c of state.cakes) {
    if (c.eaten) continue;
    const pct = Math.round(taste(c) * 100);
    const x = c.x + CAKE_W / 2 - 32;
    const y = c.y - 34;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = PLAYER_COLORS[c.owner];
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, 64, 17, 8.5) : ctx.rect(x, y, 64, 17);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#ffd1e3';
    ctx.fillRect(x, y, 64 * taste(c), 17);
    ctx.restore();
    ctx.stroke();
    ctx.fillStyle = '#4a2a35';
    ctx.font = 'bold 10px ui-rounded, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(STRINGS.yum(pct), x + 32, y + 9);
  }
}

function drawFx() {
  for (const f of state.fx) {
    ctx.globalAlpha = Math.min(1, f.life * 2);
    ctx.fillStyle = f.color;
    ctx.beginPath();
    if (f.kind === 'heart') {
      const s = f.size;
      ctx.moveTo(f.x, f.y + s * 0.9);
      ctx.bezierCurveTo(f.x - s * 1.6, f.y - s * 0.2, f.x - s * 0.6, f.y - s * 1.3, f.x, f.y - s * 0.4);
      ctx.bezierCurveTo(f.x + s * 0.6, f.y - s * 1.3, f.x + s * 1.6, f.y - s * 0.2, f.x, f.y + s * 0.9);
    } else {
      ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------- Loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

reset();
requestAnimationFrame(frame);
