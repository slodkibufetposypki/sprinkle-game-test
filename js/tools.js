'use strict';

// Decorating tools. Positions are in level units (see level.box in levels.js).
//   rate        pieces per frame (at 60 fps) while the finger is down
//   perPx       extra pieces per screen pixel the finger moves
//   spread      scatter radius around the finger
//   coverRadius how much area one piece counts as covered
//   sound       Sfx function played while decorating
//   create(x,y) new piece; draw(ctx, piece, scale) draws it
//   onStick(piece, api) optional, called when a piece sticks to the object
//   drawIcon(ctx) draws the picker button icon in a 40×40 box
const CANDY_COLORS = ['#ff5c9a', '#ffd84d', '#5cc8ff', '#7ee07e', '#b98cff', '#ff3b5c', '#ff9a4d'];
const PIECE_SHADOW = 'rgba(70, 25, 45, 0.22)';
const CHOC = '#6b3a26';
const CHOC_LIGHT = '#94583a';

function pick(list) {
  return list[(Math.random() * list.length) | 0];
}

function rod(ctx, x, y, rot, len, width, color) {
  const cx = Math.cos(rot) * len / 2;
  const cy = Math.sin(rot) * len / 2;
  ctx.lineCap = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = PIECE_SHADOW;
  ctx.beginPath();
  ctx.moveTo(x - cx + 0.7, y - cy + 1);
  ctx.lineTo(x + cx + 0.7, y + cy + 1);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - cx, y - cy);
  ctx.lineTo(x + cx, y + cy);
  ctx.stroke();
}

function ball(ctx, x, y, r, color) {
  ctx.fillStyle = PIECE_SHADOW;
  ctx.beginPath();
  ctx.arc(x + 0.5, y + 0.8, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

const TOOLS = {
  sprinkles: {
    id: 'sprinkles',
    rate: 1.6,
    perPx: 0.22,
    spread: 26,
    coverRadius: 7,
    sound: 'tick',

    create(x, y) {
      return {
        tool: 'sprinkles',
        x,
        y,
        rot: Math.random() * Math.PI,
        len: 9 + Math.random() * 4,
        color: pick(CANDY_COLORS),
      };
    },

    draw(ctx, p, s = 1) {
      rod(ctx, p.x, p.y, p.rot, p.len * s, 3.6 * s, p.color);
    },

    drawIcon(ctx) {
      [[12, 12, 0.6, 0], [26, 10, 2.2, 1], [20, 22, 1.1, 2], [10, 28, 2.6, 4], [29, 28, 0.2, 6]]
        .forEach(([x, y, rot, c]) => rod(ctx, x, y, rot, 11, 4.5, CANDY_COLORS[c]));
    },
  },

  nonpareils: {
    id: 'nonpareils',
    rate: 4,
    perPx: 0.5,
    spread: 22,
    coverRadius: 4.5,
    sound: 'tick',

    create(x, y) {
      return { tool: 'nonpareils', x, y, r: 1.9 + Math.random() * 0.7, color: pick(CANDY_COLORS) };
    },

    draw(ctx, p, s = 1) {
      ball(ctx, p.x, p.y, p.r * s, p.color);
    },

    drawIcon(ctx) {
      for (let i = 0; i < 14; i++) {
        const a = i * 2.4;
        const r = 3 + (i % 5) * 3.2;
        ball(ctx, 20 + Math.cos(a) * r, 20 + Math.sin(a) * r, 2.8, CANDY_COLORS[i % CANDY_COLORS.length]);
      }
    },
  },

  // Blobs of chocolate under the finger; some of them start a drip that runs
  // down the object until it reaches the edge.
  chocolate: {
    id: 'chocolate',
    rate: 0.7,
    perPx: 0.1,
    spread: 10,
    coverRadius: 10,
    sound: 'blop',
    dripChance: 0.3,
    dripSpeed: 70, // level units / s

    create(x, y) {
      return { tool: 'chocolate', kind: 'dab', x, y, r: 8 + Math.random() * 5 };
    },

    onStick(p, api) {
      if (p.kind !== 'dab' || Math.random() > this.dripChance) return;
      api.addGrower({
        tool: 'chocolate',
        kind: 'drip',
        x: p.x + (Math.random() - 0.5) * p.r,
        y: p.y,
        w: 6 + Math.random() * 5,
        len: 0,
        max: 25 + Math.random() * 70,
        speed: this.dripSpeed * (0.7 + Math.random() * 0.6),
      });
    },

    // Grow a drip downwards; returns true when it's finished.
    grow(d, dt, api) {
      d.len += d.speed * dt;
      d.speed *= 1 - 0.6 * dt; // slows down as it runs
      const tipY = d.y + d.len;
      if (api.playing) api.stamp(d.x, tipY, d.w / 2 + 2);
      // stop at the object's edge (hanging a little over it) or at full length
      return d.len >= d.max || !api.isInside(d.x, tipY - 3);
    },

    draw(ctx, p, s = 1) {
      if (p.kind === 'drip') {
        const tipY = p.y + p.len;
        ctx.lineCap = 'round';
        ctx.lineWidth = p.w;
        ctx.strokeStyle = CHOC;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, tipY);
        ctx.stroke();
        ctx.fillStyle = CHOC;
        ctx.beginPath();
        ctx.arc(p.x, tipY, p.w * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = p.w * 0.25;
        ctx.strokeStyle = CHOC_LIGHT;
        ctx.beginPath();
        ctx.moveTo(p.x - p.w * 0.2, p.y + 2);
        ctx.lineTo(p.x - p.w * 0.2, tipY - 2);
        ctx.stroke();
        return;
      }
      const r = p.r * s;
      ctx.fillStyle = CHOC;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 230, 210, 0.22)';
      ctx.beginPath();
      ctx.arc(p.x - r * 0.35, p.y - r * 0.35, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    },

    drawIcon(ctx) {
      ctx.fillStyle = CHOC;
      ctx.beginPath();
      ctx.arc(20, 15, 11, 0, Math.PI * 2);
      ctx.fill();
      [[12, 30, 4], [21, 35, 5], [29, 25, 3.5]].forEach(([x, y, r]) => {
        ctx.fillRect(x - r * 0.7, 15, r * 1.4, y - 15);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = 'rgba(255, 230, 210, 0.35)';
      ctx.beginPath();
      ctx.arc(16, 11, 3, 0, Math.PI * 2);
      ctx.fill();
    },
  },
};
