'use strict';

// Sprinkle Wars – prototype (landscape).
// Two cake castles, turn-based cannon shots over the river. Every hit decorates
// the ENEMY's castle. After the last round the king capybara eats the tastiest
// castle – its owner loses.

// ---------- UI text ----------
const STRINGS = {
  players: ['Blue', 'Pink'],
  turn: (name) => `${name}'s turn`,
  hint: 'Pull back and let go to fire at the other cake',
  weapons: { sprinkles: 'Sprinkles', glitter: 'Glitter', trio: 'Golden Trio', drip: 'Pink Drip' },
  gain: (pct) => `+${pct}% yum`,
  oops: 'Oops! Your own cake',
  miss: 'Miss!',
  yummier: 'Yummier!',
  bonk: 'Bonk!',
  hungry: 'The king is hungry…',
  wins: (name) => `${name} wins!`,
  ateCake: (name) => `The king ate ${name}'s cake – it was too tasty!`,
  draw: 'Draw!',
  ateBoth: 'Both cakes were equally tasty, so the king ate both.',
  playAgain: 'Play again',
  rotate: 'Turn your phone sideways',
};

// ---------- Tuning ----------
const PLAYER_COLORS = ['#3d8bff', '#ff5c9a'];
const ROUNDS = 5;
const GRAVITY = 600;
const MAX_SPEED = 640;
const MAX_PULL = 150; // world units of pull for full power
const MIN_PULL = 10;
const PREVIEW_TIME = 0.35; // s of trajectory shown while aiming
const CELL = 2.5; // tastiness grid cell, world units
const MAX_TASTE = 2; // per-cell cap
const PAD = 40; // extra room around the castle layer (banner, flags, drips)
const SUBSTEPS = 3;
const SKY_CROP = 45; // world units of empty sky that may be cut off at the top
const TOPPING_AT = [0.2, 0.4, 0.6, 0.8];
const TOPPINGS = ['strawberry', 'swirl', 'cherry', 'strawberry'];

// sink: pieces fly up to this far across the castle's front before sticking,
// so decorations spread over the cake instead of piling up on its edge
const KINDS = {
  sprinkle: { r: 2, bounce: 0.25, friction: 14, stamp: 10, value: 1, sink: 50 },
  glitter: { r: 1.5, bounce: 0.1, friction: 20, stamp: 9, value: 0.7, gravity: 0.35, drag: 1.3, sink: 60 },
  ball: { r: 6, bounce: 0.55, friction: 1.5, stamp: 19, value: 2, sink: 35 },
  blob: { r: 9, bounce: 0, friction: 30, stamp: 20, value: 1, sink: 40 },
};

const WEAPONS = {
  sprinkles: { ammo: Infinity, kind: 'sprinkle', count: 36, spread: 0.14, jitter: 0.16, mix: true },
  glitter: { ammo: 2, kind: 'glitter', count: 80, spread: 0.35, jitter: 0.35 },
  trio: { ammo: 2, kind: 'ball', count: 3, spread: 0.03, jitter: 0.06, stagger: 0.12 },
  drip: { ammo: 2, kind: 'blob', count: 1, spread: 0, jitter: 0 },
};

const CASTLE_X = [30, WORLD_W - 30 - CASTLE_W];
const CANNONS = [
  { x: 212, y: 240 },
  { x: WORLD_W - 212, y: 240 },
];
const GUNNERS = [
  { x: 190, y: 248, facing: 1 },
  { x: WORLD_W - 190, y: 248, facing: -1 },
];
const KING_HOME = { x: 400, y: 398 };
const KING_SCALE = 1.3;
const KING_RADIUS = 36;
// the king stands here to eat castle 0 / castle 1
const EAT_SPOTS = [
  { x: 236, facing: -1 },
  { x: WORLD_W - 236, facing: 1 },
];
const SIGN_X = 520;

// ---------- DOM ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const bg = document.createElement('canvas'); // sky, scenery, terrain, towers
const bgCtx = bg.getContext('2d');
const litter = document.createElement('canvas'); // pieces that ended up on the ground
const litterCtx = litter.getContext('2d');

const ui = {
  sides: [0, 1].map((i) => document.getElementById(`side${i}`)),
  fills: [0, 1].map((i) => document.querySelector(`#side${i} .fill`)),
  pcts: [0, 1].map((i) => document.querySelector(`#side${i} .pct`)),
  rounds: document.getElementById('rounds'),
  banner: document.getElementById('banner'),
  weapons: document.getElementById('weapons'),
  result: document.getElementById('result'),
  resultTitle: document.getElementById('result-title'),
  resultText: document.getElementById('result-text'),
  again: document.getElementById('again'),
  rotate: document.getElementById('rotate'),
};

