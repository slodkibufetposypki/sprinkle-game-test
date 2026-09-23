'use strict';

// ---------- UI text (all player-facing strings live here) ----------
const STRINGS = {
  levels: {
    cupcake: 'Cupcake',
    donut: 'Donut',
    cake: 'Birthday Cake',
    cone: 'Ice Cream Cone',
    cookie: 'Cookie',
  },
  tools: {
    sprinkles: 'Sprinkles',
    nonpareils: 'Nonpareils',
    chocolate: 'Chocolate Drip',
  },
  levelTitle: (n, name) => `${n}. ${name}`,
  coverage: (pct, goal) => `${pct}% · goal ${goal}%`,
  newTool: (name) => `New tool: ${name}!`,
  sweet: 'Sweet!',
  doneIn: (seconds) => `Done in ${seconds} s`,
  next: 'Next',
  playAgain: 'Play again',
};

// ---------- Tuning ----------
const SIDE_MARGIN = 16;
const CELL = 3; // coverage grid cell size, in level units
const LAND_TIME = 0.16; // s, landing bounce
const GRAVITY = 1600; // level units / s², for pieces falling off
const SHAKE_TIME = 0.5;
const WIN_POPUP_DELAY = 0.9;
const CONFETTI_COLORS = ['#ff5c9a', '#ffd84d', '#5cc8ff', '#7ee07e', '#b98cff', '#ff9a4d'];

// ---------- DOM ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const decor = document.createElement('canvas'); // baked decorations that have stuck
const dctx = decor.getContext('2d');

const ui = {
  hud: document.getElementById('hud'),
  levelName: document.getElementById('level-name'),
  meterFill: document.getElementById('meter-fill'),
  meterGoal: document.getElementById('meter-goal'),
  meterText: document.getElementById('meter-text'),
  win: document.getElementById('win'),
  winTitle: document.getElementById('win-title'),
  winTime: document.getElementById('win-time'),
  winBtn: document.getElementById('win-btn'),
  tools: document.getElementById('tools'),
  toast: document.getElementById('toast'),
};

// ---------- State ----------
const state = {
  levelIndex: 0,
  level: null,
  tool: TOOLS.sprinkles,
  // screen layout
  W: 0,
  H: 0,
  dpr: 1,
  scale: 1,
  ox: 0,
  oy: 0,
  // coverage grid
  mask: null,
  covered: null,
  gridW: 0,
  gridH: 0,
  total: 0,
  coveredCount: 0,
  shownPct: -1,
  // pieces
  stuck: [], // pieces that landed on the object (level units)
  live: [], // landing or falling pieces
  growing: [], // pieces that keep changing after they stick (chocolate drips)
  confetti: [], // screen-space celebration particles
  // input
  pointer: { id: null, down: false, x: 0, y: 0, px: 0, py: 0 },
  emitBudget: 0,
  // flow
  phase: 'playing', // 'playing' | 'won'
  startTime: 0,
  elapsed: 0,
  winTimer: 0,
  shake: 0,
};

// ---------- Level setup ----------
function loadLevel(index) {
  const level = LEVELS[index];
  const prevTools = index > 0 ? LEVELS[index - 1].tools : [];
  state.levelIndex = index;
  state.level = level;
  state.stuck = [];
  state.live = [];
  state.growing = [];
  state.confetti = [];
  state.coveredCount = 0;
  state.shownPct = -1;
  state.emitBudget = 0;
  state.phase = 'playing';
  state.startTime = 0;
  state.shake = 0;

  document.body.style.background = level.bg;
  ui.levelName.textContent = STRINGS.levelTitle(index + 1, STRINGS.levels[level.id]);
  ui.meterGoal.style.left = `${level.target * 100}%`;
  ui.win.classList.add('hidden');

  // pick the tool introduced in this level, else keep the current one if allowed
  const newTools = level.tools.filter((id) => !prevTools.includes(id));
  const newest = index > 0 ? newTools[newTools.length - 1] : null;
  if (newest) state.tool = TOOLS[newest];
  else if (!level.tools.includes(state.tool.id)) state.tool = TOOLS[level.tools[0]];
  buildToolPicker(level, newest);
  if (newest) showToast(STRINGS.newTool(STRINGS.tools[newest]));

  buildMask(level);
  layout();
  updateMeter();
}

