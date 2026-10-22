// Music moods: every scene x mood picks a fitting style, repeated moods are no-ops, mood changes wait out the hold
// (about 8 bars) and land on a bar line, mute silences it, and music peaks stay under weapon fire.
export default async function ({ ev, sleep, send }) {
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 5, y: 5, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 5, y: 5, button: 'left', clickCount: 1 });
  await sleep(500);
  const out = await ev(`(async function(){
    var A=XG.Audio, m=A.meter(), buf=new Float32Array(m.fftSize), res={ peaks:{}, fails:[], info:[] };
    var wait=function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
    var peak=function(ms){ return new Promise(function(done){ var p=0, t0=performance.now(); (function f(){ m.getFloatTimeDomainData(buf); for(var i=0;i<buf.length;i++) p=Math.max(p,Math.abs(buf[i])); if(performance.now()-t0<ms) setTimeout(f,10); else done(p); })(); }); };
    var fail=function(s){ res.fails.push(s); };
    if (!A.ready()) fail('audio not ready after gesture');
    // weapon reference, music off
    XG.Settings.set('music', 0); await wait(1500);
    A.SFX['shot-bullet']({}); res.weapon=+(await peak(450)).toFixed(3); await wait(400);
    XG.Settings.set('music', .5); await wait(300);
    var EXPECT = { calm:['ambient','darkambient','phonk'], uneasy:['darkambient','darksynth','phonk'], dire:['darksynth','phonk'],
      stealth:['darkambient','darksynth'], contact:['darksynth','phonk'], critical:['darksynth','phonk'] };
    var cases = [['title','calm'],['fw','calm'],['fw','uneasy'],['fw','dire'],['lat','calm'],['lat','uneasy'],['lat','dire'],
      ['battle','stealth'],['battle','contact'],['battle','critical'],['battle-lat','stealth'],['battle-lat','contact'],['battle-lat','critical']];
    var styles={};
    for (var c of cases) {
      A.scene('title'); A.mood(c[1]); A.scene(c[0]);
      var p = await peak(5000), s = A._state();
      res.peaks[c[0]+'/'+c[1]+' '+s.style+' ('+s.variant+', '+s.bpm+' bpm)'] = +p.toFixed(3);
      styles[s.style]=1;
      if (s.scene !== c[0]) fail(c.join('/')+': scene '+s.scene);
      if (c[0] !== 'title' && s.mood !== c[1]) fail(c.join('/')+': mood '+s.mood);
      if (EXPECT[c[1]].indexOf(s.style) < 0) fail(c.join('/')+': style '+s.style);
      if (!(s.bar > 0)) fail(c.join('/')+': no bars scheduled');
      if (p < .005) fail(c.join('/')+': silent');
    }
    res.styles = Object.keys(styles);
    // variety: the same scene and mood twice in a row picks a different variant
    var v = []; for (var k=0;k<3;k++){ A.mood('calm'); A.scene('title'); A.scene('fw'); await wait(200); v.push(A._state().variant); }
    if (v[0]===v[1] || v[1]===v[2]) fail('fw/calm repeated a variant: '+v.join(','));
    res.info.push('fw/calm picks: '+v.join(', '));
    // same mood again = no-op; a flip that comes back before the hold cancels; a real change waits for the hold
    A.scene('title'); A.mood('stealth'); A.scene('battle'); await wait(2500);
    var s0 = A._state();
    for (var r=0;r<5;r++) A.mood('stealth');
    if (A._state().pending) fail('repeated mood queued a change');
    A.mood('contact'); var sP = A._state();
    if (sP.pending !== 'contact') fail('contact not pending: '+sP.pending);
    A.mood('stealth');
    if (A._state().pending) fail('flip back did not cancel');
    A.mood('contact');
    var switched = null, t0 = performance.now();
    var lastBar = 0;
    while (performance.now() - t0 < 45000) { await wait(250); var sx = A._state(); if (sx.mood === 'contact') { switched = sx; break; } lastBar = sx.bar; }
    if (!switched) fail('contact never arrived'); else res.info.push('stealth '+s0.variant+' held '+lastBar+' bars, then contact '+switched.variant+' (bar '+switched.bar+' of the new song)');
    if (switched && lastBar < 7) fail('switched early, after '+lastBar+' bars');
    A.mood('critical'); await wait(1000);
    if (A._state().mood !== 'contact') fail('critical cut in before the hold');
    // mute
    XG.Settings.set('muted', true); await wait(1500); res.muted = +(await peak(1500)).toFixed(4);
    if (res.muted > .002) fail('muted but peak '+res.muted);
    XG.Settings.set('muted', false);
    res.maxMusic = Math.max.apply(null, Object.values(res.peaks));
    if (res.maxMusic >= res.weapon) fail('music peak '+res.maxMusic+' not under weapon '+res.weapon);
    res.state = A._state();
    return JSON.stringify(res);
  })()`);
  const o = JSON.parse(out);
  console.log('weapon (shot-bullet) peak:', o.weapon);
  Object.entries(o.peaks).forEach(([k, v]) => console.log('  music ' + k.padEnd(52) + v));
  console.log('styles heard:', o.styles.join(', '));
  o.info.forEach((s) => console.log(s));
  console.log('muted peak:', o.muted, '| max music peak:', o.maxMusic.toFixed(3));
  console.log('final state:', JSON.stringify(o.state));
  console.log(o.fails.length ? 'FAIL\n  ' + o.fails.join('\n  ') : 'music moods: all checks passed');
}
