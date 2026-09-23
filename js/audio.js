'use strict';

// Generated sounds (Web Audio API) – no audio files.
// iOS only allows audio after a user gesture (a finished tap, not touch start),
// so unlock() runs on every tap/click/key below and from the game's handlers.
const Sfx = (() => {
  let ac = null;
  let master = null;
  let lastTick = 0;
  let silentLoop = null;

  // A tiny silent WAV generated in code (0.1 s, 8-bit mono).
  function silentWavUrl() {
    const n = 4410;
    const v = new DataView(new ArrayBuffer(44 + n));
    const text = (at, s) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
    text(0, 'RIFF');
    v.setUint32(4, 36 + n, true);
    text(8, 'WAVEfmt ');
    v.setUint32(16, 16, true); // fmt chunk size
    v.setUint16(20, 1, true); // PCM
    v.setUint16(22, 1, true); // mono
    v.setUint32(24, 44100, true); // sample rate
    v.setUint32(28, 44100, true); // byte rate
    v.setUint16(32, 1, true); // block align
    v.setUint16(34, 8, true); // bits per sample
    text(36, 'data');
    v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128); // 128 = silence in 8-bit
    return URL.createObjectURL(new Blob([v.buffer], { type: 'audio/wav' }));
  }

  // iPhones mute web audio when the ring/silent switch is on. Asking for a
  // "playback" audio session (iOS 17+), or on older iOS keeping a silent
  // <audio> element playing, makes the game audible like a video would be.
  function bypassSilentSwitch() {
    if (navigator.audioSession) {
      try {
        navigator.audioSession.type = 'playback';
      } catch (e) {
        // not supported – fine
      }
      return;
    }
    if (!silentLoop) {
      silentLoop = new Audio(silentWavUrl());
      silentLoop.loop = true;
      silentLoop.setAttribute('playsinline', '');
    }
    if (silentLoop.paused) silentLoop.play().catch(() => {});
  }

  function unlock() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      bypassSilentSwitch();
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.5;
      master.connect(ac.destination);
    } else if (!navigator.audioSession) {
      bypassSilentSwitch();
    }
    // 'suspended' before the first tap, 'interrupted' on iOS after a call/app switch
    if (ac.state !== 'running') {
      ac.resume().catch(() => {});
      // older iOS only unlocks after something is actually played inside a tap
      const src = ac.createBufferSource();
      src.buffer = ac.createBuffer(1, 1, 22050);
      src.connect(ac.destination);
      src.start(0);
    }
  }

  for (const type of ['touchend', 'pointerup', 'click', 'keydown']) {
    document.addEventListener(type, unlock, { capture: true, passive: true });
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

  // Soft low "blop" for chocolate.
  function blop() {
    if (!ac || ac.state !== 'running') return;
    const now = ac.currentTime;
    if (now - lastTick < 0.12) return;
    lastTick = now;
    tone(260 + Math.random() * 80, now, 0.09, 'sine', 0.18, 120);
  }

  // Bright "ding" when a new tool appears.
  function ding() {
    if (!ac || ac.state !== 'running') return;
    const now = ac.currentTime;
    tone(1318.5, now, 0.25, 'triangle', 0.15);
    tone(1760, now + 0.08, 0.3, 'triangle', 0.12);
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

  // General-purpose tone, e.g. Sfx.play(440, 0.1, 'sine', 0.2, 220, 0.05).
  function play(freq, dur, type = 'sine', vol = 0.2, slideTo = 0, delay = 0) {
    if (!ac || ac.state !== 'running') return;
    tone(freq, ac.currentTime + delay, dur, type, vol, slideTo);
  }

  // Filtered noise burst: splats, chomps, whooshes.
  function noise(dur, vol = 0.2, freq = 1200, delay = 0, freqTo = 0) {
    if (!ac || ac.state !== 'running') return;
    const start = ac.currentTime + delay;
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, start);
    if (freqTo) filter.frequency.exponentialRampToValueAtTime(freqTo, start + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(start);
  }

  return {
    unlock,
    tick,
    blop,
    ding,
    sweet,
    play,
    noise,
    // for debugging in the console: 'none' | 'suspended' | 'running' | 'interrupted'
    get state() {
      return ac ? ac.state : 'none';
    },
  };
})();