// ---------- Castle mask (same shape for both castles) ----------
const MASK_W = Math.ceil(CASTLE_W / CELL);
const MASK_H = Math.ceil(CASTLE_H / CELL);
const MASK = (() => {
  const c = document.createElement('canvas');
  c.width = MASK_W;
  c.height = MASK_H;
  const m = c.getContext('2d', { willReadFrequently: true });
  m.setTransform(1 / CELL, 0, 0, 1 / CELL, 0, 0);
  m.beginPath();
  castlePath(m);
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
  u: 1,
  dpr: 1,
  scale: 1,
  ox: 0,
  oy: 0,
  time: 0,
  castles: [],
  turn: 0,
  phase: 'aim', // aim | flight | between | finale | over
  timer: 0,
  weapon: 'sprinkles',
  ammo: [],
  projectiles: [],
  drips: [],
  litterPieces: [],
  fx: [],
  texts: [],
  aim: { active: false, id: null, sx: 0, sy: 0, cx: 0, cy: 0 },
  angles: [-0.8, Math.PI + 0.8],
  recoil: [0, 0],
  king: null,
  shot: null, // tastiness before the current shot
  heartAt: 0,
  bonkAt: 0,
};

function player() {
  return state.turn % 2;
}

function makeCastle(owner) {
  const layer = document.createElement('canvas');
  return {
    owner,
    x: CASTLE_X[owner],
    y: GROUND - CASTLE_H,
    cells: new Float32Array(MASK_W * MASK_H),
    sum: 0,
    stuck: [],
    bites: [],
    toppings: 0,
    eaten: false,
    layer,
    lctx: layer.getContext('2d'),
  };
}

function taste(c) {
  return c.sum / (MASK_TOTAL * MAX_TASTE);
}

function inCastle(c, lx, ly) {
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
  checkToppings(c);
}

// Every 20% of tastiness a bonus topping pops onto the castle.
function checkToppings(c) {
  while (c.toppings < TOPPING_AT.length && taste(c) >= TOPPING_AT[c.toppings]) {
    const t = TIERS[(Math.random() * TIERS.length) | 0];
    const piece = { kind: TOPPINGS[c.toppings], x: t.x + 12 + Math.random() * (t.w - 24), y: t.y + 1 };
    c.toppings++;
    addToCastle(c, piece);
    floatText(STRINGS.yummier, c.x + piece.x, c.y + piece.y - 16, '#ff5c9a');
    sparkle(c.x + piece.x, c.y + piece.y);
    Sfx.ding();
  }
}

function addToCastle(c, piece) {
  c.stuck.push(piece);
  castleTransform(c);
  drawPiece(c.lctx, piece);
}

// ---------- Setup ----------
function reset() {
  state.castles = [makeCastle(0), makeCastle(1)];
  state.turn = 0;
  state.projectiles = [];
  state.drips = [];
  state.litterPieces = [];
  state.fx = [];
  state.texts = [];
  state.ammo = [0, 1].map(() => {
    const a = {};
    for (const id of Object.keys(WEAPONS)) a[id] = WEAPONS[id].ammo;
    return a;
  });
  state.weapon = 'sprinkles';
  state.king = { x: KING_HOME.x, y: KING_HOME.y, facing: 1, look: 0, mouth: 0, happy: false, blinkAt: 2, bonk: 0 };
  ui.result.classList.add('hidden');
  layout();
  startTurn(true);
}

function startTurn(first) {
  state.phase = 'aim';
  state.aim.active = false;
  const p = player();
  if (state.ammo[p][state.weapon] <= 0) state.weapon = 'sprinkles';
  updateHud();
  buildWeapons();
  showBanner(first ? STRINGS.hint : STRINGS.turn(STRINGS.players[p]), first ? OUTLINE : PLAYER_COLORS[p]);
}

// ---------- Layout ----------
function layout() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 3);
  state.W = window.innerWidth;
  state.H = window.innerHeight;
  canvas.width = bg.width = Math.round(state.W * state.dpr);
  canvas.height = bg.height = Math.round(state.H * state.dpr);

  // UI shrinks on short screens (e.g. Safari with its toolbars in landscape)
  state.u = Math.max(0.62, Math.min(1, state.H / 430));
  document.documentElement.style.setProperty('--u', state.u.toFixed(3));

  // the empty sky at the very top may be cut off (the HUD sits there anyway)
  const viewH = WORLD_H - SKY_CROP;
  state.scale = Math.min(state.W / WORLD_W, state.H / viewH);
  state.ox = (state.W - WORLD_W * state.scale) / 2;
  state.oy = (state.H - viewH * state.scale) / 2 - SKY_CROP * state.scale;
  placeWeapons();
  const k = state.scale * state.dpr;

  // bake the static scenery
  bgCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  drawSky(bgCtx, state.W, state.H);
  bgCtx.setTransform(k, 0, 0, k, state.dpr * state.ox, state.dpr * state.oy);
  drawBackdrop(bgCtx);
  drawTerrain(bgCtx);
  drawTower(bgCtx, 0);
  drawTower(bgCtx, 1);

  buildSprinkleBitmaps(k);

  for (const c of state.castles) {
    c.layer.width = Math.ceil((CASTLE_W + PAD * 2) * k);
    c.layer.height = Math.ceil((CASTLE_H + PAD * 2) * k);
    redrawCastle(c);
  }
  litter.width = Math.ceil(WORLD_W * k);
  litter.height = Math.ceil(WORLD_H * k);
  litterCtx.setTransform(k, 0, 0, k, 0, 0);
  for (const p of state.litterPieces) drawPiece(litterCtx, p);

  ui.rotate.textContent = STRINGS.rotate;
}

