'use strict';

// The pastel sprinkle mix (recreated from the reference photo).
// Art: assets/sprinkles/<id>-<color>.svg. Sizes are in world units.
//   weight       how often the element appears in a shot
//   w, h         drawn size; r = collision radius
//   stamp, value how much tastiness a stuck piece adds (radius, per-cell value)
//   spin         'free' (any angle), 'small' (slight tilt) or 'none' (keeps its light from top-left)
const SPRINKLE_MIX = [
  { id: 'vermicelli', colors: ['turquoise', 'white', 'pink', 'violet'], weight: 34, w: 13.5, h: 5.4, r: 2.4, stamp: 10, value: 1, spin: 'free' },
  { id: 'nonpareil', colors: ['turquoise', 'pink', 'violet', 'gold'], weight: 34, w: 4.8, h: 4.8, r: 2.2, stamp: 7, value: 0.7, spin: 'none' },
  { id: 'pearl', colors: ['pink', 'violet', 'turquoise', 'white'], weight: 13, w: 7.8, h: 7.8, r: 3.5, stamp: 9, value: 1.1, spin: 'none' },
  { id: 'confetti', colors: ['violet', 'pink', 'white', 'turquoise'], weight: 12, w: 10.5, h: 10.5, r: 3, stamp: 10, value: 1.2, spin: 'small' },
  { id: 'heart-small', colors: ['pink'], weight: 6, w: 10.5, h: 10.5, r: 4, stamp: 10, value: 1.4, spin: 'small' },
  { id: 'heart-large', colors: ['white'], weight: 1, w: 24, h: 24, r: 8, stamp: 16, value: 3, spin: 'small' },
];

const SPRINKLE_BY_ID = Object.fromEntries(SPRINKLE_MIX.map((el) => [el.id, el]));
const SPRINKLE_ART = {}; // key ('vermicelli-pink') -> loaded SVG image
const SPRINKLE_BITMAPS = {}; // key -> pre-rendered canvas at the current screen scale
const SPRINKLE_TOTAL_WEIGHT = SPRINKLE_MIX.reduce((sum, el) => sum + el.weight, 0);

// Loads all SVGs from `base` (folder URL ending in '/'); calls onReady when done.
function loadSprinkleArt(base, onReady) {
  let pending = 0;
  for (const el of SPRINKLE_MIX) {
    for (const color of el.colors) {
      const key = `${el.id}-${color}`;
      const img = new Image();
      pending++;
      img.onload = img.onerror = () => {
        if (--pending === 0 && onReady) onReady();
      };
      img.src = `${base}${key}.svg`;
      SPRINKLE_ART[key] = img;
    }
  }
}

function sprinkleReady(key) {
  const img = SPRINKLE_ART[key];
  return img && img.complete && img.naturalWidth > 0;
}

// Pre-render every SVG at `pxPerUnit` device pixels per world unit (fast to draw).
function buildSprinkleBitmaps(pxPerUnit) {
  for (const el of SPRINKLE_MIX) {
    for (const color of el.colors) {
      const key = `${el.id}-${color}`;
      if (!sprinkleReady(key)) continue;
      const c = document.createElement('canvas');
      c.width = Math.max(2, Math.ceil(el.w * pxPerUnit * 1.5));
      c.height = Math.max(2, Math.ceil(el.h * pxPerUnit * 1.5));
      c.getContext('2d').drawImage(SPRINKLE_ART[key], 0, 0, c.width, c.height);
      SPRINKLE_BITMAPS[key] = c;
    }
  }
}

// A random piece of the mix: { el, key, rot }.
function pickSprinkle(noLargeHeart = false) {
  let roll = Math.random() * SPRINKLE_TOTAL_WEIGHT;
  let el = SPRINKLE_MIX[0];
  for (const e of SPRINKLE_MIX) {
    roll -= e.weight;
    if (roll <= 0) {
      el = e;
      break;
    }
  }
  if (noLargeHeart && el.id === 'heart-large') el = SPRINKLE_BY_ID['heart-small'];
  const color = el.colors[(Math.random() * el.colors.length) | 0];
  return { el: el.id, key: `${el.id}-${color}`, rot: sprinkleRotation(el) };
}

function sprinkleRotation(el) {
  if (el.spin === 'free') return Math.random() * Math.PI * 2;
  if (el.spin === 'small') return (Math.random() - 0.5) * 0.8;
  return 0;
}

// Draws a mix piece { el, key, x, y, rot } with a soft shadow; false if its art isn't ready.
function drawSprinklePiece(ctx, p, scale = 1) {
  const el = SPRINKLE_BY_ID[p.el];
  const art = SPRINKLE_BITMAPS[p.key] || (sprinkleReady(p.key) && SPRINKLE_ART[p.key]);
  if (!el || !art) return false;
  const w = el.w * scale;
  const h = el.h * scale;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot || 0);
  ctx.fillStyle = 'rgba(70, 40, 60, 0.26)';
  ctx.beginPath();
  ctx.ellipse(0.4, 0.7, w * 0.46, h * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(art, -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}
