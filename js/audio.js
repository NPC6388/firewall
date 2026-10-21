// FIREWALL: synthesized audio (WebAudio, no sound files). SFX for battle and UI events, plus a generative ambient score.
// Nothing plays until the first click or key press (browser autoplay rules). Everything is safe to call before then.
var XG = globalThis.XG = globalThis.XG || {};

XG.Audio = (function () {
  var S = XG.Settings, ac = null, master, sfxBus, musicBus, verb, verbIn, noiseBuf = null, unlocked = false;
  var music = { scene: null, want: null, nodes: [], timer: null, next: 0, step: 0, chord: 0, intensity: 0, target: 0 };
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
    node.connect(o.bus === 'music' ? musicBus : sfxBus);
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
  // Each scene: root note, scale, tempo, and which layers play.
  var SCENES = {
    title:   { root: 45, scale: [0, 2, 3, 7, 8], bpm: 64, arp: .12, pulse: false, wave: 'sawtooth', cut: 500 },
    fw:      { root: 45, scale: [0, 3, 5, 7, 10], bpm: 72, arp: .22, pulse: false, wave: 'sawtooth', cut: 700 },
    lat:     { root: 39, scale: [0, 1, 5, 7, 8], bpm: 66, arp: .2, pulse: false, wave: 'square', cut: 420 },
    battle:  { root: 43, scale: [0, 3, 5, 7, 10], bpm: 96, arp: .35, pulse: true, wave: 'sawtooth', cut: 600 },
    'battle-lat': { root: 39, scale: [0, 1, 3, 7, 8], bpm: 92, arp: .35, pulse: true, wave: 'square', cut: 480 }
  };
  var CHORDS = [[0, 2, 4], [3, 0, 2], [4, 1, 3], [1, 3, 0]];
  function scene(name) {
    music.want = name;
    if (ready() && name !== music.scene) startScene(name);
  }
  function stopScene() {
    var t = ac.currentTime;
    music.nodes.forEach(function (n) { try { n.g.gain.setTargetAtTime(0.0001, t, .6); n.o.forEach(function (o) { o.stop(t + 3); }); } catch (e) { } });
    music.nodes = [];
    if (music.timer) clearInterval(music.timer);
    music.timer = null;
  }
  function startScene(name) {
    stopScene();
    music.scene = name;
    var sc = SCENES[name]; if (!sc) return;
    // drone: root and fifth, slowly breathing low-pass
    var g = ac.createGain(), fl = ac.createBiquadFilter(), lfo = ac.createOscillator(), lg = ac.createGain(), t = ac.currentTime;
    fl.type = 'lowpass'; fl.frequency.value = sc.cut; fl.Q.value = 3;
    lfo.frequency.value = .07; lg.gain.value = sc.cut * .45; lfo.connect(lg); lg.connect(fl.frequency);
    var os = [0, 7, -12].map(function (n, i) { var o = ac.createOscillator(); o.type = i === 2 ? 'sine' : sc.wave; o.frequency.value = hz(sc.root + n); o.detune.value = (i - 1) * 7; o.connect(fl); o.start(); return o; });
    lfo.start(); os.push(lfo);
    fl.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.09, t + 3);
    g.connect(musicBus); var s = ac.createGain(); s.gain.value = .35; g.connect(s); s.connect(verbIn);
    music.nodes.push({ g: g, o: os });
    music.next = ac.currentTime + .2; music.step = 0;
    music.timer = setInterval(tick, 60);
  }
  function tick() {
    if (!ready()) return;
    var sc = SCENES[music.scene]; if (!sc) return;
    music.intensity += (music.target - music.intensity) * .02;
    var beat = 60 / sc.bpm / 4;
    if (music.next < ac.currentTime - .1) music.next = ac.currentTime + .05; // tab was hidden: skip, don't burst
    while (music.next < ac.currentTime + .25) {
      var at = music.next - ac.currentTime, st = music.step;
      if (st % 64 === 0) music.chord = (music.chord + 1) % CHORDS.length;
      if (st % 32 === 0) pad(sc, at, beat * 32);
      var arpP = sc.arp + music.intensity * .3;
      if (st % 2 === 0 && Math.random() < arpP) {
        var ch = CHORDS[music.chord], deg = ch[Math.floor(Math.random() * 3)] + (Math.random() < .3 ? 2 : 0);
        var n = sc.root + 24 + sc.scale[deg % sc.scale.length] + (deg >= sc.scale.length ? 12 : 0) + (Math.random() < .2 ? 12 : 0);
        tone({ type: 'triangle', f: [hz(n), hz(n)], dur: beat * 3, gain: .05 + music.intensity * .02, at: at, bus: 'music', filter: ['lowpass', 2400], verb: .5 });
      }
      if (sc.pulse) {
        if (st % 8 === 0) tone({ type: 'sine', f: [110, 40], dur: .25, gain: .12 + music.intensity * .1, at: at, bus: 'music' });
        if (st % 4 === 2 && music.intensity > .4) noise({ dur: .04, gain: .03 * music.intensity, at: at, bus: 'music', filter: ['highpass', 7000, 7000] });
      }
      music.next += beat; music.step++;
    }
  }
  function pad(sc, at, len) {
    CHORDS[music.chord].forEach(function (deg, i) {
      var n = sc.root + 12 + sc.scale[deg];
      tone({ type: 'triangle', f: [hz(n), hz(n)], dur: len * .95, gain: .035, attack: len * .3, at: at, bus: 'music', filter: ['lowpass', 900], verb: .8, detune: i * 4 - 4 });
    });
  }
  // 0 = calm, 1 = contact. Battles raise it when hostiles are in sight.
  function intensity(v) { music.target = Math.max(0, Math.min(1, v)); }

  // Test hook: an analyser on the master bus (tests/browser/audio-levels.mjs).
  function meter() { if (!ac) return null; var a = ac.createAnalyser(); a.fftSize = 2048; master.connect(a); return a; }

  return { play: play, scene: scene, meter: meter, intensity: intensity, ready: ready, unlock: unlock, SFX: SFX, SCENES: SCENES, _state: function () { return { ac: ac && ac.state, scene: music.scene, want: music.want, unlocked: unlocked }; } };
})();