function castleTransform(c) {
  const k = state.scale * state.dpr;
  c.lctx.setTransform(k, 0, 0, k, PAD * k, PAD * k);
}

function redrawCastle(c) {
  c.lctx.setTransform(1, 0, 0, 1, 0, 0);
  c.lctx.clearRect(0, 0, c.layer.width, c.layer.height);
  if (c.eaten) return;
  castleTransform(c);
  drawCastle(c.lctx, PLAYER_COLORS[c.owner], c.owner);
  for (const p of c.stuck) drawPiece(c.lctx, p);
  for (const b of c.bites) biteCastle(c, b, false);
}

function biteCastle(c, b, remember = true) {
  if (remember) c.bites.push(b);
  c.lctx.save();
  c.lctx.globalCompositeOperation = 'destination-out';
  c.lctx.beginPath();
  c.lctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  c.lctx.arc(b.x + b.r * 0.3, b.y + b.r * 0.8, b.r * 0.65, 0, Math.PI * 2);
  c.lctx.arc(b.x - b.r * 0.2, b.y - b.r * 0.85, b.r * 0.65, 0, Math.PI * 2);
  c.lctx.fill();
  c.lctx.restore();
}

// ---------- HUD ----------
function updateHud() {
  const p = player();
  for (let i = 0; i < 2; i++) {
    const t = state.castles[i] ? taste(state.castles[i]) : 0;
    ui.fills[i].style.width = `${Math.min(100, t * 100)}%`;
    ui.pcts[i].textContent = `${Math.round(t * 100)}%`;
    ui.sides[i].classList.toggle('active', state.phase === 'aim' && p === i);
  }
  const round = Math.floor(state.turn / 2);
  [...ui.rounds.querySelectorAll('.dot')].forEach((d, i) => {
    d.classList.toggle('done', i < round || state.phase === 'finale' || state.phase === 'over');
    d.classList.toggle('now', i === round && state.phase !== 'finale' && state.phase !== 'over');
  });
}

function buildRounds() {
  ui.rounds.textContent = '';
  const crown = (i) => {
    const el = document.createElement('span');
    el.className = 'crown';
    el.style.background = PLAYER_COLORS[i];
    return el;
  };
  ui.rounds.appendChild(crown(0));
  for (let i = 0; i < ROUNDS; i++) {
    const d = document.createElement('span');
    d.className = 'dot';
    ui.rounds.appendChild(d);
  }
  ui.rounds.appendChild(crown(1));
}

function buildAvatars() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  for (let i = 0; i < 2; i++) {
    const cv = ui.sides[i].querySelector('canvas');
    cv.width = cv.height = 40 * dpr;
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawCakeIcon(c);
    ui.sides[i].style.setProperty('--team', PLAYER_COLORS[i]);
  }
}

// Weapon bar: a column in the empty side margin when there's room for it,
// otherwise a row on the grass under the active player's castle.
function placeWeapons() {
  const u = state.u;
  const side = player() === 0 ? 'left' : 'right';
  const safe = getComputedStyle(document.getElementById('safe'));
  const inset = parseFloat(side === 'left' ? safe.paddingLeft : safe.paddingRight) || 0;
  const btn = 52 * u;
  const colW = btn + 20 * u + 6;
  const colH = 4 * (btn + 15 * u) + 40 * u + 6;
  const hudBottom = document.getElementById('hud').getBoundingClientRect().bottom;
  const column = state.ox - inset >= colW + 12 && state.H - hudBottom - 8 >= colH;
  ui.weapons.className = `${side}${column ? ' column' : ''}`;
  ui.weapons.style.setProperty('--ox', `${state.ox}px`);
}

