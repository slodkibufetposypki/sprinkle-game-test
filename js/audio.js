'use strict';

// Generated sounds (Web Audio API) – no audio files.
// iOS only allows audio after a user gesture, so call Sfx.unlock() from touch handlers.
const Sfx = (() => {
  let ac = null;
  let master = null;
  let lastTick = 0;

  function unlock() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.5;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
  }

  function tone(freq, start, dur, type, vol, slideTo) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(master);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  // Tiny "tick" while sprinkling (throttled so it doesn't turn into noise).
  function tick() {
    if (!ac || ac.state !== 'running') return;
    const now = ac.currentTime;
    if (now - lastTick < 0.07) return;
    lastTick = now;
    tone(1500 + Math.random() * 900, now, 0.045, 'triangle', 0.06, 1000);
  }

  // Happy rising arpeggio + sparkles for "Sweet!".
  function sweet() {
    if (!ac || ac.state !== 'running') return;
    const now = ac.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone(f, now + i * 0.09, 0.28, 'triangle', 0.22);
    });
    for (let i = 0; i < 6; i++) {
      tone(2000 + Math.random() * 1500, now + 0.4 + i * 0.06, 0.12, 'sine', 0.07);
    }
  }

  return { unlock, tick, sweet };
})();
