import * as THREE from 'three';

/* =========================================================
   ANJAL.EXE · THE RECRUIT'S JOURNEY
   ========================================================= */

const LEVEL_NAMES = [
  'IDENTITY', 'SKILL TREE', 'ARMORY',
  'QUEST LOG', 'GUILD HALL', 'RECRUIT'
];

const XP_PER_LEVEL = [500, 800, 1200, 1500, 1000, 10000];

/* -----------------------------------------------
   GAME STATE
   ----------------------------------------------- */
const game = {
  started: false,
  currentLevel: 0,   // 1-based when set; 0 = not started
  maxLevel: 6,
  visited: new Set(),
  xp: 0,
  hp: 100
};

/* -----------------------------------------------
   HELPERS
   ----------------------------------------------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

function pad(n, len = 4) { return String(n).padStart(len, '0'); }
function padComma(n) { return n.toLocaleString('en-US', { minimumIntegerDigits: 6, useGrouping: true }).replace(/,/g, ','); }

/* -----------------------------------------------
   WEB AUDIO · ARCADE SFX
   ----------------------------------------------- */
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return null; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone(freq, dur, { type = 'square', vol = 0.08, glide = 0 } = {}) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + glide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(t); osc.stop(t + dur + 0.05);
}

const sfx = {
  click: () => { tone(880, 0.05, { vol: 0.04 }); tone(1320, 0.04, { vol: 0.03 }); },
  select: () => tone(660, 0.08, { type: 'square', vol: 0.05 }),
  levelUp: () => {
    tone(523, 0.1, { vol: 0.08 });
    setTimeout(() => tone(659, 0.1, { vol: 0.08 }), 80);
    setTimeout(() => tone(784, 0.1, { vol: 0.08 }), 160);
    setTimeout(() => tone(1047, 0.25, { vol: 0.09 }), 240);
  },
  coin: () => { tone(988, 0.06, { vol: 0.06 }); setTimeout(() => tone(1319, 0.12, { vol: 0.06 }), 55); },
  error: () => tone(180, 0.2, { type: 'sawtooth', vol: 0.08, glide: -80 }),
  start: () => {
    [262, 330, 392, 523, 659].forEach((f, i) => setTimeout(() => tone(f, 0.12, { vol: 0.09 }), i * 70));
  },
  achieve: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.1, { type: 'triangle', vol: 0.08 }), i * 60));
  },
  konami: () => {
    [440, 554, 659, 880, 1108, 1319, 1760].forEach((f, i) =>
      setTimeout(() => tone(f, 0.12, { type: 'triangle', vol: 0.1 }), i * 80));
  },
  typewrite: () => tone(1600 + Math.random() * 200, 0.01, { type: 'square', vol: 0.02 })
};

/* -----------------------------------------------
   MULTI-TRACK MUSIC ENGINE
   Tracks: SYNTHWAVE · ARCADE · BEAST MODE
   ----------------------------------------------- */