function buildWeapons() {
  ui.weapons.textContent = '';
  placeWeapons();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const ammo = state.ammo[player()];
  for (const id of Object.keys(WEAPONS)) {
    const wrap = document.createElement('div');
    wrap.className = 'weapon';

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

    const pips = document.createElement('div');
    pips.className = 'pips';
    if (WEAPONS[id].ammo === Infinity) {
      pips.textContent = '∞';
    } else {
      for (let i = 0; i < WEAPONS[id].ammo; i++) {
        const pip = document.createElement('span');
        pip.className = i < ammo[id] ? 'pip on' : 'pip';
        pips.appendChild(pip);
      }
    }

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (state.phase !== 'aim' || ammo[id] <= 0) return;
      state.weapon = id;
      buildWeapons();
      Sfx.play(900, 0.06, 'triangle', 0.1);
    });
    wrap.appendChild(btn);
    wrap.appendChild(pips);
    ui.weapons.appendChild(wrap);
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
  const C = CANNONS[p];
  return { x: C.x + Math.cos(angle) * 28, y: C.y + Math.sin(angle) * 28 };
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
  state.shot = { mine: taste(state.castles[p]), theirs: taste(state.castles[1 - p]) };
  const m = muzzle(p, v.angle);
  const speed0 = Math.hypot(v.vx, v.vy);
  let largeHearts = 0;
  for (let i = 0; i < w.count; i++) {
    const a = v.angle + (Math.random() - 0.5) * w.spread;
    const speed = speed0 * (1 + (Math.random() - 0.5) * w.jitter);
    // sprinkles shoot the pastel mix (at most one large heart per shot)
    const mix = w.mix ? pickSprinkle(largeHearts > 0) : null;
    if (mix && mix.el === 'heart-large') largeHearts++;
    state.projectiles.push({
      ...mix,
      spin: mix ? (Math.random() - 0.5) * 8 : 0,
      kind: w.kind,
      x: m.x,
      y: m.y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      rot: mix ? mix.rot : Math.random() * Math.PI,
      r: mix ? SPRINKLE_BY_ID[mix.el].r : KINDS[w.kind].r,
      color: w.kind === 'glitter' ? GLITTER[(Math.random() * GLITTER.length) | 0] : CANDY[(Math.random() * CANDY.length) | 0],
      size: 1.2 + Math.random() * 1.2,
      seed: Math.random() * 6,
      rest: 0,
      delay: (w.stagger || 0) * i,
    });
  }
  state.phase = 'flight';
  state.timer = 0;
  buildWeapons();
  updateHud();
  smoke(m.x, m.y);
  Sfx.noise(0.3, 0.3, 500, 0, 2500);
  Sfx.play(160, 0.15, 'sine', 0.3, 60);
  if (state.weapon === 'glitter') for (let i = 0; i < 5; i++) Sfx.play(2400 + i * 300, 0.2, 'sine', 0.05, 0, 0.1 + i * 0.05);
  if (state.weapon === 'trio') {
    Sfx.play(160, 0.12, 'sine', 0.25, 60, 0.12);
    Sfx.play(160, 0.12, 'sine', 0.25, 60, 0.24);
  }
}

