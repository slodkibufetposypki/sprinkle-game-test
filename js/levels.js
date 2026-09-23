'use strict';

// Each level is drawn in its own coordinate box (box.w × box.h level units);
// the game scales that box to fit the screen.
//   coverPath(ctx) adds the path of the area that can be decorated (used for the
//                  coverage mask – decorations landing outside it fall off)
//   drawBase(ctx)  draws the object under the decorations
//   drawTop(ctx)   optional, draws parts that sit on top of the decorations
const OUTLINE = '#5a2d3c';

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
];
