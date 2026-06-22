/* ============================================================
   script_historiaR.js  —  U.E. Olmedo
   ============================================================ */

/* ══════════════════════════════════════════
   1. CARRUSEL FACEBOOK
══════════════════════════════════════════ */
(function () {
  var active  = 0;
  var cards   = Array.from(document.querySelectorAll('.fb-card'));
  var total   = cards.length;
  var dotsEl  = document.getElementById('fbDots');
  var wrapper = document.getElementById('fbWrapper');

  for (var i = 0; i < total; i++) {
    (function(idx){
      var d = document.createElement('div');
      d.className = 'fb-dot' + (idx === 0 ? ' active' : '');
      d.addEventListener('click', function(){ active = idx; update(); });
      dotsEl.appendChild(d);
    })(i);
  }

  function getLayout() {
    var vw    = window.innerWidth;
    var cardW = Math.min(560, vw * 0.82);
    var sideW = Math.min(130, vw * 0.12);
    var gap   = Math.max(16, vw * 0.025);
    return { cardW: cardW, sideW: sideW, gap: gap, maxRot: 56, maxDist: 2 };
  }

  function update() {
    var L = getLayout();
    cards.forEach(function(card, i) {
      var offset = i - active;
      var abs    = Math.abs(offset);
      var sign   = offset > 0 ? 1 : offset < 0 ? -1 : 0;
      if (abs > L.maxDist) {
        card.style.opacity       = '0';
        card.style.pointerEvents = 'none';
        card.style.visibility    = 'hidden';
        return;
      }
      card.style.visibility = 'visible';
      var tx = 0;
      if (offset !== 0) {
        tx = sign * (L.cardW / 2 + L.gap + (abs - 1) * (L.sideW + L.gap) + L.sideW / 2);
      }
      var rotY    = sign * Math.min(abs * (L.maxRot / L.maxDist), L.maxRot);
      var scale   = abs === 0 ? 1 : Math.max(0.55, 1 - abs * 0.18);
      var opacity = abs === 0 ? 1 : Math.max(0.3,  1 - abs * 0.28);
      card.style.transform     = 'translateX(' + tx + 'px) rotateY(' + rotY + 'deg) scale(' + scale + ')';
      card.style.opacity       = opacity;
      card.style.zIndex        = total - abs;
      card.style.pointerEvents = abs > 1 ? 'none' : 'auto';
      card.style.width         = L.cardW + 'px';
      card.classList.toggle('fb-card--active', i === active);
    });
    document.querySelectorAll('.fb-dot').forEach(function(d, i){
      d.classList.toggle('active', i === active);
    });
    var cardH = 780;
    wrapper.style.height = '830px';
    cards.forEach(function(c){ c.style.height = cardH + 'px'; });
  }

  cards.forEach(function(card) {
    card.addEventListener('click', function(e) {
      var idx = parseInt(this.dataset.index);
      if (!isNaN(idx) && idx !== active) {
        e.preventDefault();
        active = idx;
        update();
      }
    });
  });

  document.getElementById('fbPrev').addEventListener('click', function(){
    active = Math.max(0, active - 1); update();
  });
  document.getElementById('fbNext').addEventListener('click', function(){
    active = Math.min(total - 1, active + 1); update();
  });

  var tx0 = 0;
  wrapper.addEventListener('touchstart', function(e){ tx0 = e.touches[0].clientX; }, { passive: true });
  wrapper.addEventListener('touchend', function(e){
    var dx = e.changedTouches[0].clientX - tx0;
    if      (dx >  50) { active = Math.max(0, active - 1);         update(); }
    else if (dx < -50) { active = Math.min(total - 1, active + 1); update(); }
  });

  window.addEventListener('resize', update);
  update();
})();


