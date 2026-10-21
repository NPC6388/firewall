// FIREWALL: boot + action router.
var XG = globalThis.XG = globalThis.XG || {};

(function () {
  var UI = XG.UI, S = XG.State, St = XG.Strat;

  function enterStrategy(g) {
    UI.g = g;
    UI.show('screen-strategy');
    UI.render();
    UI.playStory(function () { UI.render(); });
  }
  function commit(toast) {
    UI.save(UI.g); UI.render();
    if (toast && toast.length) UI.toast(toast);
    if (toast && toast.some(function (t) { return /mission|target|raid|strike|uplink|found|detected/i.test(t); })) XG.Audio.play('mission');
    UI.playStory(function () { UI.render(); });
  }
  function titleScreen() {
    UI.g = null;
    document.body.classList.remove('lattice');
    XG.Audio.scene('title');
    var saved = S.load(), lsaved = XG.Lat.load();
    document.getElementById('btn-continue').classList.toggle('hidden', !saved || !!saved.over);
    document.getElementById('btn-l-continue').classList.toggle('hidden', !lsaved || !!lsaved.over);
    UI.show('screen-title');
  }

  var actions = {
    'new-game': function () {
      var go = function () { UI.closeModal(); UI.tab = 'command'; var g = S.newGame(); S.save(g); enterStrategy(g); };
      if (S.load()) {
        UI.modal('<h1>Start a new campaign?</h1><p>This overwrites your current save.</p><div class="modal-actions"><button data-action="close">Cancel</button><button class="danger" id="ng-yes">Overwrite</button></div>');
        document.getElementById('ng-yes').onclick = go;
      } else go();
    },
    'continue': function () { var g = S.load(); if (g) enterStrategy(g); },
    'to-title': function () { if (UI.g && !UI.g.over) UI.save(UI.g); UI.closeModal(); titleScreen(); },
    'close': function () { UI.closeModal(); },
    'help': function () { XG.Help.open(); },
    'settings': function () { XG.Help.settings(); },
    'sort': function (key) { UI.sortBy(key); },
    'tip-ok': function (id) { XG.Settings.markTip(id); UI.render(); },
    'tab': function (arg) { UI.tab = arg; UI.slot = null; UI.render(); },
    'advance': function () {
      XG.Audio.play('advance');
      var ev = St.advanceUntilEvent(UI.g);
      commit(ev.map(function (e) { return e.msg; }));
    },
    'advance-day': function () {
      var ev = St.advanceDay(UI.g);
      commit(ev.map(function (e) { return e.msg; }));
    },
    'research': function (id) { St.startResearch(UI.g, id); XG.Audio.play('research'); commit(); },
    'slot': function (i) { UI.slot = +i; UI.render(); },
    'build': function (type) { if (St.build(UI.g, type, UI.slot)) { UI.slot = null; XG.Audio.play('build'); } commit(); },
    'cancel-build': function () { if (St.cancelBuild(UI.g, UI.slot)) UI.slot = null; commit(); },
    'demolish': function () {
      var f = XG.DATA.facilities[UI.g.base[UI.slot].type], ref = St.demolishRefund(UI.g.base[UI.slot].type);
      UI.modal('<h1>Demolish ' + f.name + '?</h1><p>It goes offline now. In ' + St.demolishDays(UI.g.base[UI.slot].type) + ' day(s) the slot frees up and you get back ' + St.costText(ref) + ' (50%).</p>' +
        '<div class="modal-actions"><button data-action="close">Keep it</button><button class="danger" id="dm-yes">Demolish</button></div>');
      document.getElementById('dm-yes').onclick = function () { UI.closeModal(); St.demolish(UI.g, UI.slot); commit(); };
    },
    'cancel-demolish': function () { St.cancelDemolish(UI.g, UI.slot); commit(); },
    'fabricate': function (id) { St.fabricate(UI.g, id); commit(); },
    'hire': function (cls) { St.hire(UI.g, cls); commit(); },
    'replay': function (key) { UI.storyModal(key, UI.closeModal); },
    'abandon': function () {
      UI.modal('<h1>Abandon campaign?</h1><p>The save is deleted. HALCYON will remember, even if you don\'t.</p><div class="modal-actions"><button data-action="close">Cancel</button><button class="danger" id="ab-yes">Abandon</button></div>');
      document.getElementById('ab-yes').onclick = function () { if (UI.g.faction === 'lattice') XG.Lat.clear(); else S.clear(); UI.closeModal(); titleScreen(); };
    },
    'deploy': function (id) {
      var g = UI.g, m = g.missions.filter(function (x) { return x.id === +id; })[0];
      if (!m) return;
      UI.squadSelect(m, function (squad) {
        if (!squad.length) return;
        S.save(g);
        XG.TacUI.start(g, m, squad, function (result) {
          var out = St.resolveMission(g, m.id, result);
          S.save(g);
          UI.show('screen-strategy'); UI.render();
          UI.results(out, function () { UI.render(); UI.playStory(function () { UI.render(); }); });
        });
      });
    }
  };

  // Lattice campaign actions live with its screens.
  var latActions = XG.LUI.actions({ commit: commit, enterStrategy: enterStrategy, titleScreen: titleScreen });
  Object.keys(latActions).forEach(function (k) { actions[k] = latActions[k]; });

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    var fn = actions[el.getAttribute('data-action')];
    XG.Audio.play('click');
    if (fn) fn(el.getAttribute('data-arg'));
  });
  // Outside battle: ? / F1 opens help, M mutes. (The battle screen has its own key handler.)
  document.addEventListener('keydown', function (e) {
    if (!document.getElementById('screen-tactical').classList.contains('hidden') || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === '?' || e.key === 'F1') { e.preventDefault(); XG.Help.open(); }
    else if (e.key === 'm' || e.key === 'M') XG.Settings.set('muted', !XG.Settings.get('muted'));
    else if (e.key === 'Escape' && UI.isModal() && document.querySelector('#modal-box [data-action="close"]')) UI.closeModal();
  });

  titleScreen();
})();