// ---------- Physics ----------
function stepProjectile(p, h) {
  if (p.delay > 0) {
    p.delay -= h;
    return;
  }
  const K = KINDS[p.kind];
  p.vy += GRAVITY * (K.gravity || 1) * h;
  if (K.drag) {
    p.vx *= 1 - K.drag * h;
    p.vy *= 1 - K.drag * h;
  }
  const px = p.x;
  const py = p.y;
  p.x += p.vx * h;
  p.y += p.vy * h;
  if (p.el) {
    // mix pieces: jimmies point along their flight, round ones keep their light, the rest tumble a bit
    const spin = SPRINKLE_BY_ID[p.el].spin;
    if (spin === 'free') p.rot = Math.atan2(p.vy, p.vx);
    else if (spin === 'small') p.rot += p.spin * h;
  } else if (p.kind === 'sprinkle') {
    p.rot = Math.atan2(p.vy, p.vx);
  }

  if (p.x < -200 || p.x > WORLD_W + 200 || p.y > WORLD_H + 60) return (p.dead = true);

  if (isWater(p.x, p.y)) {
    const small = p.kind === 'sprinkle' || p.kind === 'glitter';
    splash(p.x, WATER_Y, small ? 2 : 10);
    if (!small) Sfx.play(700, 0.12, 'sine', 0.18, 200);
    return (p.dead = true);
  }

  if (bounceOffKing(p)) return;

  for (const c of state.castles) {
    if (c.eaten) continue;
    if (inCastle(c, p.x - c.x, p.y - c.y)) {
      if (p.sink === undefined) p.sink = Math.random() * K.sink;
      p.sunk = (p.sunk || 0) + Math.hypot(p.x - px, p.y - py);
      p.lastIn = { c, x: p.x, y: p.y };
      if (p.sunk >= p.sink) {
        hitCastle(c, p);
        return (p.dead = true);
      }
    } else if (p.lastIn && p.lastIn.c === c) {
      // flew out the other side before sticking: stick where it left
      p.x = p.lastIn.x;
      p.y = p.lastIn.y;
      hitCastle(c, p);
      return (p.dead = true);
    }
  }

  const g = groundY(p.x);
  if (p.y + p.r <= g) return;
  if (p.lastIn) {
    p.x = p.lastIn.x;
    p.y = p.lastIn.y;
    hitCastle(p.lastIn.c, p);
    return (p.dead = true);
  }
  const depth = p.y + p.r - g;
  if (depth > 10) {
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

  if (Math.hypot(p.vx, p.vy) < 14) {
    p.rest += h;
    if (p.rest > 0.25) {
      settle(landedPiece(p, p.x, p.y));
      p.dead = true;
    }
  } else {
    p.rest = 0;
  }
}

function kingCenter() {
  const k = state.king;
  return { x: k.x + k.facing * 10, y: k.y - 34 * KING_SCALE };
}

// The king sits in the river: shots bounce off him.
function bounceOffKing(p) {
  if (state.phase === 'finale' || state.phase === 'over') return false;
  const c = kingCenter();
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const d = Math.hypot(dx, dy);
  const R = KING_RADIUS + p.r;
  if (d >= R || d === 0) return false;
  const nx = dx / d;
  const ny = dy / d;
  p.x = c.x + nx * R;
  p.y = c.y + ny * R;
  const vn = p.vx * nx + p.vy * ny;
  if (vn < 0) {
    p.vx -= 1.6 * vn * nx;
    p.vy -= 1.6 * vn * ny;
  }
  state.king.bonk = 0.35;
  if (state.time > state.bonkAt) {
    state.bonkAt = state.time + 0.6;
    Sfx.play(300, 0.15, 'sine', 0.2, 600);
    floatText(STRINGS.bonk, c.x, c.y - 50, OUTLINE);
  }
  return true;
}

function slopeAngle(x) {
  return Math.atan2(groundY(x + 2) - groundY(x - 2), 4);
}

function settle(piece) {
  state.litterPieces.push(piece);
  if (state.litterPieces.length > 1200) state.litterPieces.shift();
  drawPiece(litterCtx, piece);
}

// The piece that stays behind where a projectile lands (castle-local or ground coords).
function landedPiece(p, x, y) {
  const el = p.el && SPRINKLE_BY_ID[p.el];
  return {
    kind: p.kind,
    el: p.el,
    key: p.key,
    x,
    y,
    r: p.r,
    rot: el ? sprinkleRotation(el) : Math.random() * Math.PI,
    color: p.color,
    size: p.size,
    seed: p.seed,
  };
}

function hitCastle(c, p) {
  const K = KINDS[p.kind];
  const el = p.el && SPRINKLE_BY_ID[p.el];
  const lx = p.x - c.x;
  const ly = p.y - c.y;
  addToCastle(c, landedPiece(p, lx, ly));
  stamp(c, lx, ly, el ? el.stamp : K.stamp, el ? el.value : K.value);

  if (el && el.id === 'heart-large') {
    Sfx.play(1568, 0.2, 'triangle', 0.12);
    Sfx.play(2093, 0.25, 'triangle', 0.1, 0, 0.07);
    sparkle(p.x, p.y);
  } else if (p.kind === 'sprinkle') {
    Sfx.tick();
  } else if (p.kind === 'glitter') {
    if (Math.random() < 0.2) Sfx.play(2500 + Math.random() * 1500, 0.08, 'sine', 0.04);
  } else if (p.kind === 'ball') {
    Sfx.play(1320, 0.18, 'triangle', 0.15);
    Sfx.play(1760, 0.2, 'triangle', 0.1, 0, 0.06);
    sparkle(p.x, p.y);
  } else {
    Sfx.noise(0.18, 0.3, 350);
    Sfx.play(200, 0.15, 'sine', 0.2, 110);
    const n = 3 + ((Math.random() * 2) | 0);
    for (let i = 0; i < n; i++) {
      state.drips.push({
        castle: c,
        kind: 'drip',
        x: lx + (i - (n - 1) / 2) * p.r * 0.8,
        y: ly,
        len: 0,
        max: 18 + Math.random() * 45,
        w: 4 + Math.random() * 3,
        speed: 45 + Math.random() * 30,
        stamped: 0,
      });
    }
  }
}

function updateDrips(dt) {
  state.drips = state.drips.filter((d) => {
    d.len += d.speed * dt;
    d.speed *= 1 - 0.5 * dt;
    const tip = d.y + d.len;
    if (d.len - d.stamped >= 3) {
      stamp(d.castle, d.x, tip, d.w / 2 + 2, 1);
      d.stamped = d.len;
    }
    if (d.len < d.max && inCastle(d.castle, d.x, tip - 2) && !d.castle.eaten) return true;
    addToCastle(d.castle, { kind: 'drip', x: d.x, y: d.y, len: d.len, w: d.w });
    return false;
  });
}

// ---------- Effects ----------
function pick(list) {
  return list[(Math.random() * list.length) | 0];
}

function splash(x, y, n) {
  for (let i = 0; i < n; i++) {
    state.fx.push({ kind: 'drop', x, y, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 120, life: 0.6, color: '#d8f3ff', size: 2 });
  }
}

function sparkle(x, y) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    state.fx.push({ kind: 'spark', x, y, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, life: 0.5, color: '#fff3a0', size: 2.5 });
  }
}

