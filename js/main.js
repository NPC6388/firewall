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
    S.save(UI.g); UI.render();
    if (toast && toast.length) UI.toast(toast);
    UI.playStory(function () { UI.render(); });
  }
  function titleScreen() {
    UI.g = null;
    var saved = S.load();
    document.getElementById('btn-continue').classList.toggle('hidden', !saved || !!saved.over);
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
    'to-title': function () { if (UI.g && !UI.g.over) S.save(UI.g); UI.closeModal(); titleScreen(); },
    'close': function () { UI.closeModal(); },
    'tab': function (arg) { UI.tab = arg; UI.slot = null; UI.render(); },
    'advance': function () {
      var ev = St.advanceUntilEvent(UI.g);
      commit(ev.map(function (e) { return e.msg; }));
    },
    'advance-day': function () {
      var ev = St.advanceDay(UI.g);
      commit(ev.map(function (e) { return e.msg; }));
    },
    'research': function (id) { St.startResearch(UI.g, id); commit(); },
    'slot': function (i) { UI.slot = +i; UI.render(); },
    'build': function (type) { if (St.build(UI.g, type, UI.slot)) UI.slot = null; commit(); },
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
      document.getElementById('ab-yes').onclick = function () { S.clear(); UI.closeModal(); titleScreen(); };
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

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    var fn = actions[el.getAttribute('data-action')];
    if (fn) fn(el.getAttribute('data-arg'));
  });

  titleScreen();
})();
