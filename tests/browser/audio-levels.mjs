// Peak level of every sound effect and of the music, measured on the master bus. Flags anything near clipping or silent.
export default async function ({ ev, sleep, send }) {
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 5, y: 5, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 5, y: 5, button: 'left', clickCount: 1 });
  await sleep(200);
  await ev(`XG.Settings.set('music', 0)`); await sleep(800);
  const out = await ev(`(async function(){
    var A=XG.Audio, m=A.meter(), buf=new Float32Array(m.fftSize), res={};
    var peak=function(ms){ return new Promise(function(done){ var p=0, t0=performance.now(); (function f(){ m.getFloatTimeDomainData(buf); for(var i=0;i<buf.length;i++) p=Math.max(p,Math.abs(buf[i])); if(performance.now()-t0<ms) setTimeout(f,10); else done(p); })(); }); };
    for (var k of Object.keys(A.SFX)) { A.SFX[k]({}); res[k]=+(await peak(k==='boom'||k==='defeat'?900:450)).toFixed(3); await new Promise(r=>setTimeout(r,250)); }
    XG.Settings.set('music', .5); A.scene('battle'); A.intensity(1); res['music: battle']=+(await peak(4000)).toFixed(3);
    return JSON.stringify(res);
  })()`);
  const res = JSON.parse(out);
  Object.entries(res).forEach(([k, v]) => console.log((v > .95 ? 'LOUD   ' : v < .01 ? 'SILENT ' : '       ') + k.padEnd(16) + v));
}