function smoke(x, y) {
  for (let i = 0; i < 6; i++) {
    state.fx.push({ kind: 'puff', x, y, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 30, life: 0.6, color: 'rgba(255, 255, 255, 0.8)', size: 4 + Math.random() * 4 });
  }
}

function crumbs(x, y) {
  for (let i = 0; i < 12; i++) {
    state.fx.push({
      kind: 'drop',
      x,
      y,
      vx: (Math.random() - 0.5) * 180,
      vy: -40 - Math.random() * 160,
      life: 0.9,
      color: pick(['#f3c77e', '#fff6e8', '#dca663', PINK_ICING, ...CANDY]),
      size: 2 + Math.random() * 2.5,
    });
  }
}

function hearts(x, y, n = 5) {
  for (let i = 0; i < n; i++) {
    state.fx.push({ kind: 'heart', x: x + (Math.random() - 0.5) * 30, y, vx: (Math.random() - 0.5) * 20, vy: -35 - Math.random() * 30, life: 1.6, color: '#ff5c9a', size: 5 });
  }
}

function floatText(text, x, y, color) {
  state.texts.push({ text, x, y, color, life: 1.4 });
}

function updateFx(dt) {
  for (const f of state.fx) {
    if (f.kind === 'drop' || f.kind === 'spark') f.vy += GRAVITY * 0.8 * dt;
    if (f.kind === 'puff') f.size += 12 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.life -= dt;
  }
  state.fx = state.fx.filter((f) => f.life > 0);
  for (const t of state.texts) {
    t.y -= 22 * dt;
    t.life -= dt;
  }
  state.texts = state.texts.filter((t) => t.life > 0);
}

// ---------- King capybara ----------
function tasteDiff() {
  return taste(state.castles[1]) - taste(state.castles[0]);
}

function startFinale() {
  state.phase = 'finale';
  const [a, b] = state.castles.map(taste);
  // a draw only when the bars show the same number
  const targets = Math.round(a * 100) === Math.round(b * 100) ? [0, 1] : [a > b ? 0 : 1];
  const king = state.king;
  king.script = [{ type: 'sniff', t: 0, dur: 1.8 }];
  for (const i of targets) {
    king.script.push({ type: 'hop', t: 0, dur: 0.8, castle: i });
    king.script.push({ type: 'eat', t: 0, castle: i });
  }
  king.script.push({ type: 'done', t: 0, dur: 1.3 });
  king.targets = targets;
  ui.weapons.textContent = '';
  updateHud();
  showBanner(STRINGS.hungry, '#8a5a35');
}