const music = (() => {
  let playing = false;
  let schedTimer = null;
  let stepIdx = 0;
  let nextTime = 0;
  let masterGain = null;
  let currentTrack = 0;

  // Note frequencies
  const A2 = 110, E2 = 82.4, G2 = 98, D3 = 146.8, C3 = 130.8, F2 = 87.3;
  const A3 = 220, C4 = 261.6, E4 = 329.6, G4 = 392, D4 = 293.7, F4 = 349.2;
  const A4 = 440, C5 = 523, D5 = 587, E5 = 659, G5 = 784, A5 = 880, B4 = 493.9, F5 = 698.5;

  // Three distinct 16-step tracks
  const TRACKS = [
    {
      name: 'SYNTHWAVE',
      bpm: 128,
      kick:  [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat:   [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
      bass:  [A2, 0, 0, A2, 0, 0, E2, 0, G2, 0, 0, G2, 0, 0, A2, 0],
      lead:  [0, 0, 0, 0, A4, 0, C5, 0, E5, 0, D5, 0, C5, 0, A4, 0],
      leadType: 'square',
      bassType: 'sawtooth',
      bassCut: 720
    },
    {
      name: 'ARCADE FUNK',
      bpm: 160,
      kick:  [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
      hat:   [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      bass:  [A2, 0, A2, 0, C3, 0, E2, 0, A2, 0, G2, 0, D3, 0, E2, 0],
      lead:  [A4, C5, E5, G5, A5, G5, E5, C5, G4, A4, B4, C5, D5, C5, A4, G4],
      leadType: 'triangle',
      bassType: 'square',
      bassCut: 900
    },
    {
      name: 'BEAST MODE',
      bpm: 144,
      kick:  [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat:   [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      bass:  [A2, A2, 0, E2, 0, E2, 0, G2, A2, 0, A2, 0, F2, 0, G2, 0],
      lead:  [0, 0, A4, 0, 0, E5, 0, 0, A5, 0, 0, E5, 0, G5, A5, 0],
      leadType: 'sawtooth',
      bassType: 'sawtooth',
      bassCut: 1100
    }
  ];

  let track = TRACKS[0];

  function ensureMaster() {
    const ctx = ensureAudio();
    if (!ctx) return null;
    if (!masterGain) {
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.55;
      // a touch of reverb via delay
      const delay = ctx.createDelay();
      delay.delayTime.value = 0.25;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.22;
      const wet = ctx.createGain();
      wet.gain.value = 0.25;
      masterGain.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(ctx.destination);
      masterGain.connect(ctx.destination);
    }
    return ctx;
  }

  function kick(t) {
    const ctx = ensureMaster();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g).connect(masterGain);
    o.start(t); o.stop(t + 0.22);
  }

  function snare(t) {
    const ctx = ensureMaster();
    const bufSize = ctx.sampleRate * 0.12;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass'; hp.frequency.value = 1800; hp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src.connect(hp).connect(g).connect(masterGain);
    src.start(t);
  }

  function hat(t) {
    const ctx = ensureMaster();
    const bufSize = ctx.sampleRate * 0.04;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 8000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    src.connect(hp).connect(g).connect(masterGain);
    src.start(t);
  }

  function bassNote(freq, t, dur = 0.22) {
    const ctx = ensureMaster();
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = track.bassType; o.frequency.value = freq;
    o2.type = 'square'; o2.frequency.value = freq / 2;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = track.bassCut; lp.Q.value = 6;
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(lp); o2.connect(lp); lp.connect(g).connect(masterGain);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  function leadNote(freq, t, dur = 0.3) {
    const ctx = ensureMaster();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = track.leadType;
    o.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 3200;
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(lp).connect(g).connect(masterGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function scheduleStep(i, t) {
    if (track.kick[i])  kick(t);
    if (track.snare[i]) snare(t);
    if (track.hat[i])   hat(t);
    if (track.bass[i])  bassNote(track.bass[i], t);
    if (track.lead[i])  leadNote(track.lead[i], t);
  }

  function tick() {
    if (!playing) return;
    const ctx = ensureMaster();
    if (!ctx) return;
    const STEP = 60 / track.bpm / 4;
    while (nextTime < ctx.currentTime + 0.12) {
      scheduleStep(stepIdx, nextTime);
      nextTime += STEP;
      stepIdx = (stepIdx + 1) % 16;
    }
    schedTimer = setTimeout(tick, 25);
  }

  function setTrack(idx) {
    currentTrack = ((idx % TRACKS.length) + TRACKS.length) % TRACKS.length;
    track = TRACKS[currentTrack];
    stepIdx = 0;
    const t = document.getElementById('mpTrack');
    if (t) t.textContent = track.name;
  }

  function nextTrack() { setTrack(currentTrack + 1); sfx.click(); }
  function prevTrack() { setTrack(currentTrack - 1); sfx.click(); }
  function getTrackName() { return track.name; }

  function updateUI() {
    const mp = document.getElementById('musicPlayer');
    const mpPower = document.getElementById('mpPower');
    const mpPlay = document.getElementById('mpPlay');
    const mpTrack = document.getElementById('mpTrack');
    const musicBtn = document.getElementById('musicBtn');
    const musicLabel = document.getElementById('musicLabel');

    if (mp) mp.classList.toggle('paused', !playing);
    if (mpPower) mpPower.textContent = playing ? 'ON' : 'OFF';
    if (mpPlay) mpPlay.textContent = playing ? '■' : '▶';
    if (mpTrack) mpTrack.textContent = track.name;
    if (musicBtn) musicBtn.classList.toggle('muted', !playing);
    if (musicLabel) musicLabel.textContent = playing ? 'ON' : 'OFF';
  }

  function start() {
    const ctx = ensureMaster();
    if (!ctx || playing) return;
    playing = true;
    nextTime = ctx.currentTime + 0.05;
    stepIdx = 0;
    tick();
    updateUI();
  }

  function stop() {
    playing = false;
    if (schedTimer) clearTimeout(schedTimer);
    if (masterGain && audioCtx) masterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
    setTimeout(() => {
      if (masterGain) masterGain.gain.value = 0.55;
    }, 300);
    updateUI();
  }

  return {
    start,
    stop,
    toggle: () => playing ? stop() : start(),
    isPlaying: () => playing,
    next: nextTrack,
    prev: prevTrack,
    trackName: getTrackName
  };
})();

/* Auto-pause music when tab loses focus · resume on return */
(() => {
  let wasPlaying = false;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      wasPlaying = music.isPlaying();
      if (wasPlaying) music.stop();
    } else if (wasPlaying) {
      music.start();
    }
  });
  window.addEventListener('blur', () => {
    if (music.isPlaying()) {
      wasPlaying = true;
      music.stop();
    }
  });
  window.addEventListener('focus', () => {
    if (wasPlaying && !music.isPlaying()) music.start();
  });
})();

/* -----------------------------------------------
   SCREEN SHAKE
   ----------------------------------------------- */
function shake(duration = 400) {
  document.body.classList.remove('shake');
  void document.body.offsetWidth;
  document.body.classList.add('shake');
  setTimeout(() => document.body.classList.remove('shake'), duration);
}

/* -----------------------------------------------
   FX CANVAS · particle bursts + mouse trail
   ----------------------------------------------- */
(() => {
  const fx = $('#fxCanvas');
  const ctx = fx.getContext('2d');
  const resize = () => { fx.width = innerWidth; fx.height = innerHeight; };
  resize();
  addEventListener('resize', resize);

  const particles = [];
  const trail = [];

  function burst(x, y, color = '#00ff88', count = 18) {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const spd = 2 + Math.random() * 3;
      particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 1,
        color,
        size: 2 + Math.random() * 2
      });
    }
  }
  window.__burst = burst;

  addEventListener('click', e => {
    const pal = ['#00ff88', '#ffdd33', '#7cf5ff', '#ff3df0'];
    burst(e.clientX, e.clientY, pal[Math.floor(Math.random() * pal.length)]);
  });

  addEventListener('mousemove', e => {
    trail.push({ x: e.clientX, y: e.clientY, life: 1 });
    if (trail.length > 30) trail.shift();
  });

  function loop() {
    ctx.clearRect(0, 0, fx.width, fx.height);

    // Mouse trail
    for (let i = 0; i < trail.length; i++) {
      const p = trail[i];
      p.life -= 0.04;
      if (p.life <= 0) continue;
      ctx.fillStyle = `rgba(0,255,136,${p.life * 0.35})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2 * p.life, 0, Math.PI * 2);
      ctx.fill();
    }

    // Burst particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.vy += 0.08; // gravity
      p.life -= 0.025;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    requestAnimationFrame(loop);
  }
  loop();
})();

/* -----------------------------------------------
   CONFETTI (for GOD MODE)
   ----------------------------------------------- */
const confetti = (() => {
  const c = $('#confettiCanvas');
  const ctx = c.getContext('2d');
  c.width = innerWidth; c.height = innerHeight;
  addEventListener('resize', () => { c.width = innerWidth; c.height = innerHeight; });
  const pieces = [];
  let running = false;

  function fire(count = 180) {
    const pal = ['#ffdd33', '#ff3df0', '#7cf5ff', '#00ff88', '#ffaa00'];
    for (let i = 0; i < count; i++) {
      pieces.push({
        x: innerWidth / 2 + (Math.random() - 0.5) * 200,
        y: innerHeight / 2,
        vx: (Math.random() - 0.5) * 14,
        vy: -(8 + Math.random() * 10),
        g: 0.35,
        size: 4 + Math.random() * 4,
        color: pal[Math.floor(Math.random() * pal.length)],
        rot: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 0.3,
        life: 1
      });
    }
    if (!running) { running = true; step(); }
  }

  function step() {
    ctx.clearRect(0, 0, c.width, c.height);
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.g;
      p.vx *= 0.99;
      p.rot += p.rotSpeed;
      p.life -= 0.004;
      if (p.y > c.height + 50 || p.life <= 0) { pieces.splice(i, 1); continue; }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (pieces.length) requestAnimationFrame(step);
    else running = false;
  }
  return { fire };
})();

/* -----------------------------------------------
   CUSTOM CURSOR
   ----------------------------------------------- */
(() => {
  const dot = $('#cursorDot');
  const ring = $('#cursorRing');
  let mx = innerWidth / 2, my = innerHeight / 2;
  let rx = mx, ry = my;

  addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
  });

  const loop = () => {
    rx += (mx - rx) * 0.2;
    ry += (my - ry) * 0.2;
    ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
    requestAnimationFrame(loop);
  };
  loop();

  // Hover effect via event delegation
  document.addEventListener('mouseover', e => {
    if (e.target.closest('button, a, .story-node, .item-slot, .guild-card, .map-node, .skill-cell, .ability'))
      ring.classList.add('hover');
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest('button, a, .story-node, .item-slot, .guild-card, .map-node, .skill-cell, .ability'))
      ring.classList.remove('hover');
  });
})();

/* -----------------------------------------------
   TOAST / XP SYSTEM
   ----------------------------------------------- */
function showToast(label, main, icon = '★') {
  const stack = $('#toastStack');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `
    <span class="t-icon">${icon}</span>
    <div>
      <div class="t-label">${label}</div>
      <div class="t-main">${main}</div>
    </div>`;
  stack.appendChild(t);
  setTimeout(() => t.remove(), 3400);
}

function popXP(amount, x, y) {
  const layer = $('#xpLayer');
  const el = document.createElement('div');
  el.className = 'xp-pop';
  el.textContent = `+${amount} XP`;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

function addXP(amount, position) {
  game.xp += amount;
  $('#xpValue').textContent = pad(game.xp);
  $('#hsYour').textContent = padComma(game.xp);
  if ($('#finalXP')) $('#finalXP').textContent = game.xp.toLocaleString();

  if (position) popXP(amount, position.x, position.y);
}

/* -----------------------------------------------
   GLITCH TRANSITION
   ----------------------------------------------- */
function glitch(ms = 220) {
  const g = $('#glitchLayer');
  g.classList.add('active');
  setTimeout(() => g.classList.remove('active'), ms);
}

/* -----------------------------------------------
   BIOS BOOT SEQUENCE
   ----------------------------------------------- */
const BIOS_LINES = [
  { t: 'MEMORY CHECK.......................... ', tail: 'OK', cls: 'ok' },
  { t: 'WEBGL CONTEXT......................... ', tail: 'DETECTED', cls: 'ok' },
  { t: 'THREE.JS CORE......................... ', tail: 'v0.160.0', cls: 'info' },
  { t: 'AUDIO SYNTHESIZER..................... ', tail: 'READY', cls: 'ok' },
  { t: 'NEURAL NETWORK........................ ', tail: 'ONLINE', cls: 'ok' },
  { t: 'LOADING CANDIDATE: ANJAL KARKI', cls: 'info' },
  { t: '  ↳ ORIGIN: NEPAL → MOSCOW, ID', cls: 'dim' },
  { t: '  ↳ STATUS: CLASS OF 2027 · GPA 3.75', cls: 'dim' },
  { t: '  ↳ LANGUAGES: 7 UNLOCKED', cls: 'dim' },
  { t: '  ↳ PROJECTS: 6 ITEMS INDEXED', cls: 'dim' },
  { t: '  ↳ GUILDS: 4 REGISTERED', cls: 'dim' },
  { t: '', cls: '' },
  { t: 'SCANNING FOR INTERNSHIP OPPORTUNITIES..', tail: 'ACTIVE', cls: 'warn' },
  { t: 'AVAILABILITY.......................... ', tail: 'OPEN · 2026', cls: 'ok' },
  { t: '', cls: '' },
  { t: '>>> BOOT COMPLETE · LAUNCHING GAME <<<', cls: 'info' }
];

let biosDone = false;
function runBIOS() {
  const log = $('#biosLog');
  let i = 0;
  const step = () => {
    if (i >= BIOS_LINES.length) {
      setTimeout(endBIOS, 800);
      return;
    }
    const L = BIOS_LINES[i++];
    const line = document.createElement('span');
    line.className = `bl-line ${L.cls || ''}`;
    line.textContent = L.tail ? `${L.t}${L.tail}` : L.t;
    log.appendChild(line);
    if (L.tail) sfx.typewrite();
    setTimeout(step, L.t === '' ? 40 : 120 + Math.random() * 50);
  };
  step();
}

function endBIOS() {
  if (biosDone) return;
  biosDone = true;
  $('#biosScreen').classList.add('hidden');
  $('#startScreen').classList.remove('hidden');
}

$('#biosScreen').addEventListener('click', endBIOS);

/* -----------------------------------------------
   ACHIEVEMENT SYSTEM
   ----------------------------------------------- */
const ACHIEVEMENTS = {
  first_contact: { title: 'FIRST CONTACT', desc: 'You pressed START. Welcome, recruit.' },
  scholar: { title: 'SCHOLAR', desc: 'Surveyed the entire skill tree.' },
  treasure_hunter: { title: 'TREASURE HUNTER', desc: 'Inspected an artifact in the armory.' },
  completionist: { title: 'COMPLETIONIST', desc: 'Inspected every artifact.' },
  veteran: { title: 'VETERAN', desc: 'Reviewed the full quest log.' },
  socialite: { title: 'SOCIALITE', desc: 'Walked the Guild Hall.' },
  mission_complete: { title: 'MISSION COMPLETE', desc: 'Reached the final level.' },
  secret_agent: { title: 'SECRET AGENT', desc: 'You found the Konami code. Respect.' },
  explorer: { title: 'EXPLORER', desc: 'Opened the world map.' },
  speedrun: { title: 'SPEEDRUN', desc: 'Cleared the game in under 90 seconds.' }
};

const unlocked = new Set();
function unlock(id) {
  if (unlocked.has(id) || !ACHIEVEMENTS[id]) return;
  unlocked.add(id);
  const ach = ACHIEVEMENTS[id];
  $('#achTitle').textContent = ach.title;
  $('#achDesc').textContent = ach.desc;
  const el = $('#achievement');
  el.classList.add('show');
  sfx.achieve();
  setTimeout(() => el.classList.remove('show'), 3600);
}

/* -----------------------------------------------
   SESSION TIMER
   ----------------------------------------------- */
let sessionStart = 0;
const timerEl = $('#sessionTimer');
const stValue = $('#stValue');
setInterval(() => {
  if (!sessionStart) return;
  const secs = Math.floor((Date.now() - sessionStart) / 1000);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  stValue.textContent = `${mm}:${ss}`;
}, 500);

/* -----------------------------------------------
   KONAMI CODE
   ----------------------------------------------- */
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiIdx = 0;
const godModeEl = $('#godMode');

function triggerGodMode() {
  if (document.body.classList.contains('god-mode-on')) return;
  document.body.classList.add('god-mode-on');
  godModeEl.classList.add('active');
  unlock('secret_agent');
  sfx.konami();
  confetti.fire(280);
  shake(600);
  setTimeout(() => confetti.fire(120), 700);
  game.xp += 50000;
  $('#xpValue').textContent = pad(game.xp);
  $('#hsYour').textContent = padComma(game.xp);
}

function closeGodMode() {
  godModeEl.classList.remove('active');
}

$('#gmClose').addEventListener('click', closeGodMode);
godModeEl.addEventListener('click', e => {
  if (e.target === godModeEl) closeGodMode();
});

/* -----------------------------------------------
   START SCREEN -> GAME
   ----------------------------------------------- */
function startGame() {
  if (game.started) return;
  game.started = true;
  sessionStart = Date.now();
  timerEl.classList.add('active');
  $('#startScreen').classList.add('hidden');
  $('#hud').classList.add('active');
  $('#musicPlayer').classList.add('active');
  glitch(260);
  goToLevel(1);
  sfx.start();
  unlock('first_contact');
  showToast('QUEST STARTED', 'The Recruit\'s Journey · Begin', '◆');
  // Beast mode beat
  setTimeout(() => music.start(), 600);
}

$('#startBtn').addEventListener('click', startGame);
$('#musicBtn').addEventListener('click', () => { music.toggle(); sfx.click(); });
$('#mpPower').addEventListener('click', () => { music.toggle(); sfx.click(); });
$('#mpPlay').addEventListener('click', () => { music.toggle(); sfx.click(); });
$('#mpNext').addEventListener('click', () => music.next());
$('#mpPrev').addEventListener('click', () => music.prev());

/* -----------------------------------------------
   LEVEL NAVIGATION
   ----------------------------------------------- */
function goToLevel(n) {
  if (n < 1 || n > game.maxLevel) return;
  if (!game.started) startGame();

  const prev = game.currentLevel;
  if (prev === n) return;

  const levels = $$('.level');
  levels.forEach(l => l.classList.remove('active', 'exit'));

  const target = document.querySelector(`.level[data-level="${n}"]`);
  if (!target) return;

  if (prev) {
    const prevEl = document.querySelector(`.level[data-level="${prev}"]`);
    prevEl?.classList.add('exit');
  }

  game.currentLevel = n;
  game.visited.add(n);

  target.classList.add('active');
  glitch(180);

  updateHUD();
  runLevelIntro(n, target);
}

function updateHUD() {
  const pct = ((game.currentLevel - 1) / (game.maxLevel - 1)) * 100;
  $('#progressFill').style.width = `${pct}%`;

  const nodes = $('#progressNodes');
  nodes.innerHTML = '';
  for (let i = 1; i <= game.maxLevel; i++) {
    const n = document.createElement('button');
    n.className = 'p-node';
    if (game.visited.has(i) && i < game.currentLevel) n.classList.add('active');
    if (i === game.currentLevel) n.classList.add('current');
    n.title = `LVL ${pad(i, 2)} · ${LEVEL_NAMES[i - 1]}`;
    n.addEventListener('click', () => goToLevel(i));
    nodes.appendChild(n);
  }

  const label = LEVEL_NAMES[game.currentLevel - 1] || '';
  $('#hudLevel').textContent =
    game.currentLevel === game.maxLevel
      ? `FINAL · ${label}`
      : `LVL ${pad(game.currentLevel, 2)} · ${label}`;

  // HP drops slightly per level to simulate "taking damage"
  const hpPct = Math.max(30, 100 - (game.currentLevel - 1) * 8);
  game.hp = hpPct;
  $('#hpBar').style.width = hpPct + '%';
}

/* -----------------------------------------------
   LEVEL INTRO ANIMATIONS
   ----------------------------------------------- */
function runLevelIntro(n, container) {
  sfx.levelUp();
  shake(300);

  if (n === 1) {
    container.querySelectorAll('.stat-box').forEach((b, i) => {
      setTimeout(() => b.classList.add('animate'), 250 + i * 80);
    });
    typeText(container.querySelector('.typewrite'));
    if (!container.dataset.xpGiven) {
      container.dataset.xpGiven = '1';
      const rect = container.getBoundingClientRect();
      setTimeout(() => addXP(XP_PER_LEVEL[0], { x: rect.left + rect.width / 2, y: rect.top + 100 }), 600);
      setTimeout(() => showToast('LVL 01 CLEARED', `+${XP_PER_LEVEL[0]} XP · Identity confirmed`, '✦'), 700);
    }
  }

  if (n === 2) {
    container.querySelectorAll('.sc-bar').forEach((b, i) => {
      setTimeout(() => b.classList.add('animate'), 60 * i);
    });
    grantLevelXP(n, container);
    unlock('scholar');
  }

  if (n === 3) {
    grantLevelXP(n, container);
  }

  if (n === 4) {
    grantLevelXP(n, container);
    unlock('veteran');
  }

  if (n === 5) {
    grantLevelXP(n, container);
    unlock('socialite');
  }

  if (n === 6) {
    grantLevelXP(n, container);
    $('#finalXP').textContent = game.xp.toLocaleString();
    unlock('mission_complete');
    confetti.fire(160);
    const sessionMs = Date.now() - sessionStart;
    if (sessionMs < 90000) unlock('speedrun');
  }
}

function grantLevelXP(n, container) {
  if (container.dataset.xpGiven) return;
  container.dataset.xpGiven = '1';
  const rect = container.getBoundingClientRect();
  const amount = XP_PER_LEVEL[n - 1];
  setTimeout(() => {
    addXP(amount, { x: rect.left + 200, y: rect.top + 80 });
    showToast(`LVL ${pad(n, 2)} CLEARED`, `+${amount} XP · ${LEVEL_NAMES[n - 1]}`, '✦');
  }, 300);
}

/* -----------------------------------------------
   TYPEWRITER (for dialog)
   ----------------------------------------------- */
function typeText(el) {
  if (!el || el.dataset.typed) return;
  el.dataset.typed = '1';
  const full = el.dataset.text || el.textContent;
  el.textContent = '';
  let i = 0;
  const tick = () => {
    el.textContent = full.slice(0, ++i);
    if (i < full.length) setTimeout(tick, 18);
    else el.classList.add('done');
  };
  tick();
}

/* -----------------------------------------------
   NEXT / PREV BUTTONS
   ----------------------------------------------- */
document.addEventListener('click', e => {
  const nextBtn = e.target.closest('[data-next]');
  const prevBtn = e.target.closest('[data-prev]');
  if (nextBtn) goToLevel(game.currentLevel + 1);
  if (prevBtn) goToLevel(game.currentLevel - 1);
});

$('#restartBtn')?.addEventListener('click', () => {
  game.currentLevel = 0;
  game.visited.clear();
  game.xp = 0;
  $$('.level').forEach(l => { l.classList.remove('active', 'exit'); delete l.dataset.xpGiven; });
  $('#xpValue').textContent = pad(0);
  $('#hsYour').textContent = padComma(0);
  game.started = false;
  $('#hud').classList.remove('active');
  $('#startScreen').classList.remove('hidden');
  glitch(300);
});

/* -----------------------------------------------
   KEYBOARD CONTROLS
   ----------------------------------------------- */
addEventListener('keydown', e => {
  if (e.target.matches('input, textarea')) return;
  const k = e.key;

  // BIOS skip
  if (!biosDone) {
    endBIOS();
    return;
  }

  // Konami code sequence check
  let justTriggered = false;
  if (k === KONAMI[konamiIdx]) {
    konamiIdx++;
    if (konamiIdx === KONAMI.length) {
      konamiIdx = 0;
      triggerGodMode();
      justTriggered = true;
    }
  } else {
    konamiIdx = k === KONAMI[0] ? 1 : 0;
  }

  // God mode close on Escape (don't auto-close — too aggressive)
  if (godModeEl.classList.contains('active') && !justTriggered) {
    if (k === 'Escape') closeGodMode();
    return;
  }

  if (!game.started) {
    if (k === ' ' || k === 'Enter') { e.preventDefault(); startGame(); }
    return;
  }

  if (k === 'ArrowRight' || k === ' ' || k === 'Enter') {
    e.preventDefault();
    goToLevel(game.currentLevel + 1);
  } else if (k === 'ArrowLeft') {
    e.preventDefault();
    goToLevel(game.currentLevel - 1);
  } else if (k === 'm' || k === 'M') {
    toggleMap();
  } else if (k === 'n' || k === 'N') {
    music.toggle();
  } else if (k === 'Escape') {
    closeMap();
    closeItem();
  } else if (/^[1-6]$/.test(k)) {
    goToLevel(parseInt(k, 10));
  }
});

/* -----------------------------------------------
   MAP SCREEN
   ----------------------------------------------- */
const mapScreen = $('#mapScreen');
mapScreen.classList.add('hidden');

function renderMap() {
  const grid = $('#mapGrid');
  grid.innerHTML = '';
  for (let i = 1; i <= game.maxLevel; i++) {
    const node = document.createElement('button');
    node.className = 'map-node';
    if (game.visited.has(i)) node.classList.add('visited');
    if (i === game.currentLevel) node.classList.add('current');
    node.innerHTML = `
      <div class="mn-num">${pad(i, 2)}</div>
      <div class="mn-name">${LEVEL_NAMES[i - 1]}</div>
      <div class="mn-status">${i === game.currentLevel ? '● CURRENT' : game.visited.has(i) ? '✓ CLEARED' : '○ LOCKED'}</div>
    `;
    node.addEventListener('click', () => {
      goToLevel(i);
      closeMap();
    });
    grid.appendChild(node);
  }
}

function toggleMap() {
  if (mapScreen.classList.contains('hidden')) openMap();
  else closeMap();
}

function openMap() {
  renderMap();
  mapScreen.classList.remove('hidden');
  sfx.select();
  unlock('explorer');
}

function closeMap() {
  mapScreen.classList.add('hidden');
}

$('#mapBtn').addEventListener('click', toggleMap);
$('#mapClose').addEventListener('click', closeMap);
mapScreen.addEventListener('click', e => {
  if (e.target === mapScreen || e.target.classList.contains('map-screen')) closeMap();
});

/* -----------------------------------------------
   ITEM MODAL (Armory / Projects)
   ----------------------------------------------- */
const ITEMS = {
  rcds: {
    rarity: 'LEGENDARY',
    rarityColor: '#ffaa00',
    name: 'RCDS Invoicing Platform',
    type: 'FULL-STACK · AI · PYTHON · REACT',
    thumbHTML: `<div style="font-family:'Press Start 2P';font-size:28px;color:#ffaa00;text-shadow:0 0 20px #ffaa00;display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:linear-gradient(135deg,#1a1020,#2a0a1a);letter-spacing:3px">RCDS</div>`,
    desc: 'A full-stack invoicing platform for IIDS / RCDS at the University of Idaho. Engineered with React + FastAPI + Python and orchestrated with Claude AI — ClickUp-integrated billing, hour extraction, automated PDF invoice generation, and an Excel-based review workflow so admins can audit and adjust every invoice before finalization.',
    stats: [
      ['IMPACT', 'High'],
      ['COMPLEXITY', '9 / 10'],
      ['STATUS', 'Shipping'],
      ['TEAM', 'Intern · RCDS']
    ],
    tags: ['React', 'FastAPI', 'Python', 'Claude AI', 'ClickUp API', 'PDF Gen', 'Excel'],
    links: [] // private internship — no public link
  },
  agri: {
    rarity: 'EPIC',
    rarityColor: '#c75fff',
    name: 'AI Crop Intelligence',
    type: 'AI · LOVABLE · PROMPT ENGINEERING',
    thumbSrc: 'assets/proj03.png',
    desc: 'An AI-powered agricultural chatbot that analyzes crop photos and returns expert, actionable treatment advice. Built on Lovable AI with targeted prompt-engineering so farmers — people whose day depends on real answers — get usable guidance on plant identification, disease analysis, and practical treatment steps.',
    stats: [
      ['DOMAIN', 'Agritech'],
      ['INTERFACE', 'Web · Chat'],
      ['YEAR', 'DEC 2025'],
      ['USERS', 'Farmers']
    ],
    tags: ['Lovable AI', 'Prompt Eng.', 'NLP', 'Agritech', 'LLM'],
    links: [{ label: '▸ LAUNCH PROJECT', url: 'https://helpfarmer.lovable.app' }]
  },
  hub: {
    rarity: 'EPIC',
    rarityColor: '#c75fff',
    name: 'UIdaho International Hub',
    type: 'WEB · COMMUNITY · STUDENT SUPPORT',
    thumbSrc: 'assets/proj04.png',
    desc: 'A complete navigation hub for incoming international students at the University of Idaho. Covers arrival roadmap, academic help, career/OPT/CPT, housing, and student life — so new international Vandals can land on campus and actually find their footing from day one.',
    stats: [
      ['AUDIENCE', 'Intl. Students'],
      ['COVERAGE', 'Full Lifecycle'],
      ['IMPACT', 'Campus-wide'],
      ['ROLE', 'Builder']
    ],
    tags: ['Web', 'UX', 'Information Architecture', 'Community', 'Onboarding'],
    links: [{ label: '▸ LAUNCH PROJECT', url: 'https://uidahointernationalhub.lovable.app' }]
  },
  lostmap: {
    rarity: 'RARE',
    rarityColor: '#3d9bff',
    name: 'Lost Map Studio',
    type: 'GAME DEV · UNITY / C#',
    thumbSrc: 'assets/proj02.png',
    desc: 'A 2D game built in Unity / C# — reactive enemy behaviors, polished demo mode, and tuned gameplay loops. Shipped smooth performance and an engaging presentation. Download the full build for your platform below.',
    stats: [
      ['GENRE', '2D Platformer'],
      ['ENGINE', 'Unity / C#'],
      ['YEAR', 'NOV 2025'],
      ['BUILDS', 'Android · PC']
    ],
    tags: ['C#', 'Unity', 'Game AI', 'UI/UX', '2D'],
    links: [
      { label: '▸ DOWNLOAD · ANDROID', url: 'https://drive.google.com/file/d/1fvkmlRFnUHNgRsmMFJm4wFjXm4BBc0_j/view?usp=drive_link' },
      { label: '▸ DOWNLOAD · PC', url: 'https://drive.google.com/file/d/1fitSktHJQWwuil0IFNbmlRWFYXMJxc2f/view?usp=drive_link' }
    ]
  },
  reminder: {
    rarity: 'RARE',
    rarityColor: '#3d9bff',
    name: 'Reminder App',
    type: 'DESKTOP · PYTHON · TKINTER',
    thumbSrc: 'assets/proj01.png',
    desc: 'A reminder platform with a clean desktop GUI — schedule reminders by title, date, time, AM/PM, and priority, with SQLite persistence, CRUD flows, and email + push notifications so nothing slips through.',
    stats: [
      ['PERSISTENCE', 'SQLite / JSON'],
      ['NOTIFY', 'Email + Push'],
      ['YEAR', 'MAY 2025'],
      ['STACK', 'Py · Tkinter']
    ],
    tags: ['Python', 'Tkinter', 'SQLite', 'CRUD', 'Notifications'],
    links: []
  },
  budget: {
    rarity: 'UNCOMMON',
    rarityColor: '#3df081',
    name: 'Budget Guardian',
    type: 'WEB · FINANCE COMMAND CENTER',
    thumbSrc: 'assets/budget.png',
    desc: 'Your financial command center. A personal finance tracker with clean auth, categorized income/expense tracking, real-time balance updates, and local-first data so your finances stay on your device. Built for the Vandal Finance Hackathon.',
    stats: [
      ['EVENT', 'Vandal Hackathon'],
      ['DATA', 'Local-first'],
      ['YEAR', 'MAR 2026'],
      ['AUTH', 'Email + Pass']
    ],
    tags: ['Web App', 'Finance', 'Auth', 'Local Storage', 'UI'],
    links: [{ label: '▸ LAUNCH PROJECT', url: 'https://anjalkarki123.github.io/Vandal-Finance-Hackathon/' }]
  }
};

const modal = $('#itemModal');
const inspected = new Set();

function openItem(key) {
  const item = ITEMS[key];
  if (!item) return;
  sfx.coin();
  unlock('treasure_hunter');
  inspected.add(key);
  if (inspected.size === Object.keys(ITEMS).length) unlock('completionist');
  $('#imRarity').textContent = item.rarity;
  $('#imRarity').style.color = item.rarityColor;
  $('#imRarity').style.textShadow = `0 0 8px ${item.rarityColor}`;
  $('#imName').textContent = item.name;
  $('#imType').textContent = item.type;
  $('#imDesc').textContent = item.desc;

  const thumb = $('#imThumb');
  thumb.innerHTML = item.thumbSrc
    ? `<img src="${item.thumbSrc}" alt="${item.name}" />`
    : item.thumbHTML || '';

  const stats = $('#imStats');
  stats.innerHTML = item.stats.map(([l, v]) =>
    `<div class="im-stat-row"><span class="label">${l}</span><span class="value">${v}</span></div>`
  ).join('');

  const tags = $('#imTags');
  tags.innerHTML = item.tags.map(t => `<span>${t}</span>`).join('');

  const launches = $('#imLaunches');
  launches.innerHTML = (item.links || []).map(l =>
    `<a href="${l.url}" target="_blank" rel="noopener" class="im-launch">${l.label}</a>`
  ).join('');

  modal.classList.add('open');

  addXP(250, { x: innerWidth / 2, y: 120 });
  showToast('ITEM INSPECTED', item.name, '✦');
}

function closeItem() {
  modal.classList.remove('open');
}

$$('.item-slot').forEach(slot => {
  slot.addEventListener('click', () => openItem(slot.dataset.item));
});

/* -----------------------------------------------
   QUEST CARD COINS
   Click any experience card → earn a coin (+250 XP)
   ----------------------------------------------- */
const questClaimed = new Set();
$$('.quest').forEach(q => {
  q.addEventListener('click', () => {
    const titleEl = q.querySelector('.quest-title');
    if (!titleEl) return;
    const title = titleEl.textContent;

    if (questClaimed.has(title)) {
      // already claimed — just a subtle click sound
      sfx.click();
      return;
    }
    questClaimed.add(title);

    sfx.coin();
    const rect = q.getBoundingClientRect();
    addXP(250, { x: rect.left + rect.width / 2, y: rect.top + 40 });
    showToast('+250 COIN', title, '◉');
    q.classList.add('claimed');
    window.__burst?.(rect.left + rect.width / 2, rect.top + rect.height / 2, '#ffdd33', 22);
  });
});

$('#imClose').addEventListener('click', closeItem);
modal.addEventListener('click', e => {
  if (e.target.classList.contains('im-backdrop')) closeItem();
});

/* -----------------------------------------------
   HIDE map & modal on load
   ----------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  mapScreen.classList.add('hidden');
});

/* =========================================================
                  THREE.JS BACKGROUND
   ========================================================= */
(() => {
  const canvas = $('#bgCanvas');
  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: true, powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x03050a, 0.05);

  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 22);

  // Grid floor
  const gridHelper = new THREE.GridHelper(60, 40, 0x00ff88, 0x00ff88);
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.12;
  gridHelper.position.y = -6;
  scene.add(gridHelper);

  // Particle field
  const N = 900;
  const positions = new Float32Array(N * 3);
  const base = new Float32Array(N * 3);
  const colors = new Float32Array(N * 3);

  const cGreen = new THREE.Color(0x00ff88);
  const cPink = new THREE.Color(0xff3df0);
  const cCyan = new THREE.Color(0x7cf5ff);
  const cYellow = new THREE.Color(0xffdd33);

  for (let i = 0; i < N; i++) {
    const r = 10 + Math.random() * 20;
    const t = Math.random() * Math.PI * 2;
    const p = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = base[i * 3] = r * Math.sin(p) * Math.cos(t);
    positions[i * 3 + 1] = base[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
    positions[i * 3 + 2] = base[i * 3 + 2] = r * Math.cos(p);

    const mrand = Math.random();
    const c = mrand < 0.5 ? cGreen : (mrand < 0.75 ? cCyan : (mrand < 0.92 ? cPink : cYellow));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const tex = (() => {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  })();

  const mat = new THREE.PointsMaterial({
    size: 0.28,
    vertexColors: true,
    map: tex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  });
  const particles = new THREE.Points(geom, mat);
  scene.add(particles);

  // Wireframe arcade core — octahedron for pixelated feel
  const coreGeom = new THREE.OctahedronGeometry(3, 0);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x00ff88, wireframe: true, transparent: true, opacity: 0.4
  });
  const core = new THREE.Mesh(coreGeom, coreMat);
  scene.add(core);

  const innerGeom = new THREE.IcosahedronGeometry(1.8, 0);
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0xff3df0, wireframe: true, transparent: true, opacity: 0.35
  });
  const innerMesh = new THREE.Mesh(innerGeom, innerMat);
  scene.add(innerMesh);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xffdd33, transparent: true, opacity: 0.85 })
  );
  scene.add(glow);

  // Orbital rings
  const makeRing = (r, color, tilt) => {
    const g = new THREE.TorusGeometry(r, 0.015, 2, 128);
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, wireframe: true });
    const mesh = new THREE.Mesh(g, m);
    mesh.rotation.x = tilt;
    return mesh;
  };
  const ring1 = makeRing(5, 0x00ff88, Math.PI / 3);
  const ring2 = makeRing(7, 0xff3df0, Math.PI / 5);
  const ring3 = makeRing(9, 0x7cf5ff, -Math.PI / 4);
  scene.add(ring1, ring2, ring3);

  // Mouse parallax + level parallax
  const mouse = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  addEventListener('mousemove', e => {
    target.x = (e.clientX / innerWidth) * 2 - 1;
    target.y = -((e.clientY / innerHeight) * 2 - 1);
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  const clock = new THREE.Clock();

  const animate = () => {
    const t = clock.getElapsedTime();
    mouse.x += (target.x - mouse.x) * 0.05;
    mouse.y += (target.y - mouse.y) * 0.05;

    // Per-level camera position so scene feels different every level
    const lvl = Math.max(0, game.currentLevel);
    const camTarget = {
      x: Math.sin(lvl * 0.9) * 3 + mouse.x * 2,
      y: Math.cos(lvl * 1.1) * 1.5 + mouse.y * 1.5,
      z: 22 - lvl * 0.4
    };
    camera.position.x += (camTarget.x - camera.position.x) * 0.03;
    camera.position.y += (camTarget.y - camera.position.y) * 0.03;
    camera.position.z += (camTarget.z - camera.position.z) * 0.03;
    camera.lookAt(0, 0, 0);

    // Animate particles
    const pos = geom.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      pos[i3] = base[i3] + Math.sin(t * 0.3 + i) * 0.2;
      pos[i3 + 1] = base[i3 + 1] + Math.cos(t * 0.4 + i * 0.5) * 0.2;
      pos[i3 + 2] = base[i3 + 2] + Math.sin(t * 0.2 + i * 0.3) * 0.2;
    }
    geom.attributes.position.needsUpdate = true;

    particles.rotation.y = t * 0.04;
    particles.rotation.x = t * 0.02;

    core.rotation.x = t * 0.4;
    core.rotation.y = t * 0.5;
    innerMesh.rotation.x = -t * 0.6;
    innerMesh.rotation.y = -t * 0.3;

    const pulse = 1 + Math.sin(t * 3) * 0.12;
    glow.scale.setScalar(pulse);
    glow.material.opacity = 0.6 + Math.sin(t * 3) * 0.3;

    ring1.rotation.z = t * 0.3;
    ring2.rotation.z = -t * 0.2;
    ring3.rotation.z = t * 0.15;

    // grid shift
    gridHelper.position.z = -((t * 0.5) % 3);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  animate();
})();

/* -----------------------------------------------
   INIT
   ----------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  updateHUD();
  // Hide start screen; show BIOS first
  $('#startScreen').classList.add('hidden');
  runBIOS();
});
