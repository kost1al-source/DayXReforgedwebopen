/* ============================================================
   DAY X REFORGED — main.js
   Vanilla JS only. No jQuery, no frameworks.

   SERVER_CONFIG holds the Minecraft server address used ONLY
   to query the public status API. It is never rendered into
   the page, so the address never appears in the UI.
   ============================================================ */
'use strict';

const SERVER_CONFIG = {
  host: 'x16.joinserver.xyz',
  port: '25577',
  apiUrl: 'https://api.mcsrvstat.us/3/',
  refreshMs: 45000,   // refresh server status every 45s
  timeoutMs: 8000     // abort request after 8s
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Header scroll state (compact mode) ---------- */
const header = document.getElementById('site-header');
const onScrollHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
window.addEventListener('scroll', onScrollHeader, { passive: true });
onScrollHeader();

/* ---------- Mobile menu ---------- */
const menuToggle = document.getElementById('menu-toggle');
const setMenu = (open) => {
  document.body.classList.toggle('menu-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
};
menuToggle.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
document.querySelectorAll('.mobile-nav a, .mobile-menu-foot a').forEach((a) => {
  a.addEventListener('click', () => setMenu(false));
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('menu-open')) setMenu(false);
});

/* ---------- Smooth scrolling (with fixed-header offset) ---------- */
document.querySelectorAll('a[href^="#"]:not(.skip-link)').forEach((link) => {
  link.addEventListener('click', (e) => {
    const id = link.getAttribute('href');
    if (!id || id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top: Math.max(top, 0), behavior: reduceMotion ? 'auto' : 'smooth' });
  });
});

/* ---------- Reveal on scroll ---------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.14, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

/* ---------- Subtle parallax (background-position) ---------- */
if (!reduceMotion) {
  document.querySelectorAll('[data-parallax]').forEach((el) => {
    const base = parseFloat(el.dataset.parallax) || 30;
    let ticking = false;
    const update = () => {
      const shift = Math.min(window.scrollY * 0.06, 16);
      el.style.backgroundPositionY = `${base + shift}%`;
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
  });
}

/* ============================================================
   SERVER STATUS
   States: loading / online / offline / unknown
   ============================================================ */
const statusEls = {
  headers: document.querySelectorAll('[data-header-status]'),
  big: document.querySelectorAll('[data-big-status]'),
  players: document.querySelectorAll('[data-players]'),
  notes: document.querySelectorAll('[data-player-note]'),
  updated: document.querySelectorAll('[data-updated]')
};

function updateStatusUI(state, players, updated) {
  const isOnline = state === 'online';
  const label = isOnline ? 'ONLINE'
    : state === 'offline' ? 'OFFLINE'
    : state === 'loading' ? 'CHECKING'
    : 'STATUS UNAVAILABLE';

  statusEls.headers.forEach((el) => { el.textContent = label; });
  statusEls.big.forEach((el) => {
    el.textContent = isOnline ? 'ONLINE'
      : state === 'offline' ? 'SERVER OFFLINE'
      : state === 'loading' ? 'CHECKING STATUS'
      : 'STATUS UNAVAILABLE';
  });
  statusEls.players.forEach((el) => { el.textContent = isOnline ? String(players) : '—'; });
  statusEls.notes.forEach((el) => {
    el.textContent = isOnline ? 'LIVE DATA'
      : state === 'offline' ? 'SERVER OFFLINE'
      : state === 'loading' ? 'CONNECTING...'
      : 'STATUS UNAVAILABLE';
  });
  statusEls.updated.forEach((el) => { el.textContent = updated; });

  document.querySelectorAll('.status-dot').forEach((dot) => {
    dot.classList.remove('loading', 'online', 'offline', 'unknown');
    dot.classList.add(state);
  });
}

async function updateServerStatus() {
  updateStatusUI('loading', 0, '—');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_CONFIG.timeoutMs);

  try {
    const url = `${SERVER_CONFIG.apiUrl}${SERVER_CONFIG.host}:${SERVER_CONFIG.port}`;
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const data = await res.json();
    if (!data || typeof data.online !== 'boolean') throw new Error('Invalid response');

    const players = Math.max(0, Number(data.players && data.players.online) || 0);
    const updated = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    updateStatusUI(data.online ? 'online' : 'offline', players, updated);
  } catch (err) {
    // network error / API error / timeout / invalid response -> STATUS UNAVAILABLE
    updateStatusUI('unknown', 0, '—');
  } finally {
    clearTimeout(timer);
  }
}

updateServerStatus();
setInterval(updateServerStatus, SERVER_CONFIG.refreshMs);