// Bite positions covering the castle, starting from the side the king stands on.
function planBites(castleIndex) {
  const bites = [];
  for (let y = 24; y < CASTLE_H; y += 38) {
    for (let x = 16; x < CASTLE_W; x += 38) {
      if (inCastle(state.castles[castleIndex], x, y) || inCastle(state.castles[castleIndex], x, y + 14)) {
        bites.push({ x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8, r: 30 });
      }
    }
  }
  const dir = EAT_SPOTS[castleIndex].facing; // -1: eating from the right side
  bites.sort((p, q) => (dir < 0 ? q.x - p.x : p.x - q.x) + (q.y - p.y) * 0.1);
  return bites;
}

function updateKing(dt) {
  const king = state.king;
  king.blinkAt -= dt;
  if (king.blinkAt < -0.12) king.blinkAt = 2 + Math.random() * 3;
  king.bonk = Math.max(0, king.bonk - dt);

  if (state.phase !== 'finale') {
    const d = tasteDiff();
    king.look += (Math.max(-1, Math.min(1, d * 12)) - king.look) * Math.min(1, dt * 3);
    king.facing = king.look >= 0 ? 1 : -1;
    // swoons at the tastier cake now and then
    if (Math.abs(d) > 0.03 && state.time > state.heartAt && state.phase !== 'over') {
      state.heartAt = state.time + 2.5;
      const c = kingCenter();
      hearts(c.x + king.facing * 30, c.y - 40, 3);
    }
    return;
  }

  const step = king.script[0];
  if (!step) return;
  step.t += dt;

  if (step.type === 'sniff') {
    king.facing = Math.sin(step.t * 7) > 0 ? 1 : -1;
    if (step.t > step.dur * 0.75) king.facing = king.targets[0] === 0 ? -1 : 1;
    if (Math.random() < dt * 3) Sfx.noise(0.08, 0.06, 2500);
  } else if (step.type === 'hop') {
    if (!step.from) {
      step.from = { x: king.x, y: king.y };
      Sfx.play(300, 0.3, 'sine', 0.2, 700);
      splash(king.x, WATER_Y, 16);
    }
    const k = Math.min(1, step.t / step.dur);
    const spot = EAT_SPOTS[step.castle];
    king.facing = spot.facing;
    king.x = step.from.x + (spot.x - step.from.x) * k;
    king.y = step.from.y + (GROUND - step.from.y) * k - Math.sin(Math.PI * k) * 110;
  } else if (step.type === 'eat') {
    const c = state.castles[step.castle];
    if (!step.bites) {
      step.bites = planBites(step.castle);
      step.done = 0;
      step.dur = step.bites.length * 0.3 + 0.2;
    }
    const phase = (step.t / 0.3) % 1;
    king.mouth = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
    king.y = GROUND - Math.abs(Math.sin((step.t / 0.3) * Math.PI)) * 6;
    const due = Math.min(step.bites.length, Math.floor(step.t / 0.3 + 0.5));
    while (step.done < due) {
      const b = step.bites[step.done++];
      biteCastle(c, b);
      crumbs(c.x + b.x, c.y + b.y);
      Sfx.noise(0.12, 0.35, 900);
      Sfx.play(140, 0.08, 'square', 0.08, 90);
      if (step.done === step.bites.length) {
        c.eaten = true;
        redrawCastle(c);
      }
    }
  } else if (step.type === 'done') {
    king.mouth = 0;
    if (!king.happy) {
      king.happy = true;
      hearts(king.x, king.y - 80, 7);
      Sfx.sweet();
    }
  }

  if (step.dur !== undefined && step.t >= step.dur) {
    king.script.shift();
    if (!king.script.length) showResult();
  }
}

