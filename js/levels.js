'use strict';

// Each level is drawn in its own coordinate box (box.w × box.h level units);
// the game scales that box to fit the screen.
//   coverPath(ctx) adds the path of the area that can be decorated (used for the
//                  coverage mask – decorations landing outside it fall off)
//   fillRule       optional, 'evenodd' for shapes with holes (default 'nonzero')
//   drawBase(ctx)  draws the object under the decorations
//   drawTop(ctx, time) optional, draws parts that sit on top of the decorations
//   tools          tool ids available in this level (the last new one is auto-selected)
const OUTLINE = '#5a2d3c';
const SHINE = 'rgba(255, 255, 255, 0.45)';

// Closed wobbly circle: radius(angle) gives the radius at each angle.
function wobblyCircle(ctx, cx, cy, radius, steps = 120) {
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = radius(a);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shine(ctx, cx, cy, r, from, to, width) {
  ctx.strokeStyle = SHINE;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, r, from, to);
  ctx.stroke();
}

function outlined(ctx, fill, width = 6) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

const LEVELS = [
  {
    id: 'cupcake',
    bg: '#ffe3ee',
    box: { w: 300, h: 360 },
    target: 0.9,
    tools: ['sprinkles'],

    coverPath(ctx) {
      // frosting: three swirl tiers up to a peak, scalloped bottom edge
      ctx.moveTo(40, 222);
      ctx.bezierCurveTo(8, 214, 16, 164, 60, 160);
      ctx.bezierCurveTo(34, 150, 48, 104, 95, 108);
      ctx.bezierCurveTo(78, 82, 110, 54, 150, 42);
      ctx.bezierCurveTo(190, 54, 222, 82, 205, 108);
      ctx.bezierCurveTo(252, 104, 266, 150, 240, 160);
      ctx.bezierCurveTo(284, 164, 292, 214, 260, 222);
      for (let i = 0; i < 4; i++) {
        const x = 260 - i * 55;
        ctx.quadraticCurveTo(x - 27.5, 244, x - 55, 222);
      }
      ctx.closePath();
    },

    drawBase(ctx) {
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // wrapper
      const wrapper = new Path2D();
      wrapper.moveTo(58, 205);
      wrapper.lineTo(242, 205);
      wrapper.lineTo(216, 345);
      wrapper.quadraticCurveTo(150, 352, 84, 345);
      wrapper.closePath();
      ctx.fillStyle = '#ff9ec2';
      ctx.fill(wrapper);
      ctx.save();
      ctx.clip(wrapper);
      ctx.strokeStyle = '#e97aa5';
      ctx.lineWidth = 7;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(150 + i * 27, 205);
        ctx.lineTo(150 + i * 19, 350);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 6;
      ctx.stroke(wrapper);

      // frosting
      ctx.beginPath();
      this.coverPath(ctx);
      ctx.fillStyle = '#fff4f7';
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();

      // swirl lines between tiers
      ctx.strokeStyle = '#efc6d4';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(62, 162);
      ctx.quadraticCurveTo(150, 188, 238, 162);
      ctx.moveTo(97, 110);
      ctx.quadraticCurveTo(150, 128, 203, 110);
      ctx.stroke();
    },

    drawTop(ctx) {
      // cherry
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(152, 24);
      ctx.quadraticCurveTo(156, 6, 172, 0);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(150, 36, 17, 0, Math.PI * 2);
      ctx.fillStyle = '#ff3b5c';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(144, 30, 5, 3.5, -0.6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fill();
    },
  },

  {
    id: 'donut',
    bg: '#e3f4ff',
    box: { w: 300, h: 300 },
    target: 0.9,
    tools: ['sprinkles'],
    fillRule: 'evenodd',

    coverPath(ctx) {
      // icing ring with a wavy outer edge
      wobblyCircle(ctx, 150, 150, (a) => 118 + 8 * Math.sin(7 * a) + 4 * Math.sin(3 * a + 1));
      wobblyCircle(ctx, 150, 150, (a) => 55 + 3 * Math.sin(5 * a));
    },

    drawBase(ctx) {
      // dough
      ctx.beginPath();
      ctx.arc(150, 150, 138, 0, Math.PI * 2);
      ctx.moveTo(190, 150);
      ctx.arc(150, 150, 40, 0, Math.PI * 2);
      ctx.fillStyle = '#e8b46f';
      ctx.fill('evenodd');
      ctx.lineWidth = 6;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();

      // icing
      ctx.beginPath();
      this.coverPath(ctx);
      ctx.fillStyle = '#ff9fca';
      ctx.fill('evenodd');
      ctx.lineJoin = 'round';
      ctx.lineWidth = 5;
      ctx.stroke();

      shine(ctx, 150, 150, 92, 3.5, 4.5, 9);
    },
  },

  {
    id: 'cake',
    bg: '#fff4d6',
    box: { w: 320, h: 335 },
    target: 0.9,
    tools: ['sprinkles', 'nonpareils'],

    coverPath(ctx) {
      roundRectPath(ctx, 72, 100, 176, 100, 14); // top tier
      roundRectPath(ctx, 28, 200, 264, 110, 14); // bottom tier
    },

    drawBase(ctx) {
      // plate
      ctx.beginPath();
      ctx.ellipse(160, 316, 152, 15, 0, 0, Math.PI * 2);
      outlined(ctx, '#d6ecff');

      // sponge
      ctx.beginPath();
      this.coverPath(ctx);
      ctx.fillStyle = '#fff0d6';
      ctx.fill();

      // pink icing band with drips on top of each tier
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#ff9fca';
      for (const [x0, x1, y] of [[72, 248, 100], [28, 292, 200]]) {
        ctx.fillRect(x0, y, x1 - x0, 16);
        for (let x = x0 + 12, i = 0; x < x1; x += 22, i++) {
          const len = 10 + (i % 3) * 7;
          ctx.fillRect(x - 5, y, 10, len);
          ctx.beginPath();
          ctx.arc(x, y + len, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      ctx.beginPath();
      this.coverPath(ctx);
      ctx.lineJoin = 'round';
      ctx.lineWidth = 6;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    },

    drawTop(ctx, time) {
      [118, 160, 202].forEach((x, i) => {
        // candle with stripes
        ctx.beginPath();
        roundRectPath(ctx, x - 6, 58, 12, 44, 3);
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.clip();
        ctx.strokeStyle = ['#5cc8ff', '#ff5c9a', '#7ee07e'][i];
        ctx.lineWidth = 4;
        for (let y = 52; y < 110; y += 10) {
          ctx.beginPath();
          ctx.moveTo(x - 8, y + 6);
          ctx.lineTo(x + 8, y);
          ctx.stroke();
        }
        ctx.restore();
        ctx.lineWidth = 4;
        ctx.strokeStyle = OUTLINE;
        ctx.stroke();

        // flickering flame
        const f = Math.sin(time * 18 + i * 2) * 0.12;
        ctx.beginPath();
        ctx.ellipse(x, 44, 6.5 * (1 - f), 11 * (1 + f), 0, 0, Math.PI * 2);
        outlined(ctx, '#ffb238', 3);
        ctx.beginPath();
        ctx.ellipse(x, 47, 3, 5 * (1 + f), 0, 0, Math.PI * 2);
        ctx.fillStyle = '#fff3a0';
        ctx.fill();
      });
    },
  },

  {
    id: 'cone',
    bg: '#e6ffe9',
    box: { w: 300, h: 380 },
    target: 0.9,
    tools: ['sprinkles', 'nonpareils'],

    coverPath(ctx) {
      ctx.moveTo(222, 100);
      ctx.arc(150, 100, 72, 0, Math.PI * 2); // top scoop
      ctx.moveTo(255, 190);
      ctx.ellipse(150, 190, 105, 62, 0, 0, Math.PI * 2); // bottom scoop
    },

    drawBase(ctx) {
      // waffle cone
      const cone = new Path2D();
      cone.moveTo(58, 195);
      cone.lineTo(242, 195);
      cone.lineTo(150, 372);
      cone.closePath();
      ctx.fillStyle = '#e9b566';
      ctx.fill(cone);
      ctx.save();
      ctx.clip(cone);
      ctx.strokeStyle = '#c98d3f';
      ctx.lineWidth = 4;
      for (let k = -200; k < 400; k += 24) {
        ctx.beginPath();
        ctx.moveTo(k, 190);
        ctx.lineTo(k + 190, 380);
        ctx.moveTo(k + 190, 190);
        ctx.lineTo(k, 380);
        ctx.stroke();
      }
      ctx.restore();
      ctx.lineJoin = 'round';
      ctx.lineWidth = 6;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke(cone);

      // mint scoop on top, strawberry scoop in front of it
      ctx.beginPath();
      ctx.arc(150, 100, 72, 0, Math.PI * 2);
      outlined(ctx, '#b5f0d5');
      shine(ctx, 150, 100, 52, 3.6, 4.5, 8);

      ctx.beginPath();
      ctx.ellipse(150, 190, 105, 62, 0, 0, Math.PI * 2);
      outlined(ctx, '#ffb8cc');
      ctx.strokeStyle = SHINE;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.ellipse(150, 190, 80, 42, 0, 3.6, 4.4);
      ctx.stroke();
    },
  },

  {
    id: 'cookie',
    bg: '#f1e6ff',
    box: { w: 300, h: 300 },
    target: 0.9,
    tools: ['sprinkles', 'nonpareils', 'chocolate'],

    coverPath(ctx) {
      wobblyCircle(ctx, 150, 150, (a) => 132 + 4 * Math.sin(9 * a) + 3 * Math.sin(5 * a + 2));
    },

    drawBase(ctx) {
      ctx.beginPath();
      this.coverPath(ctx);
      outlined(ctx, '#e6ad62');

      // lighter middle, baked chocolate chips
      ctx.fillStyle = 'rgba(255, 225, 160, 0.45)';
      ctx.beginPath();
      ctx.arc(150, 150, 100, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a3322';
      [[95, 90, 11, 0.3], [190, 80, 9, 1.2], [215, 160, 12, 2.1], [140, 150, 10, 0.8],
        [80, 190, 9, 2.6], [170, 220, 11, 1.7], [115, 240, 7, 0.4], [235, 215, 7, 2.9],
        [60, 130, 6, 1.1], [150, 45, 7, 0.6]].forEach(([x, y, r, rot]) => {
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.75, rot, 0, Math.PI * 2);
        ctx.fill();
      });
    },
  },
];
