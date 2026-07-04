/* ════════════════════════════════════════════════════════════
   De Saloncoureurs — gedeelde scripts (sc-animaties.js)
   Ticker, count-up, balkgroei, tab-wissel, peloton, countdown
   ════════════════════════════════════════════════════════════ */

/* ── Config ── */
const SC_FIRESTORE = 'https://firestore.googleapis.com/v1/projects/wtc-saloncoureurs/databases/(default)/documents';
const SC_SEIZOEN_DOEL = 40000;

/* Vaste ticker-items — hier handmatig bij te werken per editie */
const SC_TICKER_VAST_VOOR = [
  { tekst: 'KAS: −€30 (+€10 POT WOUT)', ster: true },
];
const SC_TICKER_VAST_NA = [
  { tekst: 'SUCCES MET DE TOUR-PRONO — DE TOUR START OP 4 JULI', ster: true },
];

/* ── Mobiel menu ── */
function toggleMenu() {
  document.getElementById('mobileMenu').classList.toggle('open');
}

/* ── Firestore stats ophalen (totaal km + leider) ── */
let _scStatsPromise = null;
function scHaalStats() {
  if (_scStatsPromise) return _scStatsPromise;
  _scStatsPromise = (async () => {
    try {
      const res = await fetch(`${SC_FIRESTORE}/stats?pageSize=50`);
      if (!res.ok) return null;
      const data = await res.json();
      const docs = data.documents || [];
      let totaal = 0, leider = null;
      docs.forEach(doc => {
        const f = doc.fields || {};
        const km = parseFloat(f.totalKm?.doubleValue || f.totalKm?.integerValue || 0);
        totaal += km;
        const naam = f.firstname?.stringValue || '';
        if (naam && (!leider || km > leider.km)) leider = { naam, km };
      });
      return { totaal, pct: Math.min((totaal / SC_SEIZOEN_DOEL) * 100, 100), leider };
    } catch (e) {
      console.warn('Stats konden niet geladen worden:', e);
      return null;
    }
  })();
  return _scStatsPromise;
}

/* ── Getalnotatie (nl-BE) ── */
function scFmt(v, dec = 0) {
  const p = Number(v).toFixed(dec).split('.');
  p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return dec > 0 ? p[0] + ',' + p[1] : p[0];
}

/* ── Nieuwsticker ── */
function scBouwTicker() {
  const host = document.getElementById('scTicker');
  if (!host) return;

  const render = (items) => {
    const groep = '<div class="sc-ticker-group">' + items.map(i =>
      `<span${i.ster ? ' class="hl"' : ''}>${i.ster ? '★ ' : ''}${i.tekst}</span>`
    ).join('') + '</div>';
    host.innerHTML = `<div class="sc-ticker-track">${groep}${groep}</div>`;
  };

  /* Direct: vaste items tonen */
  const basis = [...SC_TICKER_VAST_VOOR, ...SC_TICKER_VAST_NA];
  render(basis.length ? basis : [{ tekst: 'DE SALONCOUREURS — CLUBKRONIEK', ster: true }]);

  /* Daarna: verrijken met live Firestore-data */
  scHaalStats().then(s => {
    if (!s) return;
    const items = [...SC_TICKER_VAST_VOOR];
    items.push({ tekst: `${scFmt(Math.round(s.totaal))} KM GEREDEN — ${scFmt(s.pct, 1)}% VAN HET DOEL` });
    if (s.leider) {
      items.push({ tekst: `${s.leider.naam.toUpperCase()} AAN DE LEIDING MET ${scFmt(Math.round(s.leider.km))} KM`, ster: true });
    }
    items.push(...SC_TICKER_VAST_NA);
    render(items);
  });
}

/* ── Count-up tellers ──
   Gebruik: el.dataset.cu = eindwaarde, optioneel data-dec en data-suffix,
   daarna scRunCount(el). */