/* ══════════════════════════════════════════
   2. LIBRO — Historia reciente
══════════════════════════════════════════ */
(function () {

  const spreads  = Array.from(document.querySelectorAll('#historia-olmedo .spread'));
  const btnPrev  = document.getElementById('btnPrev');
  const btnNext  = document.getElementById('btnNext');
  const dotsWrap = document.getElementById('dots');
  const DUR      = 480;

  let current   = 0;
  let animating = false;

  /* ── Ocultar todos los spreads directamente por style (sin !important) ── */
  spreads.forEach(s => {
    s.style.position     = 'absolute';
    s.style.inset        = '0';
    s.style.display      = 'flex';
    s.style.opacity      = '0';
    s.style.visibility   = 'hidden';
    s.style.pointerEvents = 'none';
    s.style.transform    = 'translateX(0) scale(1)';
    s.style.transition   = `opacity ${DUR}ms cubic-bezier(0.4,0,0.2,1), transform ${DUR}ms cubic-bezier(0.4,0,0.2,1)`;
  });

  /* ── Mostrar el primero ── */
  show(spreads[0]);

  /* ── Dots ── */
  dotsWrap.innerHTML = '';
  spreads.forEach((_, i) => {
    const d = document.createElement('button');
    d.className = 'dot' + (i === 0 ? ' active' : '');
    d.setAttribute('aria-label', `Página ${i + 1}`);
    d.addEventListener('click', () => go(i));
    dotsWrap.appendChild(d);
  });

  updateUI();

  /* ── Botones ── */
  btnPrev.addEventListener('click', () => go(current - 1));
  btnNext.addEventListener('click', () => go(current + 1));

  /* ── Teclado ── */
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(current + 1);
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   go(current - 1);
  });

  /* ── Swipe ── */
  let tx0 = 0;
  const scene = document.getElementById('scene');
  scene.addEventListener('touchstart', e => { tx0 = e.changedTouches[0].clientX; }, { passive: true });
  scene.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tx0;
    if (Math.abs(dx) > 40) go(dx < 0 ? current + 1 : current - 1);
  }, { passive: true });

  /* ══════════════════════════════════════════
     NAVEGACIÓN
  ══════════════════════════════════════════ */
  function go(to) {
    if (animating || to === current || to < 0 || to >= spreads.length) return;
    animating = true;

    const dir = to > current ? 1 : -1;
    const out = spreads[current];
    const inn = spreads[to];

    /* Salida */
    out.style.transition = `opacity ${DUR}ms cubic-bezier(0.4,0,0.2,1), transform ${DUR}ms cubic-bezier(0.4,0,0.2,1)`;
    out.style.opacity    = '0';
    out.style.transform  = `translateX(${-30 * dir}px) scale(0.98)`;

    /* Entrada: posición inicial sin transición */
    inn.style.transition    = 'none';
    inn.style.visibility    = 'visible';
    inn.style.opacity       = '0';
    inn.style.transform     = `translateX(${30 * dir}px) scale(0.98)`;
    inn.style.pointerEvents = 'none';

    /* Doble rAF → reflow → animar */
    requestAnimationFrame(() => requestAnimationFrame(() => {
      inn.style.transition    = `opacity ${DUR}ms cubic-bezier(0.4,0,0.2,1), transform ${DUR}ms cubic-bezier(0.4,0,0.2,1)`;
      inn.style.opacity       = '1';
      inn.style.transform     = 'translateX(0) scale(1)';
      inn.style.pointerEvents = 'auto';
    }));

    setTimeout(() => {
      out.style.visibility    = 'hidden';
      out.style.pointerEvents = 'none';
      out.style.transform     = 'translateX(0) scale(1)';
      current   = to;
      animating = false;
      updateUI();
    }, DUR + 40);
  }

  function show(el) {
    el.style.opacity       = '1';
    el.style.visibility    = 'visible';
    el.style.transform     = 'translateX(0) scale(1)';
    el.style.pointerEvents = 'auto';
  }

  function updateUI() {
    btnPrev.disabled = current === 0;
    btnNext.disabled = current === spreads.length - 1;
    dotsWrap.querySelectorAll('.dot').forEach((d, i) =>
      d.classList.toggle('active', i === current)
    );
  }

})();