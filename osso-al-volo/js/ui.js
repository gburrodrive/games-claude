/* Osso al Volo — interfaccia (menu, tabellone, comandi touch) e avvio */
(function () {
  'use strict';
  const OAV = window.OAV;
  const U = OAV.U;
  const $ = (id) => document.getElementById(id);

  function boot() {
    if (OAV.game) return;
    let toastTimer = 0;
    const ui = {
      screens: { menu: $('menu'), pause: $('pause'), over: $('over') },
      last: {},
      show(name) {
        for (const k in this.screens) this.screens[k].hidden = k !== name;
        $('hud').hidden = !(name === 'play' || name === 'pause');
        document.body.classList.toggle('is-playing', name === 'play');
        if (name === 'menu') refreshBest();
        if (name === 'pause') $('b-resume').focus({ preventScroll: true });
        if (name === 'over') $('b-again').focus({ preventScroll: true });
        if (name === 'play' && document.activeElement && document.activeElement.blur) document.activeElement.blur();
      },
      hud(d, force) {
        const L = this.last;
        if (force || L.bones !== d.bones) { $('h-bones').textContent = d.bones; L.bones = d.bones; }
        if (force || L.score !== d.score) { $('h-score').textContent = d.score.toLocaleString('it-IT'); L.score = d.score; }
        if (force || L.clock !== d.clock) { $('h-clock').textContent = d.clock; L.clock = d.clock; }
        if (force || L.clockLabel !== d.clockLabel) { $('h-clock-lbl').textContent = d.clockLabel; L.clockLabel = d.clockLabel; }
        if (force || L.low !== d.low) { $('h-clock').classList.toggle('is-low', d.low); L.low = d.low; }
        const st = Math.round(d.stamina * 100);
        if (force || L.st !== st) { $('h-stamina').style.transform = `scaleX(${(st / 100).toFixed(2)})`; L.st = st; }
        if (force || L.tired !== d.tired) { $('h-meter').classList.toggle('is-tired', d.tired); L.tired = d.tired; }
        const wr = Math.round(d.wind * 10);
        if (force || L.wr !== wr) {
          $('h-wind').textContent = `${Math.abs(d.wind).toFixed(1).replace('.', ',')} m/s`;
          $('h-wind-arrow').style.transform = d.wind < 0 ? 'scaleX(-1)' : 'none';
          L.wr = wr;
        }
      },
      toast(msg, kind) {
        const t = $('toast');
        t.textContent = msg;
        t.className = 'is-on ' + (kind || '');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { t.className = kind || ''; }, 1700);
      },
      flashThrow(d) {
        if (game.state === 'play' && d >= 18) this.toast(`Lancio lungo: ${Math.round(d)} m!`, 'info');
      },
      gameOver(s) {
        const dl = $('over-stats');
        const rows = [
          ['Ossi mangiati', s.bones, true],
          ['Punti', s.score.toLocaleString('it-IT'), true],
          ['Prese al volo', s.air],
          ['Prese acrobatiche', s.acro],
          ['Rubati dai gabbiani', s.gull],
          ['Persi in mare', s.sea],
          ['Corsa totale', `${Math.round(s.dist)} m`],
          ['Velocità massima', `${s.vmax.toFixed(1).replace('.', ',')} km/h`],
          ['Finte subite', s.fakes],
        ];
        dl.innerHTML = '';
        for (const [k, v, hero] of rows) {
          const d = document.createElement('div');
          d.className = 'stat' + (hero ? ' stat--hero' : '');
          const dt = document.createElement('dt');
          dt.textContent = k;
          const dd = document.createElement('dd');
          dd.textContent = v;
          d.append(dt, dd);
          dl.append(d);
        }
        $('over-title').textContent = s.mode === 'tempo' ? 'Fine giornata' : 'Troppi ossi persi';
        $('over-record').textContent = s.record ? `Nuovo record per ${s.name}!` : `Record: ${(s.best || 0).toLocaleString('it-IT')} punti`;
        $('over-record').hidden = false;
        const t = $('toast');
        t.className = '';
        clearTimeout(toastTimer);
        this.show('over');
      },
      toggleMute() {
        const m = !game.sfx.muted;
        game.sfx.setMuted(m);
        syncMute();
      },
      restart() { startGame(); },
    };

    const game = new OAV.Game($('scene'), ui);
    OAV.game = game;
    game.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // menu: valori salvati
    $('dog-name').value = game.dogName;
    const sex = U.lsGet('oav.sex', 'm');
    $(sex === 'f' ? 'sex-f' : 'sex-m').checked = true;
    game.dogSex = sex;
    $(game.modeName === 'infinito' ? 'mode-infinito' : 'mode-tempo').checked = true;

    function refreshBest() {
      const b = game.best || {};
      const parts = [];
      if (b.tempo) parts.push(`A tempo ${b.tempo.toLocaleString('it-IT')}`);
      if (b.infinito) parts.push(`Senza fine ${b.infinito.toLocaleString('it-IT')}`);
      $('best-line').textContent = parts.length ? `Record · ${parts.join(' · ')}` : '';
      $('best-line').hidden = !parts.length;
    }
    function startGame() {
      const mode = document.querySelector('input[name="mode"]:checked').value;
      const sx = document.querySelector('input[name="sex"]:checked').value;
      U.lsSet('oav.sex', sx);
      game.dogSex = sx;
      game.start(mode, $('dog-name').value);
    }
    function syncMute() {
      const m = game.sfx.muted;
      $('b-mute').setAttribute('aria-label', m ? 'Attiva audio' : 'Disattiva audio');
      $('mute-path').setAttribute('d', m
        ? 'M4 9h4l5-4v14l-5-4H4zM16 9l6 6M22 9l-6 6'
        : 'M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12');
    }
    syncMute();

    $('b-start').addEventListener('click', startGame);
    $('dog-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') startGame(); });
    $('b-pause').addEventListener('click', () => game.pause(true));
    $('b-resume').addEventListener('click', () => game.pause(false));
    $('b-quit').addEventListener('click', () => { game.state = 'menu'; game.newRound(true); ui.show('menu'); });
    $('b-again').addEventListener('click', startGame);
    $('b-menu').addEventListener('click', () => { game.state = 'menu'; game.newRound(true); ui.show('menu'); });
    $('b-mute').addEventListener('click', () => { game.sfx.init(); ui.toggleMute(); });

    // comandi touch
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (coarse) document.body.classList.add('is-touch');
    window.addEventListener('touchstart', () => document.body.classList.add('is-touch'), { once: true, passive: true });
    game.input.bindTouch($('t-left'), 'left');
    game.input.bindTouch($('t-right'), 'right');
    game.input.bindTouch($('t-jump'), 'jump');
    game.input.bindTouch($('t-bark'), 'bark');
    game.input.bindTouch($('t-sprint'), 'sprint');
    // sui telefoni la guida dei tasti è chiusa per lasciare spazio
    if (coarse || window.innerHeight < 640) $('howto').open = false;

    ui.show('menu');
    try {
      if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
        window.claude.hot.snapshot(() => ({ best: game.best, name: game.dogName }));
      }
    } catch (e) { /* aggiornamento a caldo non disponibile */ }
  }

  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(boot); else boot();
})();
