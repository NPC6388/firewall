// FIREWALL: synthesized audio (WebAudio, no sound files). SFX for battle and UI events, plus a generative ambient score.
// Nothing plays until the first click or key press (browser autoplay rules). Everything is safe to call before then.
var XG = globalThis.XG = globalThis.XG || {};

XG.Audio = (function () {
  var S = XG.Settings, ac = null, master, sfxBus, musicBus, verb, verbIn, noiseBuf = null, unlocked = false;
  var music = { scene: null, want: null, nodes: [], timer: null, next: 0, step: 0, intensity: 0, target: 0, song: null, g: null };
  var lastPlay = {};

  // ------------------------------------------------------------ setup
  function init() {
    if (ac) return true;
    var AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    ac = new AC();
    var comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ac.destination);
    master = ac.createGain(); master.connect(comp);
    sfxBus = ac.createGain(); sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.connect(master);
    verb = ac.createConvolver(); verb.buffer = impulse(2.4); verbIn = ac.createGain(); verbIn.gain.value = .9;
    verbIn.connect(verb); var vg = ac.createGain(); vg.gain.value = .5; verb.connect(vg); vg.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    return true;
  }
  function impulse(sec) {
    var n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, n, ac.sampleRate);
    for (var c = 0; c < 2; c++) { var d = b.getChannelData(c); for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
    return b;
  }
  function applyVolumes() {
    if (!ac) return;
    var t = ac.currentTime, m = S.get('muted') ? 0 : S.get('master');
    master.gain.setTargetAtTime(m, t, .05);
    sfxBus.gain.setTargetAtTime(S.get('sfx'), t, .05);
    musicBus.gain.setTargetAtTime(S.get('music') * .55, t, .3);
  }
  function unlock() {
    if (!init()) return;
    if (ac.state === 'suspended') ac.resume();
    if (!unlocked) { unlocked = true; if (music.want) startScene(music.want); }
  }
  if (typeof document !== 'undefined') {
    ['pointerdown', 'keydown'].forEach(function (ev) { document.addEventListener(ev, unlock, true); });
    S.onChange(function (k) { if (k === 'master' || k === 'music' || k === 'sfx' || k === 'muted') applyVolumes(); });
  }
  function ready() { return ac && unlocked && ac.state === 'running'; }

  // ------------------------------------------------------------ voices
  // tone: { type, f: [start, end], dur, gain, at (delay s), attack, bus, filter: [type, freq, q], verb (send 0..1), detune }
  function tone(o) {
    var t = ac.currentTime + (o.at || 0), dur = o.dur || .2, osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine'; if (o.detune) osc.detune.value = o.detune;
    var f = o.f || [440], f1 = f[1] === undefined ? f[0] : f[1]; osc.frequency.setValueAtTime(f[0], t);
    if (f1 !== f[0]) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    var a = o.attack || .004, peak = o.gain || .3;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var out = g;
    if (o.filter) { var fl = ac.createBiquadFilter(); fl.type = o.filter[0]; fl.frequency.value = o.filter[1]; fl.Q.value = o.filter[2] || 1; g.connect(fl); out = fl; }
    osc.connect(g); route(out, o);
    osc.start(t); osc.stop(t + dur + .05);
  }
  // noise: { dur, gain, at, attack, filter: [type, f0, f1, q], bus, verb }
  function noise(o) {
    var t = ac.currentTime + (o.at || 0), dur = o.dur || .2, src = ac.createBufferSource(), g = ac.createGain(), fl = ac.createBiquadFilter();
    src.buffer = noiseBuf; src.loop = true;
    var F = o.filter || ['lowpass', 4000, 4000, 1];
    fl.type = F[0]; fl.Q.value = F[3] || 1; fl.frequency.setValueAtTime(F[1], t); if (F[2] !== F[1]) fl.frequency.exponentialRampToValueAtTime(Math.max(30, F[2]), t + dur);
    var a = o.attack || .003;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.gain || .3, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); route(g, o);
    src.start(t, Math.random() * .5); src.stop(t + dur + .05);
  }
  function route(node, o) {
    node.connect(o.dest || (o.bus === 'music' ? musicBus : sfxBus));
    if (o.verb) { var s = ac.createGain(); s.gain.value = o.verb; node.connect(s); s.connect(verbIn); }
  }
  var PENTA = [0, 3, 5, 7, 10];
  function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  // ------------------------------------------------------------ sfx
  var SFX = {
    click: function () { tone({ type: 'sine', f: [1500, 1100], dur: .04, gain: .08 }); },
    hover: function () { tone({ type: 'sine', f: [2200, 2200], dur: .02, gain: .025 }); },
    select: function () { tone({ type: 'triangle', f: [660, 990], dur: .07, gain: .1 }); },
    advance: function () { noise({ dur: .45, gain: .12, attack: .2, filter: ['bandpass', 300, 2400, 2] }); tone({ type: 'sine', f: [330, 495], dur: .35, gain: .06, attack: .15, verb: .3 }); },
    mission: function () { [0, .16].forEach(function (at) { tone({ type: 'square', f: [880, 880], dur: .1, gain: .07, at: at, filter: ['lowpass', 2500] }); }); },
    research: function () { [0, 4, 7, 12].forEach(function (n, i) { tone({ type: 'triangle', f: [hz(72 + n), hz(72 + n)], dur: .3, gain: .08, at: i * .07, verb: .4 }); }); },
    build: function () { [0, .09, .18].forEach(function (at) { noise({ dur: .05, gain: .18, at: at, filter: ['bandpass', 1800, 900, 4] }); }); },
    'shot-bullet': function () {
      noise({ dur: .09, gain: .5, filter: ['bandpass', 2600, 500, 1.2] });
      tone({ type: 'square', f: [190, 55], dur: .08, gain: .18, filter: ['lowpass', 1200] });
      noise({ dur: .35, gain: .06, at: .02, filter: ['lowpass', 900, 300], verb: .4 });
    },
    'shot-lattice': function () {
      tone({ type: 'sawtooth', f: [1400, 160], dur: .16, gain: .16, filter: ['lowpass', 3000, 2] });
      tone({ type: 'square', f: [700, 90], dur: .12, gain: .08, detune: 12 });
      noise({ dur: .08, gain: .15, filter: ['highpass', 3000, 3000] });
    },
    'shot-pulse': function () {
      tone({ type: 'sine', f: [500, 1500], dur: .16, gain: .22, verb: .3 });
      tone({ type: 'triangle', f: [250, 750], dur: .18, gain: .12 });
    },
    'shot-spike': function () {
      tone({ type: 'sawtooth', f: [2600, 70], dur: .32, gain: .2, filter: ['lowpass', 5000, 3] });
      for (var i = 0; i < 6; i++) noise({ dur: .03, gain: .2, at: i * .035, filter: ['bandpass', 3000 + Math.random() * 3000, 2000, 6] });
    },
    hit: function (o) {
      if (o && o.machine) { noise({ dur: .12, gain: .35, filter: ['bandpass', 3200, 1200, 3] }); tone({ type: 'square', f: [320, 90], dur: .08, gain: .08 }); }
      else { noise({ dur: .1, gain: .4, filter: ['lowpass', 900, 200] }); tone({ type: 'sine', f: [140, 55], dur: .12, gain: .25 }); }
    },
    crit: function () { tone({ type: 'sine', f: [1900, 1900], dur: .35, gain: .12, verb: .5 }); tone({ type: 'triangle', f: [95, 40], dur: .3, gain: .3 }); },
    miss: function () {
      tone({ type: 'sine', f: [2600, 900], dur: .18, gain: .1 });
      tone({ type: 'sine', f: [3400, 2800], dur: .12, gain: .08, at: .1, verb: .5 });
    },
    boom: function () {
      noise({ dur: 1.1, gain: .9, filter: ['lowpass', 1600, 80, 1] });
      tone({ type: 'sine', f: [80, 28], dur: .8, gain: .6 });
      noise({ dur: 1.6, gain: .12, at: .1, attack: .1, filter: ['lowpass', 500, 120], verb: .6 });
    },
    shatter: function () { noise({ dur: .35, gain: .2, filter: ['highpass', 3500, 2500, 1] }); tone({ type: 'sine', f: [3200, 2400], dur: .25, gain: .05, verb: .4 }); },
    emp: function () {
      tone({ type: 'sawtooth', f: [120, 2400], dur: .45, gain: .14, filter: ['bandpass', 1200, 4] });
      noise({ dur: .7, gain: .18, filter: ['highpass', 2000, 6000, 1], verb: .5 });
      tone({ type: 'sine', f: [60, 40], dur: .5, gain: .3 });
    },
    hack: function () { for (var i = 0; i < 9; i++) tone({ type: 'square', f: [hz(76 + PENTA[(i * 3) % 5] + (i % 2) * 12)], dur: .045, gain: .05, at: i * .035, filter: ['lowpass', 3500] }); },
    stun: function () { noise({ dur: .3, gain: .12, filter: ['bandpass', 5000, 1500, 8] }); tone({ type: 'square', f: [1200, 300], dur: .25, gain: .04 }); },
    heal: function () { [0, 4, 7].forEach(function (n, i) { tone({ type: 'sine', f: [hz(76 + n), hz(76 + n)], dur: .4, gain: .09, at: i * .08, attack: .02, verb: .5 }); }); },
    shield: function () { tone({ type: 'triangle', f: [300, 900], dur: .35, gain: .1, verb: .5 }); tone({ type: 'sine', f: [600, 1800], dur: .3, gain: .05 }); },
    scan: function () { tone({ type: 'sine', f: [1320, 1320], dur: .9, gain: .1, verb: .7 }); tone({ type: 'sine', f: [660, 990], dur: .5, gain: .05, at: .05 }); },
    spawn: function () { noise({ dur: .6, gain: .2, attack: .45, filter: ['bandpass', 200, 3000, 3] }); tone({ type: 'sawtooth', f: [55, 110], dur: .7, gain: .1, attack: .4, filter: ['lowpass', 800] }); },
    alert: function () { tone({ type: 'square', f: [880, 880], dur: .07, gain: .06, filter: ['lowpass', 2000] }); tone({ type: 'square', f: [660, 660], dur: .1, gain: .06, at: .08, filter: ['lowpass', 2000] }); },
    overwatch: function () { tone({ type: 'triangle', f: [440, 660], dur: .14, gain: .08 }); tone({ type: 'triangle', f: [660, 660], dur: .1, gain: .05, at: .12 }); },
    'death-machine': function () { noise({ dur: .5, gain: .45, filter: ['lowpass', 2500, 150] }); tone({ type: 'sawtooth', f: [400, 40], dur: .5, gain: .12, filter: ['lowpass', 1200] }); },
    'death-human': function () { tone({ type: 'sine', f: [hz(57), hz(57)], dur: .9, gain: .1, attack: .02, verb: .6 }); tone({ type: 'sine', f: [hz(52), hz(52)], dur: 1.2, gain: .08, at: .25, verb: .6 }); },
    'death-soft': function () { for (var i = 0; i < 6; i++) tone({ type: 'square', f: [hz(84 - i * 3), hz(84 - i * 3)], dur: .05, gain: .05, at: i * .05, filter: ['lowpass', 3000] }); },
    step: function (o) {
      if (o && o.machine) tone({ type: 'sawtooth', f: [o.hover ? 220 : 90, o.hover ? 240 : 80], dur: .07, gain: .07, filter: ['lowpass', 700] });
      else noise({ dur: .04, gain: .22, filter: ['lowpass', 700, 300] });
    },
    'turn-player': function () { tone({ type: 'triangle', f: [hz(69), hz(69)], dur: .18, gain: .09, verb: .3 }); tone({ type: 'triangle', f: [hz(76), hz(76)], dur: .3, gain: .09, at: .12, verb: .4 }); },
    'turn-enemy': function () { tone({ type: 'sawtooth', f: [hz(40), hz(40)], dur: .6, gain: .1, attack: .05, filter: ['lowpass', 400] }); tone({ type: 'sine', f: [hz(52), hz(51)], dur: .6, gain: .06, at: .1, verb: .4 }); },
    victory: function () { [0, 4, 7, 12, 16].forEach(function (n, i) { tone({ type: 'triangle', f: [hz(64 + n), hz(64 + n)], dur: .6, gain: .1, at: i * .11, verb: .5 }); }); },
    defeat: function () { [0, -2, -5, -9].forEach(function (n, i) { tone({ type: 'sine', f: [hz(57 + n), hz(57 + n)], dur: .9, gain: .1, at: i * .22, verb: .6 }); }); }
  };
  // Throttle repeats of the same sound so bursts of events don't stack into noise.
  function play(name, o) {
    if (!ready() || !SFX[name]) return;
    var now = ac.currentTime, gap = name === 'step' ? .05 : name === 'click' || name === 'hover' ? .03 : .02;
    if (lastPlay[name] && now - lastPlay[name] < gap) return;
    lastPlay[name] = now;
    try { SFX[name](o); } catch (e) { /* never let audio break the game */ }
  }

  // ------------------------------------------------------------ music
  // An arranger, not a loop: songs are built from sections picked by weighted chance, chord progressions rotate,
  // melodies are generated motifs that mutate every couple of bars, and nothing repeats exactly.
  // Four styles: 'ambient' (soft pads and a drifting melody), 'darkambient' (detuned drones, sub pulses, a sparse echoed
  // arpeggio, hiss and crackle, data blips), 'darksynth' (pumping saw bass, gated snare on 2 and 4, an arpeggiated
  // lead) and 'phonk' (808s with glide, half-time claps, trap hats with rolls, pitched cowbell riffs, vowel chops).
  // Each scene has a pool of variants per mood (Audio.mood). A seeded pick keeps the same screen from always playing
  // the same song, and mood changes crossfade on a bar line after at least HOLD bars, so the score never flips back and forth.
  // Enemies in view (intensity) open a filter over the beat, bring the lead up and favour drops; out of contact the
  // groove sinks under a low-pass. It eases over a few seconds.
  var SCALES = { aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], phrygDom: [0, 1, 4, 5, 7, 8, 10], locrian: [0, 1, 3, 5, 6, 8, 10] };
  var PROGS = [[0, 0, 5, 6], [0, 5, 3, 4], [0, 3, 5, 4], [0, 6, 5, 6], [0, 1, 0, 6], [0, 3, 0, 1], [5, 3, 0, 6]];
  // kind: which moods apply ('strategy': calm/uneasy/dire, 'battle': stealth/contact/critical). Variants override the base.
  // calm: true holds intensity low; minI: an intensity floor (critical opens the beat right up).
  var SCENES = {
    title: { kind: 'title', root: 45, scale: 'aeolian', wave: 'sawtooth', cut: 520, pools: {
      calm: [{ id: 'title-ambient', style: 'ambient', bpm: 64 }, { id: 'title-dark', style: 'darkambient', bpm: 62, scale: 'phrygian', cut: 440 }] } },
    fw: { kind: 'strategy', root: 45, scale: 'dorian', wave: 'sawtooth', cut: 700, pools: {
      calm: [{ id: 'fw-ambient', style: 'ambient', bpm: 72 }, { id: 'fw-dark', style: 'darkambient', bpm: 68, scale: 'aeolian', cut: 560 }],
      uneasy: [{ id: 'fw-dark-phryg', style: 'darkambient', bpm: 74, scale: 'phrygian', cut: 620, blips: 1 }, { id: 'fw-synth-low', style: 'darksynth', bpm: 90, scale: 'aeolian', calm: true }],
      dire: [{ id: 'fw-synth', style: 'darksynth', bpm: 100, scale: 'phrygian' }, { id: 'fw-synth-loc', style: 'darksynth', bpm: 104, scale: 'locrian', root: 43 }] } },
    lat: { kind: 'strategy', root: 39, scale: 'phrygian', wave: 'square', cut: 420, pools: {
      calm: [{ id: 'lat-phonk', style: 'phonk', bpm: 128, calm: true }, { id: 'lat-dark', style: 'darkambient', bpm: 70, scale: 'locrian', blips: 1 }],
      uneasy: [{ id: 'lat-synth-low', style: 'darksynth', bpm: 96, calm: true }, { id: 'lat-phonk-b', style: 'phonk', bpm: 124, calm: true, scale: 'phrygDom' }],
      dire: [{ id: 'lat-synth', style: 'darksynth', bpm: 108, scale: 'locrian' }, { id: 'lat-phonk-hot', style: 'phonk', bpm: 132 }] } },
    battle: { kind: 'battle', root: 40, scale: 'phrygian', wave: 'sawtooth', cut: 600, pools: {
      stealth: [{ id: 'battle-dark', style: 'darkambient', bpm: 70, cut: 520, blips: 1 }, { id: 'battle-synth-low', style: 'darksynth', bpm: 88, scale: 'aeolian', calm: true }],
      contact: [{ id: 'battle-synth', style: 'darksynth', bpm: 104 }, { id: 'battle-phonk', style: 'phonk', bpm: 136 }],
      critical: [{ id: 'battle-phonk-crit', style: 'phonk', bpm: 140, minI: .85 }, { id: 'battle-synth-crit', style: 'darksynth', bpm: 110, scale: 'locrian', minI: .9 }] } },
    'battle-lat': { kind: 'battle', root: 37, scale: 'phrygDom', wave: 'square', cut: 480, pools: {
      stealth: [{ id: 'blat-dark', style: 'darkambient', bpm: 66, scale: 'locrian', cut: 460, blips: 1 }, { id: 'blat-synth-low', style: 'darksynth', bpm: 86, calm: true }],
      contact: [{ id: 'blat-phonk', style: 'phonk', bpm: 130 }, { id: 'blat-synth', style: 'darksynth', bpm: 102, scale: 'phrygian' }],
      critical: [{ id: 'blat-phonk-crit', style: 'phonk', bpm: 138, minI: .85 }, { id: 'blat-synth-crit', style: 'darksynth', bpm: 108, minI: .9 }] } }
  };
  var MOOD_KIND = { calm: 'strategy', uneasy: 'strategy', dire: 'strategy', stealth: 'battle', contact: 'battle', critical: 'battle' };
  var DEFAULT_MOOD = { title: 'calm', strategy: 'calm', battle: 'stealth' };
  var HOLD = 8; // bars a mood must play before the next mood change is allowed
  var KICKS = ['x.........x.....', 'x......x..x.....', 'x..x......x.....', 'x.........x..x..'];
  function rint(n) { return Math.floor(Math.random() * n); }
  function chance(p) { return Math.random() < p; }
  function weighted(w) { var t = 0, k; for (k in w) t += w[k]; var r = Math.random() * t; for (k in w) { r -= w[k]; if (r <= 0) return k; } return k; }
  // Seeded per session (mulberry32), so variant picks differ between sessions but a seed can be replayed.
  function seeded(s) { return function () { s = (s + 0x6D2B79F5) | 0; var x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
  music.seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0; music.rng = seeded(music.seed);
  music.moods = { title: 'calm', strategy: 'calm', battle: 'stealth' }; music.auto = { battle: true }; music.last = {}; music.pending = null;

  // Pick a variant for a scene and mood: never the same one twice in a row from a pool that has a choice.
  function pick(name, mood) {
    var sc = SCENES[name]; if (!sc) return null;
    var pool = sc.pools[mood] || sc.pools[DEFAULT_MOOD[sc.kind]], key = name + ':' + mood, i = Math.floor(music.rng() * pool.length);
    if (pool.length > 1 && i === music.last[key]) i = (i + 1) % pool.length;
    music.last[key] = i;
    var cfg = { scene: name, mood: pool === sc.pools[mood] ? mood : DEFAULT_MOOD[sc.kind], kind: sc.kind }, k;
    for (k in sc) if (k !== 'pools') cfg[k] = sc[k];
    for (k in pool[i]) cfg[k] = pool[i][k];
    return cfg;
  }
  function moodFor(name) { var sc = SCENES[name]; return sc ? music.moods[sc.kind] || DEFAULT_MOOD[sc.kind] : null; }

  function scene(name) {
    music.want = name;
    if (ready() && name !== music.scene) startScene(name);
  }
  // Fade a song's nodes out from t over `secs` and release them; notes already scheduled ring out under the fade.
  function fadeOut(nodes, t, secs) {
    nodes.forEach(function (n) {
      try {
        var p = n.g.gain; if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else p.cancelScheduledValues(t);
        p.setTargetAtTime(0.0001, t, secs / 4);
        (n.o || []).forEach(function (o) { o.stop(t + secs * 2); });
        if (n.d) setTimeout(function () { n.d.forEach(function (x) { try { x.disconnect(); } catch (e) { } }); }, (secs * 2 + 1) * 1000);
      } catch (e) { }
    });
  }
  function stopScene() {
    if (ac) fadeOut(music.nodes, ac.currentTime, 2);
    music.nodes = []; music.song = null; music.pending = null;
    if (music.timer) clearInterval(music.timer);
    music.timer = null;
  }
  function startScene(name) {
    var cfg = pick(name, moodFor(name));
    music.scene = name; music.pending = null;
    if (!cfg) { stopScene(); return; }
    begin(cfg, ac.currentTime + .05, 2, 2.5, HOLD);
    if (!music.timer) music.timer = setInterval(tick, 50);
  }
  // Start a song at time t: fade the old one out over `out` seconds and the new one in over `inn`. hold = bars before
  // a mood change may replace it (a fresh scene can still settle its mood on its very first bar line).
  function begin(sc, t, outSecs, inSecs, hold) {
    fadeOut(music.nodes, t, outSecs);
    music.nodes = [];
    var style = sc.style;
    // routing: beat (drums, bass, lead) -> stealth low-pass -> out; pad -> duck (sidechain) -> out; arp -> echo -> out
    var out = ac.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(1, t + inSecs); out.connect(musicBus);
    var stealth = ac.createBiquadFilter(); stealth.type = 'lowpass'; stealth.Q.value = 1.2; stealth.frequency.value = 900; stealth.connect(out);
    var beat = ac.createGain(); beat.gain.value = .42; beat.connect(stealth); // keeps the beat under the battle sound effects
    var duck = ac.createGain(); duck.connect(out);
    var dist = ac.createWaveShaper(); dist.curve = driveCurve(2.6); dist.oversample = '2x';
    var bassG = ac.createGain(); bassG.gain.value = .55; dist.connect(bassG); bassG.connect(beat);
    var lead = ac.createGain(); lead.gain.value = .3; lead.connect(beat);
    var G = { out: out, stealth: stealth, beat: beat, duck: duck, dist: dist, bass: bassG, lead: lead }, nd = { g: out, d: [] };
    if (style === 'darkambient' || style === 'darksynth') {
      // dotted-eighth feedback echo for the arpeggios, darkened on every repeat
      var echo = ac.createDelay(2), fb = ac.createGain(), efl = ac.createBiquadFilter(), eIn = ac.createGain(), arp = ac.createGain();
      echo.delayTime.value = 60 / sc.bpm * .75; fb.gain.value = style === 'darkambient' ? .5 : .35;
      efl.type = 'lowpass'; efl.frequency.value = style === 'darkambient' ? 1800 : 2600;
      eIn.connect(echo); echo.connect(efl); efl.connect(fb); fb.connect(echo); efl.connect(out);
      arp.connect(out); arp.connect(eIn); lead.connect(eIn);
      G.echo = eIn; G.arp = arp; nd.d.push(eIn, echo, efl, fb);
    }
    music.g = G;
    music.nodes.push(nd);
    // drone: root and fifth under everything, breathing low-pass (wider detune and a slower sweep for dark ambient)
    var dark = style === 'darkambient', dg = ac.createGain(), fl = ac.createBiquadFilter(), lfo = ac.createOscillator(), lg = ac.createGain();
    fl.type = 'lowpass'; fl.frequency.value = sc.cut; fl.Q.value = 3;
    lfo.frequency.value = dark ? .02 + Math.random() * .03 : .05 + Math.random() * .04; lg.gain.value = sc.cut * (dark ? .6 : .45); lfo.connect(lg); lg.connect(fl.frequency);
    var fifth = SCALES[sc.scale][4];
    var os = [0, fifth, -12].map(function (n, i) { var o = ac.createOscillator(); o.type = i === 2 ? 'sine' : sc.wave; o.frequency.value = hz(sc.root + n); o.detune.value = (i - 1) * (dark ? 13 : 7); o.connect(fl); o.start(t); return o; });
    if (dark) { var o2 = ac.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = hz(sc.root); o2.detune.value = -11; o2.connect(fl); o2.start(t); os.push(o2); }
    lfo.start(t); os.push(lfo);
    fl.connect(dg); dg.gain.value = { phonk: .05, darksynth: .045, darkambient: .07 }[style] || .09; dg.connect(duck);
    var vs = ac.createGain(); vs.gain.value = .35; dg.connect(vs); vs.connect(verbIn);
    music.nodes.push({ g: dg, o: os });
    var crk = { phonk: .5, darkambient: .4, darksynth: .22 }[style];
    if (crk) music.nodes.push(crackle(out, crk, t));
    music.song = newSong(sc); music.song.hold = hold;
    music.next = t; music.step = 0;
  }
  // Mood change on a bar line: crossfade over about two bars.
  function crossfade(mood, t) {
    var cfg = pick(music.scene, mood); if (!cfg) return;
    var bar = 60 / cfg.bpm * 4, secs = Math.max(3, Math.min(6, bar * 1.5));
    begin(cfg, t, secs, secs * .8, HOLD);
  }
  function setMood(name) {
    var kind = MOOD_KIND[name];
    if (!kind || music.moods[kind] === name) return; // same mood again: nothing to do
    music.moods[kind] = name;
    var sc = SCENES[music.scene];
    if (!music.song || !sc || sc.kind !== kind) return; // remembered for the next scene of that kind
    music.pending = music.song.sc.mood === name ? null : name; // flipping back before the switch cancels it
  }
  // Public: 'calm' | 'uneasy' | 'dire' for strategy screens, 'stealth' | 'contact' | 'critical' for battles.
  // Calling it hands that kind of mood to the UI for good (battles otherwise follow intensity: contact above .5).
  function mood(name) {
    var kind = MOOD_KIND[name]; if (!kind) return;
    music.auto[kind] = false;
    setMood(name);
  }
  function driveCurve(k) { var n = 1024, c = new Float32Array(n); for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; }

  // ------------------------------------------- song state
  // Phonk is built on one riff that loops: the variety comes from the arrangement (which layers play), not from
  // constantly changing notes. So the riff stays put for a few sections and only the last bar of a phrase turns around.
  function newSong(sc) {
    var so = { sc: sc, scale: SCALES[sc.scale], prog: PROGS[rint(PROGS.length)], progBars: 0, section: 'intro', secBars: 4, bar: 0,
      riff: null, riffAge: 0, kick: KICKS[0], lastBass: null, phrase: null, arp: null, wasHot: false, hold: HOLD };
    so.riff = makeRiff();
    so.phrase = makePhrase();
    so.arp = makeArp(sc.style);
    return so;
  }
  function deg(so, d, oct) { var sc = so.scale, n = sc.length, o = Math.floor(d / n); return so.sc.root + sc[((d % n) + n) % n] + 12 * (o + (oct || 0)); }
  function chordDeg(so) { return so.prog[Math.floor(so.bar / 2) % 4]; } // two bars per chord: slow harmony
  // Cowbell riff: 32 steps (two bars) on a syncopated phonk grid, built from root, ♭2, 5th and ♭6.
  var RIFF_GRID = [0, 3, 6, 8, 10, 12, 14];
  function makeRiff() {
    var r = new Array(32).fill(null), tones = [0, 0, 1, 4, 5, 7], picks = RIFF_GRID.filter(function () { return chance(.62); });
    if (picks.indexOf(0) < 0) picks.unshift(0);
    picks.forEach(function (i) { r[i] = tones[rint(tones.length)]; });
    // bar two answers bar one: same rhythm, last two hits move
    for (var i = 0; i < 16; i++) r[16 + i] = r[i];
    var hits = picks.slice(-2); hits.forEach(function (i) { r[16 + i] = tones[rint(tones.length)]; });
    return r;
  }
  function turnaround(r) { var c = r.slice(); [26, 28, 30].forEach(function (i) { c[i] = chance(.6) ? [7, 5, 4, 1][rint(4)] : null; }); return c; }
  function makePhrase() { var m = []; for (var i = 0; i < 16; i++) m.push(i % 4 === 0 && chance(.7) ? [0, 2, 4, 1][rint(4)] : null); return m; }
  // Arpeggio shapes in scale degrees over the chord (0 root, 2 third, 4 fifth, 7 octave). Dark ambient leaves gaps.
  var ARPS = [[0, 2, 4, 7, 4, 2, 0, 2], [0, 4, 7, 4, 9, 7, 4, 2], [0, 2, 4, 2, 7, 4, 2, 4], [7, 4, 2, 0, 2, 4, 6, 4], [0, 7, 4, 7, 2, 7, 4, 1]];
  function makeArp(style) {
    var a = ARPS[rint(ARPS.length)].slice();
    if (style === 'darkambient') a = a.map(function (d, i) { return i === 0 || chance(.55) ? d : null; });
    return a;
  }
  function nextSection(so, hot) {
    var style = so.sc.style;
    if (style === 'darkambient') return weighted({ void: 2, pulse: 3, arp: 3, glitch: 1.5 });
    if (style === 'darksynth') {
      if (so.sc.calm) return weighted({ intro: 3, break: 2, lead: 1.5 });
      return hot ? weighted({ drive: 4, lead: 3, break: 1 }) : weighted({ intro: 1.5, drive: 2, lead: 3, break: 2 });
    }
    if (style !== 'phonk') return weighted({ swell: 2, drift: 3, sparse: 3, melody: 2 });
    if (so.sc.calm) return weighted({ groove: 4, break: 2, lead: 2, intro: 1 });
    return hot ? weighted({ lead: 4, drop: 3, groove: 1.5, break: 1 }) : weighted({ groove: 4, break: 2, intro: 1.5, lead: .8 });
  }

  // ------------------------------------------- scheduler
  function tick() {
    if (!ready() || !music.song) return;
    var so = music.song, sc = so.sc, g = music.g;
    music.intensity += (music.target - music.intensity) * .012;
    var I = sc.calm ? .12 : Math.max(music.intensity, sc.minI || 0), now = ac.currentTime;
    // the subtle part: the beat's filter and the lead's level follow intensity smoothly
    var cut = sc.style === 'phonk' ? 600 + Math.pow(I, 1.6) * 12000 : sc.style === 'darksynth' ? 800 + Math.pow(I, 1.4) * 9000 : 18000;
    g.stealth.frequency.setTargetAtTime(cut, now, .5);
    g.lead.gain.setTargetAtTime(.08 + I * .3, now, .6);
    var sixteenth = 60 / sc.bpm / 4;
    if (music.next < now - .1) music.next = now + .05; // tab was hidden: skip ahead, don't burst
    while (music.next < now + .3) {
      var st = music.step % 16, t = music.next;
      // a mood change waits for a bar line, and for the current song to have played its hold
      if (st === 0 && music.pending && (so.bar === 0 || so.bar >= so.hold)) { var m = music.pending; music.pending = null; crossfade(m, t); return tick(); }
      if (st === 0) newBar(so, t, I);
      if (sc.style === 'phonk') phonkStep(so, st, t, sixteenth, I);
      else if (sc.style === 'darkambient') darkAmbientStep(so, st, t, sixteenth);
      else if (sc.style === 'darksynth') darkSynthStep(so, st, t, sixteenth, I);
      else ambientStep(so, st, t, sixteenth);
      music.next += sixteenth; music.step++;
    }
  }
  function newBar(so, t, I) {
    var hot = I > .55, style = so.sc.style, phonk = style === 'phonk';
    if (hot && !so.wasHot && (phonk || style === 'darksynth') && !so.sc.calm) braam(so, t); // contact: one heavy low hit, XCOM-style
    so.wasHot = hot;
    so.bar++; so.progBars++;
    if (so.progBars >= 16 && chance(.5)) { so.prog = PROGS[rint(PROGS.length)]; so.progBars = 0; }
    if (--so.secBars <= 0) {
      so.section = nextSection(so, hot);
      so.secBars = so.section === 'intro' || so.section === 'break' || so.section === 'void' ? 4 : 8;
      so.kick = KICKS[rint(KICKS.length)];
      if (++so.riffAge >= 3) { so.riff = makeRiff(); so.riffAge = 0; }
      if (style === 'ambient' && so.bar % 8 === 1) so.phrase = makePhrase();
      if ((style === 'darkambient' || style === 'darksynth') && chance(.4)) so.arp = makeArp(style);
      if (phonk && so.section === 'break') chop(so, t, 0);
    }
    var beatLen = 60 / so.sc.bpm;
    if (phonk) { if ((so.section === 'intro' || so.section === 'break') && so.bar % 4 === 1) pad(so, t, beatLen * 16); }
    else if (style === 'darkambient') { if (so.bar % 4 === 1) darkPad(so, t, beatLen * 16 * 1.1, so.sc.cut, .022); }
    else if (style === 'darksynth') { if (so.bar % 2 === 1) darkPad(so, t, beatLen * 8 * 1.05, 1100, .016); }
    else if (so.bar % 2 === 1) pad(so, t, beatLen * 8);
  }
  function phonkStep(so, st, t, sx, I) {
    var sec = so.section, drums = sec === 'groove' || sec === 'lead' || sec === 'drop', ch = chordDeg(so), swing = st % 2 ? sx * .1 : 0;
    var lastOfPhrase = so.secBars === 1;
    if (drums && so.kick[st] === 'x') { kick(t, st === 0 ? 1 : .8); duckPad(t); }
    if (drums && sec === 'drop' && st === 14 && chance(.5)) kick(t, .7);
    if (drums && st === 8) clap(t, 1);
    // hats: off-beat 8ths out of contact, straight 8ths in contact, a roll only at the end of a drop phrase
    if (drums && (st % 4 === 2 || (I > .5 && st % 2 === 0))) hat(t + swing, st % 4 === 2 ? .85 : .55, false);
    if (sec === 'drop' && lastOfPhrase && st >= 12) for (var r = 0; r < 3; r++) hat(t + sx * r / 3, .45, false);
    if (sec === 'drop' && st === 6 && so.bar % 2 === 0) hat(t, .6, true);
    // 808: long notes on the chord root, one glide per bar at most
    if (sec !== 'intro' ? so.kick[st] === 'x' || (sec === 'break' && st === 0) : st === 0 && so.bar % 2 === 1) {
      var note = deg(so, ch, -1) - 12;
      var glide = st !== 0 && chance(.4) ? so.lastBass : null;
      bass(t, note, sec === 'break' || sec === 'intro' ? sx * 28 : sx * (st === 0 ? 10 : 6), glide);
      so.lastBass = note;
    }
    // the cowbell riff, transposed with the chord; it carries the track in lead and drop
    var leadOn = sec === 'lead' || sec === 'drop' || (sec === 'break' && so.bar % 2 === 0);
    var riff = lastOfPhrase ? turnaround(so.riff) : so.riff, m = riff[(so.bar % 2) * 16 + st];
    if (leadOn && m !== null && m !== undefined) cowbell(t, deg(so, ch + m, 2), sec === 'break' ? .5 : sec === 'drop' ? 1 : .8);
  }
  function ambientStep(so, st, t, sx) {
    var sec = so.section, ch = chordDeg(so);
    var p = sec === 'sparse' ? .15 : sec === 'swell' ? .2 : sec === 'drift' ? .3 : .45, m = so.phrase[st];
    if (m !== null && m !== undefined && chance(p)) {
      var n = deg(so, ch + m, 2) + (chance(.1) ? 12 : 0);
      tone({ type: 'triangle', f: [hz(n)], dur: sx * (6 + rint(6)), gain: .04, attack: .05, at: at(t), dest: music.g.out, filter: ['lowpass', 1800], verb: .65 });
    }
    if (sec === 'swell' && st === 0 && so.bar % 4 === 0) shimmer(so, t);
    if (st === 0 && so.bar % 4 === 0) tone({ type: 'sine', f: [hz(deg(so, ch, -1))], dur: sx * 30, gain: .07, attack: sx * 8, at: at(t), dest: music.g.out });
  }
  // Dark ambient: drones and pads carry it; a sub pulse on the bar, a sparse echoed arpeggio, data blips. Barely any drums.
  function darkAmbientStep(so, st, t, sx) {
    var sec = so.section, ch = chordDeg(so);
    if (st === 0 || (sec === 'pulse' && st === 8)) sub(t, deg(so, ch, -1), sx * (st === 0 ? 7 : 5), st === 0 ? 1 : .7);
    if (sec === 'pulse' && st === 0) kick(t, .3);
    if (st % 2 === 0 && sec !== 'void' && sec !== 'intro' && chance(sec === 'arp' ? .55 : .25)) {
      var a = so.arp[(st / 2 + so.bar * 8) % so.arp.length];
      if (a !== null) pluck(t, deg(so, ch + a, 2), sx * 3);
    }
    if (chance((sec === 'glitch' ? .1 : .015) * (so.sc.blips ? 1.8 : 1))) blip(t + (chance(.5) ? sx / 2 : 0));
    if (sec === 'void' && st === 0 && so.bar % 2 === 0) shimmer(so, t);
  }
  // Darksynth: pumping saw bass on 8ths (16ths when driving or in contact), kick on 1 and 3, gated snare on 2 and 4,
  // an arpeggiated lead through the echo.
  function darkSynthStep(so, st, t, sx, I) {
    var sec = so.section, ch = chordDeg(so), drums = sec === 'drive' || sec === 'lead';
    if (drums && (st === 0 || st === 8 || (sec === 'drive' && I > .5 && (st === 4 || st === 12)))) { kick(t, st === 0 ? .9 : .75); duckPad(t); }
    if (drums && (st === 4 || st === 12)) gatedSnare(t, 1);
    if (drums && st % 4 === 2) hat(t, .7, false);
    if (drums && I > .6 && st % 2 === 1) hat(t, .35, false);
    var rate = sec === 'drive' || I > .6 ? 1 : 2;
    if (sec !== 'break' && st % rate === 0) synthBass(t, deg(so, ch, -1) + (st === 14 && chance(.3) ? 12 : 0), sx * rate, I);
    if (sec === 'break' && st === 0) sub(t, deg(so, ch, -1), sx * 14, 1);
    if (sec === 'lead' || sec === 'break' || (sec === 'drive' && I > .4)) {
      var every = sec === 'lead' ? 1 : 2;
      if (st % every === 0) { var a = so.arp[(st / every) % so.arp.length]; if (a !== null) leadArp(t, deg(so, ch + a, 1), sx * every * .9, sec === 'break' ? .6 : 1); }
    }
  }

  // ------------------------------------------- instruments (t = absolute AudioContext time)
  function at(t) { return Math.max(0, t - ac.currentTime); }
  function kick(t, v) {
    var o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(42, t + .12);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.9 * v, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + .38);
    o.connect(g); g.connect(music.g.beat); o.start(t); o.stop(t + .45);
    noise({ dur: .02, gain: .18 * v, at: at(t), dest: music.g.beat, filter: ['highpass', 3000, 3000] });
  }
  function clap(t, v) {
    for (var i = 0; i < 3; i++) noise({ dur: .03, gain: .22 * v, at: at(t + i * .011), dest: music.g.beat, filter: ['bandpass', 1500, 1300, 1.6] });
    noise({ dur: .22, gain: .26 * v, at: at(t + .03), dest: music.g.beat, filter: ['bandpass', 1700, 1100, 1.2], verb: .45 });
    tone({ type: 'triangle', f: [210, 160], dur: .08, gain: .12 * v, at: at(t), dest: music.g.beat });
  }
  function hat(t, v, open) {
    noise({ dur: open ? .16 : .028 + Math.random() * .01, gain: (open ? .07 : .055) * v * (.8 + Math.random() * .4), at: at(t), dest: music.g.beat, filter: ['highpass', 7500, 9000, .7] });
  }
  function bass(t, midi, len, from) {
    var o = ac.createOscillator(), g = ac.createGain(), f = hz(midi);
    o.type = 'sine';
    if (from !== null && from !== undefined && from !== midi) { o.frequency.setValueAtTime(hz(from), t); o.frequency.exponentialRampToValueAtTime(f, t + .09); }
    else { o.frequency.setValueAtTime(f * 2, t); o.frequency.exponentialRampToValueAtTime(f, t + .035); }
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.8, t + .006); g.gain.setTargetAtTime(.0001, t + len * .55, len * .25);
    o.connect(g); g.connect(music.g.dist); o.start(t); o.stop(t + len + .4);
  }
  // The phonk cowbell: two detuned squares through a band-pass, short and bright.
  function cowbell(t, midi, v) {
    var f = hz(midi), g = ac.createGain(), bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = f * 1.6; bp.Q.value = 2.2;
    var wob = (Math.random() - .5) * 14; // tape wobble, in cents
    [1, 1.48].forEach(function (r) { var o = ac.createOscillator(); o.type = 'square'; o.frequency.value = f * r; o.detune.value = wob; o.connect(bp); o.start(t); o.stop(t + .4); });
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.5 * v * (.85 + Math.random() * .3), t + .002); g.gain.exponentialRampToValueAtTime(.0001, t + .3);
    bp.connect(g); g.connect(music.g.lead);
    var s = ac.createGain(); s.gain.value = .25; g.connect(s); s.connect(verbIn);
  }
  // A vowel "chop": a saw through two formant filters gliding from "oh" to "ah", drenched in reverb.
  function chop(so, t, offset) {
    var n = deg(so, chordDeg(so) + offset, 1), o = ac.createOscillator(), g = ac.createGain(), out = ac.createGain();
    o.type = 'sawtooth'; o.frequency.value = hz(n);
    [[500, 760], [900, 1200]].forEach(function (fm) {
      var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 7;
      bp.frequency.setValueAtTime(fm[0], t); bp.frequency.linearRampToValueAtTime(fm[1], t + .2);
      o.connect(bp); bp.connect(g);
    });
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.5, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .45);
    out.gain.value = .5; g.connect(out); out.connect(music.g.out);
    var s = ac.createGain(); s.gain.value = .9; g.connect(s); s.connect(verbIn);
    o.start(t); o.stop(t + .5);
  }
  // The contact hit: detuned saws an octave down with a filter that opens and closes, plus a sub. Felt more than heard.
  function braam(so, t) {
    var g = ac.createGain(), lp = ac.createBiquadFilter(), n = deg(so, chordDeg(so), -1) - 12;
    lp.type = 'lowpass'; lp.Q.value = 4; lp.frequency.setValueAtTime(150, t); lp.frequency.exponentialRampToValueAtTime(1400, t + .35); lp.frequency.exponentialRampToValueAtTime(160, t + 2.4);
    [-9, 0, 9, 1200].forEach(function (dt) { var o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = dt; o.connect(lp); o.start(t); o.stop(t + 2.8); });
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.2, t + .06); g.gain.exponentialRampToValueAtTime(.0001, t + 2.6);
    lp.connect(g); g.connect(music.g.out);
    var sv = ac.createGain(); sv.gain.value = .5; g.connect(sv); sv.connect(verbIn);
    tone({ type: 'sine', f: [hz(n), hz(n) * .9], dur: 1.6, gain: .18, at: at(t), dest: music.g.out });
  }
  // Lo-fi bed: vinyl crackle and tape hiss, looped. Phonk lives on this.
  function crackle(dest, level, t) {
    var n = ac.sampleRate * 3, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * .015 + (Math.random() < .0004 ? (Math.random() * 2 - 1) * .8 : 0);
    var src = ac.createBufferSource(), hp = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = b; src.loop = true; hp.type = 'bandpass'; hp.frequency.value = 2500; hp.Q.value = .5;
    g.gain.value = level; src.connect(hp); hp.connect(g); g.connect(dest); src.start(t);
    return { g: g, o: [src] };
  }
  function shimmer(so, t) {
    [0, 2, 4].forEach(function (d, i) { tone({ type: 'sine', f: [hz(deg(so, chordDeg(so) + d, 3))], dur: 3.5, gain: .02, attack: 1.5, at: at(t + i * .25), dest: music.g.out, verb: .9 }); });
  }
  function pad(so, t, len) {
    var ch = chordDeg(so), inv = rint(3);
    [0, 2, 4].forEach(function (d, i) {
      var n = deg(so, ch + d, 1) + (i < inv ? 12 : 0);
      tone({ type: 'triangle', f: [hz(n)], dur: len * .95, gain: so.sc.style === 'phonk' ? .028 : .035, attack: len * .3, at: at(t), dest: music.g.duck, filter: ['lowpass', 900], verb: .8, detune: i * 4 - 4 });
    });
  }
  // Dark pad: each chord tone is two saws detuned apart, through one low-pass that sweeps slowly open and shut.
  function darkPad(so, t, len, cut, gain) {
    var ch = chordDeg(so), g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(cut * .5, t); lp.frequency.exponentialRampToValueAtTime(cut * 1.7, t + len * .5); lp.frequency.exponentialRampToValueAtTime(cut * .6, t + len);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + len * .35); g.gain.setValueAtTime(gain, t + len * .65); g.gain.exponentialRampToValueAtTime(.0001, t + len);
    [0, 2, 4].forEach(function (d) {
      var f = hz(deg(so, ch + d, 0));
      [-9, 9].forEach(function (dt) { var o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt + (Math.random() - .5) * 6; o.connect(lp); o.start(t); o.stop(t + len + .1); });
    });
    lp.connect(g); g.connect(music.g.duck);
    var s = ac.createGain(); s.gain.value = .6; g.connect(s); s.connect(verbIn);
  }
  // Sub-bass pulse: a soft sine swell, felt more than heard.
  function sub(t, midi, len, v) {
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = hz(midi);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.2 * v, t + .04); g.gain.setTargetAtTime(.0001, t + len * .4, len * .2);
    o.connect(g); g.connect(music.g.out); o.start(t); o.stop(t + len + .3);
  }
  // Glassy pluck for the dark-ambient arpeggio, into the echo.
  function pluck(t, midi, len) {
    var f = hz(midi), g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(2400, t); lp.frequency.exponentialRampToValueAtTime(500, t + len);
    [['triangle', 0], ['sine', 1200]].forEach(function (w) { var o = ac.createOscillator(); o.type = w[0]; o.frequency.value = f; o.detune.value = w[1] + (Math.random() - .5) * 8; o.connect(lp); o.start(t); o.stop(t + len + .1); });
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.05, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + len);
    lp.connect(g); g.connect(music.g.arp);
    var s = ac.createGain(); s.gain.value = .5; g.connect(s); s.connect(verbIn);
  }
  // Data blip: two to four tiny square chirps, like a modem thinking aloud.
  function blip(t) {
    var f = hz(84 + rint(14)), n = 2 + rint(3), down = chance(.5);
    for (var i = 0; i < n; i++) tone({ type: 'square', f: [f * (down ? 1 - i * .12 : 1 + i * .1)], dur: .022, gain: .016, attack: .002, at: at(t + i * .032), dest: music.g.out, filter: ['bandpass', f, 5], verb: .3 });
  }
  // Gated snare: a noise burst that holds flat and is then cut hard, with a body tone. The 80s darksynth snare.
  function gatedSnare(t, v) {
    var src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = .8;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.3 * v, t + .003); g.gain.setValueAtTime(.2 * v, t + .13); g.gain.linearRampToValueAtTime(.0001, t + .15);
    src.connect(bp); bp.connect(g); g.connect(music.g.beat);
    var s = ac.createGain(); s.gain.value = .2; g.connect(s); s.connect(verbIn);
    src.start(t, Math.random() * .5); src.stop(t + .2);
    tone({ type: 'triangle', f: [200, 150], dur: .09, gain: .16 * v, at: at(t), dest: music.g.beat });
  }
  // Pumping bass: saw plus square under a closing low-pass, its level swelling up after each hit (the sidechain feel).
  function synthBass(t, midi, len, I) {
    var f = hz(midi), g = ac.createGain(), lp = ac.createBiquadFilter(), cut = 220 + I * 900;
    lp.type = 'lowpass'; lp.Q.value = 3; lp.frequency.setValueAtTime(cut * 2.5, t); lp.frequency.exponentialRampToValueAtTime(cut, t + len * .6);
    [['sawtooth', 0], ['square', -8]].forEach(function (w) { var o = ac.createOscillator(); o.type = w[0]; o.frequency.value = f; o.detune.value = w[1]; o.connect(lp); o.start(t); o.stop(t + len + .05); });
    g.gain.setValueAtTime(.04, t); g.gain.linearRampToValueAtTime(.42, t + len * .55); g.gain.exponentialRampToValueAtTime(.0001, t + len * .98);
    lp.connect(g); g.connect(music.g.bass);
  }
  // Arpeggiated lead: square and saw a hair apart through a resonant low-pass, into the echo.
  function leadArp(t, midi, len, v) {
    var f = hz(midi), g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 4; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(900, t + len * 1.5);
    [['square', -5], ['sawtooth', 5]].forEach(function (w) { var o = ac.createOscillator(); o.type = w[0]; o.frequency.value = f; o.detune.value = w[1]; o.connect(lp); o.start(t); o.stop(t + len * 1.6 + .05); });
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.12 * v, t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + len * 1.6);
    lp.connect(g); g.connect(music.g.lead);
  }
  function duckPad(t) { var d = music.g.duck.gain; d.cancelScheduledValues(t); d.setValueAtTime(.35, t); d.linearRampToValueAtTime(1, t + .28); }
  // 0 = calm, 1 = contact. Battles set it from whether hostiles are in sight.
  function intensity(v) { music.target = Math.max(0, Math.min(1, v)); if (music.auto.battle) setMood(v > .5 ? 'contact' : 'stealth'); }

  // Test hook: an analyser on the master bus (tests/browser/audio-levels.mjs).
  function meter() { if (!ac) return null; var a = ac.createAnalyser(); a.fftSize = 2048; master.connect(a); return a; }

  return { play: play, scene: scene, mood: mood, meter: meter, intensity: intensity, ready: ready, unlock: unlock, SFX: SFX, SCENES: SCENES,
    _state: function () { var so = music.song; return { ac: ac && ac.state, scene: music.scene, want: music.want, unlocked: unlocked, section: so && so.section, bar: so && so.bar, intensity: +music.intensity.toFixed(2), cutoff: music.g && Math.round(music.g.stealth.frequency.value),
      style: so && so.sc.style, variant: so && so.sc.id, mood: so && so.sc.mood, bpm: so && so.sc.bpm, pending: music.pending, moods: Object.assign({}, music.moods), seed: music.seed }; } };
})();