// Rasterise the decoratable area into a coarse grid once per level.
function buildMask(level) {
  const gw = Math.ceil(level.box.w / CELL);
  const gh = Math.ceil(level.box.h / CELL);
  const c = document.createElement('canvas');
  c.width = gw;
  c.height = gh;
  const m = c.getContext('2d', { willReadFrequently: true });
  m.setTransform(1 / CELL, 0, 0, 1 / CELL, 0, 0);
  m.beginPath();
  level.coverPath(m);
  m.fill(level.fillRule || 'nonzero');
  const data = m.getImageData(0, 0, gw, gh).data;

  state.gridW = gw;
  state.gridH = gh;
  state.mask = new Uint8Array(gw * gh);
  state.covered = new Uint8Array(gw * gh);
  state.total = 0;
  for (let i = 0; i < gw * gh; i++) {
    if (data[i * 4 + 3] > 127) {
      state.mask[i] = 1;
      state.total++;
    }
  }
}

function isInside(x, y) {
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  if (cx < 0 || cy < 0 || cx >= state.gridW || cy >= state.gridH) return false;
  return state.mask[cy * state.gridW + cx] === 1;
}

// Mark grid cells around (x, y) as covered.
function stamp(x, y, radius) {
  const r = radius / CELL;
  const cx = x / CELL;
  const cy = y / CELL;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(state.gridW - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(state.gridH - 1, Math.ceil(cy + r));
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const dx = gx + 0.5 - cx;
      const dy = gy + 0.5 - cy;
      if (dx * dx + dy * dy > r * r) continue;
      const i = gy * state.gridW + gx;
      if (state.mask[i] && !state.covered[i]) {
        state.covered[i] = 1;
        state.coveredCount++;
      }
    }
  }
}

function coverage() {
  return state.total ? state.coveredCount / state.total : 0;
}

// ---------- Tool picker ----------
const ICON_SIZE = 40; // tool icons are drawn in a 40×40 box

function buildToolPicker(level, newest) {
  ui.tools.textContent = '';
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  for (const id of level.tools) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tool-btn';
    btn.dataset.tool = id;
    btn.setAttribute('aria-label', STRINGS.tools[id]);
    if (id === newest) btn.classList.add('is-new');

    const icon = document.createElement('canvas');
    icon.width = icon.height = ICON_SIZE * dpr;
    const ictx = icon.getContext('2d');
    ictx.setTransform(dpr, 0, 0, dpr, 0, 0);
    TOOLS[id].drawIcon(ictx);
    btn.appendChild(icon);

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Sfx.unlock();
      selectTool(id);
    });
    ui.tools.appendChild(btn);
  }
  markActiveTool();
}

function selectTool(id) {
  state.tool = TOOLS[id];
  state.emitBudget = 0;
  markActiveTool();
}

function markActiveTool() {
  for (const btn of ui.tools.children) {
    btn.classList.toggle('active', btn.dataset.tool === state.tool.id);
  }
}

let toastTimer = 0;
function showToast(text) {
  ui.toast.textContent = text;
  ui.toast.classList.remove('show');
  void ui.toast.offsetWidth; // restart the CSS animation
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 2200);
  Sfx.ding();
}

// ---------- Layout ----------
function layout() {
  const level = state.level;
  state.dpr = Math.min(window.devicePixelRatio || 1, 3);
  state.W = window.innerWidth;
  state.H = window.innerHeight;

  for (const c of [canvas, decor]) {
    c.width = Math.round(state.W * state.dpr);
    c.height = Math.round(state.H * state.dpr);
  }

  const top = ui.hud.getBoundingClientRect().bottom + 12;
  const bottom = ui.tools.getBoundingClientRect().top - 12;
  const availW = state.W - SIDE_MARGIN * 2;
  const availH = Math.max(100, bottom - top);
  state.scale = Math.min(availW / level.box.w, availH / level.box.h);
  state.ox = (state.W - level.box.w * state.scale) / 2;
  state.oy = top + (availH - level.box.h * state.scale) / 2;

  rebakeDecor();
}

