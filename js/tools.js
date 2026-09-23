'use strict';

// Decorating tools. Positions are in level units (see level.box in levels.js).
//   rate        pieces per frame (at 60 fps) while the finger is down
//   perPx       extra pieces per screen pixel the finger moves
//   spread      scatter radius around the finger
//   coverRadius how much area one piece counts as covered
const TOOLS = {
  sprinkles: {
    id: 'sprinkles',
    rate: 1.6,
    perPx: 0.22,
    spread: 26,
    coverRadius: 7,
    colors: ['#ff5c9a', '#ffd84d', '#5cc8ff', '#7ee07e', '#b98cff', '#ff3b5c', '#ff9a4d'],

    create(x, y) {
      return {
        tool: 'sprinkles',
        x,
        y,
        rot: Math.random() * Math.PI,
        len: 9 + Math.random() * 4,
        color: this.colors[(Math.random() * this.colors.length) | 0],
      };
    },

    // Rounded rod with a small drop shadow. `s` scales the piece (landing bounce).
    draw(ctx, p, s = 1) {
      const h = (p.len / 2) * s;
      const cx = Math.cos(p.rot) * h;
      const cy = Math.sin(p.rot) * h;
      ctx.lineCap = 'round';
      ctx.lineWidth = 3.6 * s;

      ctx.strokeStyle = 'rgba(70, 25, 45, 0.22)';
      ctx.beginPath();
      ctx.moveTo(p.x - cx + 0.7, p.y - cy + 1);
      ctx.lineTo(p.x + cx + 0.7, p.y + cy + 1);
      ctx.stroke();

      ctx.strokeStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(p.x - cx, p.y - cy);
      ctx.lineTo(p.x + cx, p.y + cy);
      ctx.stroke();
    },
  },
};