const _scEase = t => 1 - Math.pow(1 - t, 3);
function scRunCount(el) {
  const target = parseFloat(el.getAttribute('data-cu'));
  if (isNaN(target)) return;
  const dec = parseInt(el.getAttribute('data-dec') || '0', 10);
  const suffix = el.getAttribute('data-suffix') || '';
  const dur = 1200;
  let start = null;
  const step = (ts) => {
    if (start === null) start = ts;
    const t = Math.min(1, (ts - start) / dur);
    el.textContent = scFmt(target * _scEase(t), dec) + suffix;
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = scFmt(target, dec) + suffix;
  };
  requestAnimationFrame(step);
}

/* ── Balken die staggered uitgroeien ──
   Zet data-bar op elke fill (breedte via inline style). */
function scRunBars(container) {
  container.querySelectorAll('[data-bar]').forEach((b, i) => {
    b.style.transformOrigin = 'left';
    b.style.transition = 'none';
    b.style.transform = 'scaleX(0)';
    void b.offsetWidth; /* reflow forceren */
    b.style.transition = 'transform .95s cubic-bezier(.18,.7,.2,1) ' + (i * 0.07) + 's';
    b.style.transform = 'scaleX(1)';
  });
}

/* ── Zachte tab-wissel (fade + rise) ── */
function scSwap(cur, next, callback) {
  if (cur === next) return;
  cur.style.transition = 'opacity .45s ease, transform .45s ease';
  cur.style.opacity = '0';
  cur.style.transform = 'translateY(12px) scale(.99)';
  setTimeout(() => {
    cur.classList.remove('active');
    cur.style.opacity = '';
    cur.style.transform = '';
    cur.style.transition = '';
    next.classList.add('active');
    next.style.opacity = '0';
    next.style.transform = 'translateY(12px)';
    next.style.transition = 'opacity .45s ease, transform .45s cubic-bezier(.2,.8,.2,1)';
    void next.offsetWidth;
    next.style.opacity = '1';
    next.style.transform = 'none';
    setTimeout(() => {
      next.style.opacity = '';
      next.style.transform = '';
      next.style.transition = '';
    }, 500);
    if (callback) callback(next);
  }, 320);
}

/* ── Peloton op een voortgangsbalk ──
   wrap = element met class sc-peloton-wrap dat drie .sc-rider kinderen bevat,
   pct = voortgang in %. */
function scPeloton(wrap, pct) {
  if (!wrap) return;
  const r1 = wrap.querySelector('.sc-rider.r1');
  const r2 = wrap.querySelector('.sc-rider.r2');
  const r3 = wrap.querySelector('.sc-rider.r3');
  if (!r1) return;
  const clamp = v => Math.max(0, Math.min(100, v));
  setTimeout(() => {
    r1.style.opacity = '1';  r1.style.left = clamp(pct) + '%';
    r1.style.animation = 'scRiderBob 1.6s ease-in-out infinite 1.1s';
    if (r2) {
      r2.style.opacity = '.55'; r2.style.left = clamp(pct - 4) + '%';
      r2.style.animation = 'scRiderBob 1.8s ease-in-out infinite 1.4s';
    }
    if (r3) {
      r3.style.opacity = '.35'; r3.style.left = clamp(pct - 7.5) + '%';
      r3.style.animation = 'scRiderBob 2s ease-in-out infinite 1.6s';
    }
  }, 120);
}

/* ── Live countdown ──
   el = doel-element, target = Date. Optionele doneTekst bij 0. */
function scCountdown(el, target, doneTekst) {
  if (!el || !target) return;
  function tick() {
    let s = Math.max(0, Math.floor((target - Date.now()) / 1000));
    if (s === 0 && doneTekst) { el.textContent = doneTekst; return; }
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600);  s -= h * 3600;
    const m = Math.floor(s / 60);    const sec = s - m * 60;
    el.textContent = d + 'd ' + h + 'u ' + m + 'm ' + String(sec).padStart(2, '0') + 's';
  }
  tick();
  setInterval(tick, 1000);
}

/* ── Auto-init ── */
document.addEventListener('DOMContentLoaded', scBouwTicker);
