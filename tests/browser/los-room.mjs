// The user's "more los info" room (2026-10-24): a drone in the inside SW corner of a building, a window beside it and one
// higher up, the user's unit outside beside a tall pillar. Draws the room in the real renderer and tints every tile the
// drone can see (green), outlines the user's yellow boxes (tiles it should see), and marks the user's unit.
// Shot: los-room.png. Run: node tests/browser/drive.mjs tests/browser/los-room.mjs
export default async function ({ ev, shot, sleep, send }) {
  await ev(`localStorage.clear(); XG.Settings.set('hints', false); location.reload()`); await sleep(1200);
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 950, deviceScaleFactor: 1, mobile: false }); await sleep(300);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); g.missions=[]; var m=XG.Strat.spawnMission(g,r,'purge'); m.scenario='exterminate'; XG.State.saveRng(g,r); XG.UI.tab='command'; XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(800);
  await ev(`(function(){var c=document.getElementById('coach'); if (c) c.classList.add('hidden');})()`);
  const info = await ev(`(function(){var b=XG.TacUI.debug().b, T=XG.Tac, W=b.W, OX=16, OY=13;
    b.tiles.fill(T.FLOOR); b.props.fill(0); if (b.faces) b.faces.fill(0); b.tileHp={}; delete b.outside; delete b.server;
    function P(dx,dy,t,p){var k=(OY+dy)*W+OX+dx; b.tiles[k]=t; b.props[k]=p||0;}
    for (var y=-7;y<=1;y++) P(-1,y,T.WALL);
    P(-1,-1,T.LOW,'window'); P(-1,-4,T.LOW,'window');
    for (var x=-1;x<=6;x++) P(x,1,T.WALL);
    P(2,1,T.LOW,'glass');
    for (x=-1;x<=6;x++) P(x,-6,T.WALL);
    for (y=-6;y<=1;y++) P(6,y,T.WALL);
    P(1,-4,T.HIGH,'rack'); P(3,-4,T.HIGH,'rack'); P(4,-4,T.HIGH,'rack');
    P(1,-1,T.LOW,'desk'); P(2,-1,T.LOW,'desk'); P(4,-2,T.LOW,'desk');
    P(-4,-3,T.LOW,'barrel'); P(-3,-3,T.LOW); P(-6,-3,T.LOW); P(-7,-3,T.LOW);
    P(-3,1,T.LOW); P(-4,2,T.HIGH,'pillar'); P(-4,3,T.HIGH,'pillar'); P(-4,4,T.HIGH,'pillar');
    b.units.forEach(function(u){u.alive=false;});
    var red=b.units.filter(function(u){return u.side==='enemy'&&!u.isStatic})[0], blue=b.units.filter(function(u){return u.sid})[0];
    red.alive=true; red.x=OX; red.y=OY; red.kind='drone'; blue.alive=true; blue.x=OX-5; blue.y=OY+2;
    b.visible=b.visible.map(function(){return true}); b.explored=b.visible.slice();
    window.LR={OX:OX,OY:OY,red:red,blue:blue};
    return 'drone sees your unit: '+T.los(b,red.x,red.y,blue.x,blue.y);})()`);
  console.log(info);
  await ev(`(function(){var b=XG.TacUI.debug().b; document.querySelector('[data-unit="'+LR.blue.id+'"]').click(); XG.TacUI.centerOn(LR.OX-2, LR.OY-1);})()`); await sleep(1500);
  await ev(`XG.TacUI.tileToClient(LR.OX, LR.OY)`); await sleep(800);
  await ev(`(function(){var b=XG.TacUI.debug().b, T=XG.Tac, OX=LR.OX, OY=LR.OY;
    var p0=XG.TacUI.tileToClient(OX,OY), s=p0.tile;
    function at(x,y){return [p0.x+(x-OX)*s, p0.y+(y-OY)*s];}
    var Y={}; function yb(x0,x1,y0,y1){for(var yy=y0;yy<=y1;yy++)for(var xx=x0;xx<=x1;xx++)Y[xx+','+yy]=1;}
    yb(-6,-2,-2,0); yb(-5,-5,-3,-3); yb(-1,-1,-4,-4); yb(-1,-1,-1,-1); yb(0,0,-5,-1);
    yb(1,3,-5,-5); yb(2,2,-4,-3); yb(1,1,-3,-2); yb(5,5,-2,-2); yb(3,5,-1,-1); yb(1,5,0,0); yb(2,2,1,1);
    var lay=document.createElement('div'); lay.id='losfx'; lay.style.cssText='position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:50';
    document.body.appendChild(lay);
    for (var dy=-9; dy<=6; dy++) for (var dx=-12; dx<=8; dx++) {
      var x=OX+dx, y=OY+dy; if (x<0||y<0||x>=b.W||y>=b.H) continue;
      var c=at(x,y), seen=!(dx===0&&dy===0) && T.los(b,OX,OY,x,y), box=Y[dx+','+dy];
      if (!seen && !box) continue;
      var d=document.createElement('div');
      d.style.cssText='position:absolute;left:'+(c[0]-s/2+1)+'px;top:'+(c[1]-s/2+1)+'px;width:'+(s-2)+'px;height:'+(s-2)+'px;box-sizing:border-box;'+
        (seen?'background:rgba(60,255,120,0.30);':'')+(box?'border:3px solid #ffd400;':'');
      lay.appendChild(d);
    }
    var cb=at(LR.blue.x,LR.blue.y), cr=at(OX,OY);
    var svg='<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;left:0;top:0;width:100%;height:100%"><line x1="'+cr[0]+'" y1="'+cr[1]+'" x2="'+cb[0]+'" y2="'+cb[1]+'" stroke="#ff4d6d" stroke-width="3" stroke-dasharray="8 6"/></svg>';
    lay.insertAdjacentHTML('beforeend', svg);
    var leg=document.createElement('div'); leg.style.cssText='position:fixed;left:20px;top:60px;background:rgba(0,0,0,0.85);color:#fff;font:14px monospace;padding:10px 14px;border:1px solid #555;z-index:51;line-height:1.6';
    leg.innerHTML='<b>What the red drone sees now</b><br><span style="background:rgba(60,255,120,0.5)">&nbsp;&nbsp;&nbsp;&nbsp;</span> green: it can see this tile<br><span style="border:3px solid #ffd400">&nbsp;&nbsp;&nbsp;</span> yellow: your boxes (should see)<br><span style="color:#ff4d6d">- - -</span> red dash: the line to your unit (it can'+(XG.Tac.los(b,OX,OY,LR.blue.x,LR.blue.y)?'':' NOT')+' see it)';
    document.body.appendChild(leg);
    return s;})()`);
  await sleep(300);
  await shot('los-room');
}