function showResult() {
  state.phase = 'over';
  const t = state.king.targets;
  if (t.length > 1) {
    ui.resultTitle.textContent = STRINGS.draw;
    ui.resultText.textContent = STRINGS.ateBoth;
    ui.resultTitle.style.color = OUTLINE;
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
function endOfShot() {
  const p = player();
  const theirs = taste(state.castles[1 - p]) - state.shot.theirs;
  const mine = taste(state.castles[p]) - state.shot.mine;
  const target = state.castles[1 - p];
  const own = state.castles[p];
  if (theirs >= 0.002) {
    floatText(STRINGS.gain(Math.max(1, Math.round(theirs * 100))), target.x + CASTLE_W / 2, target.y - 10, PLAYER_COLORS[p]);
  } else if (mine < 0.002) {
    floatText(STRINGS.miss, target.x + CASTLE_W / 2, target.y - 10, OUTLINE);
  }
  if (mine >= 0.002) {
    floatText(STRINGS.oops, own.x + CASTLE_W / 2, own.y - 10, OUTLINE);
    Sfx.play(400, 0.25, 'triangle', 0.15, 200);
  }
}

function update(dt) {
  state.time += dt;
  const h = dt / SUBSTEPS;
  for (let s = 0; s < SUBSTEPS; s++) {
    for (const p of state.projectiles) if (!p.dead) stepProjectile(p, h);
  }
  state.projectiles = state.projectiles.filter((p) => !p.dead);
  updateDrips(dt);
  updateFx(dt);
  updateKing(dt);
  for (let i = 0; i < 2; i++) state.recoil[i] = Math.max(0, state.recoil[i] - dt * 4);

  if (state.phase === 'flight') {
    state.timer += dt;
    if ((!state.projectiles.length && !state.drips.length) || state.timer > 8) {
      state.projectiles = [];
      endOfShot();
      updateHud();
      state.phase = 'between';
      state.timer = 0;
    }
  } else if (state.phase === 'between') {
    state.timer += dt;
    if (state.timer > 0.9) {
      state.turn++;
      if (state.turn >= ROUNDS * 2) startFinale();
      else startTurn(false);
    }
  }
  if (state.phase === 'flight' && Math.random() < dt * 8) updateHud();
}

// ---------- Render ----------
function render() {
  const { dpr, scale } = state;
  const k = dpr * scale;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bg, 0, 0);

  ctx.setTransform(k, 0, 0, k, dpr * state.ox, dpr * state.oy);
  ctx.drawImage(litter, 0, 0, WORLD_W, WORLD_H);

  for (const c of state.castles) {
    ctx.drawImage(c.layer, c.x - PAD, c.y - PAD, CASTLE_W + PAD * 2, CASTLE_H + PAD * 2);
  }
  for (const d of state.drips) {
    ctx.save();
    ctx.translate(d.castle.x, d.castle.y);
    drawPiece(ctx, d);
    ctx.restore();
  }

  for (let i = 0; i < 2; i++) {
    const G = GUNNERS[i];
    const hop = state.recoil[i] > 0 ? Math.sin(state.recoil[i] * Math.PI) * 6 : Math.sin(state.time * 2 + i) * 0.8;
    const cheering = state.phase === 'over' && state.king.targets && !state.king.targets.includes(i);
    drawCapybara(ctx, G.x, G.y - hop, { facing: G.facing, s: 0.45, blink: state.king.blinkAt < 0, happy: cheering });
    const C = CANNONS[i];
    const active = state.phase === 'aim' && player() === i;
    drawCannon(ctx, C.x, C.y, state.angles[i], PLAYER_COLORS[i], state.recoil[i], active);
  }

  const king = state.king;
  const inRiver = state.phase !== 'finale' && state.phase !== 'over';
  const kingOpts = {
    facing: king.facing,
    s: KING_SCALE * (1 + king.bonk * 0.15),
    mouth: king.mouth,
    blink: king.blinkAt < 0 || king.bonk > 0,
    happy: king.happy,
    crown: true,
  };
  const bob = inRiver ? Math.sin(state.time * 1.6) * 1.5 : 0;
  if (inRiver) drawCapybara(ctx, king.x, king.y + bob, kingOpts);
  drawRiver(ctx, state.time);
  const d = tasteDiff();
  if (Math.abs(d) > 0.01 && inRiver) drawSign(ctx, SIGN_X, d > 0 ? 1 : -1);
  if (!inRiver) drawCapybara(ctx, king.x, king.y, kingOpts);

  for (const p of state.projectiles) {
    if (p.delay > 0) continue;
    if (p.kind === 'glitter') {
      drawPiece(ctx, { ...p, size: p.size * (0.7 + 0.5 * Math.abs(Math.sin(state.time * 12 + p.seed))) });
    } else {
      drawPiece(ctx, p);
    }
  }
  drawAimPreview();
  drawFx();
  drawTexts();
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
      ctx.arc(x, y, 3 - i / 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  const C = CANNONS[player()];
  ctx.strokeStyle = PLAYER_COLORS[player()];
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(C.x, C.y, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v.power);
  ctx.stroke();
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

function drawTexts() {
  ctx.font = '900 15px ui-rounded, "SF Pro Rounded", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const t of state.texts) {
    ctx.globalAlpha = Math.min(1, t.life * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
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

buildRounds();
buildAvatars();
reset();
requestAnimationFrame(frame);

// the sprinkle mix art arrives a moment later: redraw everything that shows it
loadSprinkleArt('assets/sprinkles/', () => {
  layout();
  if (state.phase === 'aim') buildWeapons();
});