function setLevelTransform(c, dpr) {
  const k = dpr * state.scale;
  c.setTransform(k, 0, 0, k, dpr * state.ox, dpr * state.oy);
}

function rebakeDecor() {
  dctx.setTransform(1, 0, 0, 1, 0, 0);
  dctx.clearRect(0, 0, decor.width, decor.height);
  setLevelTransform(dctx, state.dpr);
  for (const p of state.stuck) TOOLS[p.tool].draw(dctx, p);
}

function toLevel(sx, sy) {
  return { x: (sx - state.ox) / state.scale, y: (sy - state.oy) / state.scale };
}

// ---------- Input ----------
canvas.addEventListener('pointerdown', (e) => {
  Sfx.unlock();
  if (state.pointer.down || state.phase !== 'playing') return;
  canvas.setPointerCapture(e.pointerId);
  const p = state.pointer;
  p.id = e.pointerId;
  p.down = true;
  p.x = p.px = e.clientX;
  p.y = p.py = e.clientY;
  if (!state.startTime) state.startTime = performance.now();
});

canvas.addEventListener('pointermove', (e) => {
  const p = state.pointer;
  if (!p.down || e.pointerId !== p.id) return;
  p.x = e.clientX;
  p.y = e.clientY;
});

function endPointer(e) {
  Sfx.unlock(); // iOS sometimes only accepts the unlock on touch end
  if (e.pointerId !== state.pointer.id) return;
  state.pointer.down = false;
  state.pointer.id = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

ui.winBtn.addEventListener('click', () => {
  Sfx.unlock();
  loadLevel((state.levelIndex + 1) % LEVELS.length);
});

window.addEventListener('resize', layout);

// ---------- Update ----------
function emit(dt) {
  const p = state.pointer;
  const tool = state.tool;
  const moved = Math.hypot(p.x - p.px, p.y - p.py);
  state.emitBudget = Math.min(state.emitBudget + tool.rate * dt * 60 + moved * tool.perPx, 40);
  const n = Math.floor(state.emitBudget);
  state.emitBudget -= n;

  for (let i = 0; i < n; i++) {
    // spread pieces along the finger's path since last frame
    const t = Math.random();
    const at = toLevel(p.px + (p.x - p.px) * t, p.py + (p.y - p.py) * t);
    const a = Math.random() * Math.PI * 2;
    const r = tool.spread * Math.sqrt(Math.random());
    const piece = tool.create(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r);
    state.live.push({ piece, mode: 'landing', t: 0, vx: 0, vy: 0, vr: 0 });
  }
  if (n > 0) Sfx[tool.sound]();

  p.px = p.x;
  p.py = p.y;
}

// What tools can do to the object from their hooks (onStick / grow).
const toolApi = {
  isInside,
  stamp,
  addGrower: (piece) => state.growing.push(piece),
  get playing() {
    return state.phase === 'playing';
  },
};

function stick(piece) {
  state.stuck.push(piece);
  TOOLS[piece.tool].draw(dctx, piece);
}

function land(q) {
  const piece = q.piece;
  const tool = TOOLS[piece.tool];
  if (isInside(piece.x, piece.y)) {
    q.dead = true;
    stick(piece);
    if (state.phase === 'playing') stamp(piece.x, piece.y, tool.coverRadius);
    if (tool.onStick) tool.onStick(piece, toolApi);
  } else {
    // missed the object: hop and fall off the screen
    q.mode = 'falling';
    q.vx = (Math.random() - 0.5) * 90;
    q.vy = -60 - Math.random() * 90;
    q.vr = (Math.random() - 0.5) * 14;
  }
}

function update(dt) {
  if (state.phase === 'playing' && state.pointer.down) emit(dt);

  const bottom = (state.H - state.oy) / state.scale + 30;
  for (const q of state.live) {
    if (q.mode === 'landing') {
      q.t += dt;
      if (q.t >= LAND_TIME) land(q);
    } else {
      q.vy += GRAVITY * dt;
      q.piece.x += q.vx * dt;
      q.piece.y += q.vy * dt;
      q.piece.rot += q.vr * dt;
      if (q.piece.y > bottom) q.dead = true;
    }
  }
  state.live = state.live.filter((q) => !q.dead);

  state.growing = state.growing.filter((g) => {
    if (!TOOLS[g.tool].grow(g, dt, toolApi)) return true;
    stick(g);
    return false;
  });

  for (const c of state.confetti) {
    c.vy += 900 * dt;
    c.vx *= 1 - 1.5 * dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.rot += c.vr * dt;
    c.life -= dt;
  }
  state.confetti = state.confetti.filter((c) => c.life > 0 && c.y < state.H + 40);

  state.shake = Math.max(0, state.shake - dt);

  if (state.phase === 'playing') {
    updateMeter();
    if (coverage() >= state.level.target) win();
  } else if (state.winTimer > 0) {
    state.winTimer -= dt;
    if (state.winTimer <= 0) showWinPopup();
  }
}

function updateMeter() {
  const pct = Math.min(100, Math.floor(coverage() * 100));
  if (pct === state.shownPct) return;
  state.shownPct = pct;
  ui.meterFill.style.width = `${pct}%`;
  ui.meterText.textContent = STRINGS.coverage(pct, Math.round(state.level.target * 100));
}

function win() {
  state.phase = 'won';
  state.pointer.down = false;
  state.elapsed = (performance.now() - state.startTime) / 1000;
  state.winTimer = WIN_POPUP_DELAY;
  state.shake = SHAKE_TIME;
  updateMeter();
  Sfx.sweet();
  if (navigator.vibrate) navigator.vibrate([30, 40, 60]);

  const cx = state.ox + (state.level.box.w * state.scale) / 2;
  const cy = state.oy + (state.level.box.h * state.scale) * 0.4;
  for (let i = 0; i < 160; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
    const speed = 350 + Math.random() * 650;
    state.confetti.push({
      x: cx,
      y: cy,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 16,
      w: 6 + Math.random() * 6,
      h: 4 + Math.random() * 4,
      color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
      life: 2 + Math.random() * 1.5,
    });
  }
}

function showWinPopup() {
  ui.winTitle.textContent = STRINGS.sweet;
  ui.winTime.textContent = STRINGS.doneIn(state.elapsed.toFixed(1));
  const isLast = state.levelIndex === LEVELS.length - 1;
  ui.winBtn.textContent = isLast ? STRINGS.playAgain : STRINGS.next;
  ui.win.classList.remove('hidden');
}

// ---------- Render ----------
function easeOutBack(k) {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
}

function render() {
  const { dpr, W, H, level } = state;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = level.bg;
  ctx.fillRect(0, 0, W, H);

  let sx = 0;
  let sy = 0;
  if (state.shake > 0) {
    const k = (state.shake / SHAKE_TIME) * 12;
    sx = (Math.random() * 2 - 1) * k;
    sy = (Math.random() * 2 - 1) * k;
  }

  // object
  const k = dpr * state.scale;
  ctx.setTransform(k, 0, 0, k, dpr * (state.ox + sx), dpr * (state.oy + sy));
  level.drawBase(ctx);

  // stuck decorations
  ctx.setTransform(dpr, 0, 0, dpr, dpr * sx, dpr * sy);
  ctx.drawImage(decor, 0, 0, W, H);

  // growing drips, top layer, pieces in flight
  ctx.setTransform(k, 0, 0, k, dpr * (state.ox + sx), dpr * (state.oy + sy));
  for (const g of state.growing) TOOLS[g.tool].draw(ctx, g);
  if (level.drawTop) level.drawTop(ctx, performance.now() / 1000);
  for (const q of state.live) {
    const tool = TOOLS[q.piece.tool];
    if (q.mode === 'landing') {
      const t = Math.min(1, q.t / LAND_TIME);
      ctx.globalAlpha = Math.min(1, t * 3);
      tool.draw(ctx, q.piece, 1.8 - 0.8 * easeOutBack(t));
    } else {
      tool.draw(ctx, q.piece);
    }
  }
  ctx.globalAlpha = 1;

  // confetti (screen space)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const c of state.confetti) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.scale(1, Math.cos(c.rot * 2)); // flutter
    ctx.globalAlpha = Math.min(1, c.life);
    ctx.fillStyle = c.color;
    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ---------- Loop ----------
let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

loadLevel(0);
requestAnimationFrame(frame);
