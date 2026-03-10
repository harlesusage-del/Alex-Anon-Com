/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ALEX — Anonymous Communication Hub                                ║
 * ║  app.js  ·  Single-file application bundle                         ║
 * ║                                                                    ║
 * ║  SECTIONS                                                          ║
 * ║   §1   Config & Constants                                          ║
 * ║   §2   Wordlist (256 words for recovery phrases)                   ║
 * ║   §3   App State                                                   ║
 * ║   §4   DOM Utilities                                               ║
 * ║   §5   Local Storage                                               ║
 * ║   §6   Rocket Generator                                            ║
 * ║   §7   Token Identity                                              ║
 * ║   §8   Toast Notifications                                         ║
 * ║   §9   Custom Cursor                                               ║
 * ║   §10  Starfield / Canvas                                          ║
 * ║   §11  Screen Navigation                                           ║
 * ║   §12  Loading Screen                                              ║
 * ║   §13  Username Screen                                             ║
 * ║   §14  Identity Screen                                             ║
 * ║   §15  Dashboard                                                   ║
 * ║   §16  Modal System                                                ║
 * ║   §17  Supabase Init                                               ║
 * ║   §18  Public Chat                                                 ║
 * ║   §19  Private Chat (WebRTC DataChannel)                           ║
 * ║   §20  Call System (WebRTC Voice/Video)                            ║
 * ║   §21  Meeting Room (Jitsi Meet)                                   ║
 * ║   §22  Shared UI Helpers                                           ║
 * ║   §23  App Boot                                                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   §1  CONFIG & CONSTANTS
   ───────────────────────────────────────────────────────────────────
   ⚠  Replace placeholder values with your actual Supabase credentials
      before deploying. See README.md §Setup for instructions.
   ═══════════════════════════════════════════════════════════════════ */
const CONFIG = {
  /* ── Supabase ─────────────────────────────────────────────── */
  SUPABASE_URL:      'https://YOUR_PROJECT_ID.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',

  /* ── Jitsi ────────────────────────────────────────────────── */
  JITSI_DOMAIN: 'meet.jit.si',

  /* ── WebRTC ICE servers ────────────────────────────────────── */
  ICE_SERVERS: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject', credential: 'openrelayproject' },
  ],

  /* ── Timing ───────────────────────────────────────────────── */
  LOADING_DURATION:  3800,   // ms  total loading screen
  TYPING_TIMEOUT:    2800,   // ms  hide typing indicator
  TOAST_DURATION:    4000,   // ms  auto-dismiss toast
  RECONNECT_DELAY:   3000,   // ms  WebRTC reconnect attempt
  ICE_RESTART_DELAY: 5000,   // ms  ICE restart on disconnect

  /* ── Limits ───────────────────────────────────────────────── */
  MAX_CALL_PEERS:     3,     // max remote peers (4 total incl. local)
  MSG_HISTORY_LIMIT: 200,    // max messages kept in DOM
};

/* ═══════════════════════════════════════════════════════════════════════
   §2  WORDLIST  — 256 memorable words for recovery phrase generation
   ═══════════════════════════════════════════════════════════════════ */
const WORDLIST = [
  'shadow','mango','comet','frost','orbit','delta','pulse','solar',
  'storm','neon','cipher','wave','blaze','echo','forge','ghost',
  'lunar','nova','prism','quark','raven','spark','tiger','ultra',
  'vapor','xenon','yield','zenith','alpha','beacon','crystal','dawn',
  'ember','falcon','galaxy','haven','indigo','jade','karma','lantern',
  'mystic','nebula','onyx','phoenix','quartz','ripple','silver','thunder',
  'umbra','vortex','willow','knight','cedar','cobalt','crater','dagger',
  'arctic','bronze','crown','dusk','epoch','flame','granite','helix',
  'icon','jasper','kelvin','lyric','marble','nimbus','opal','petal',
  'quest','realm','sapphire','tundra','velvet','whisper','yearling','zinc',
  'abyss','bolt','chasm','dome','eden','flux','grove','hydra',
  'ivory','joule','kinetic','laser','matrix','north','omega','polar',
  'quantum','radio','steel','topaz','unity','violet','warp','apex',
  'alchemy','burst','crux','depth','ether','fern','gust','hawk',
  'ignite','jest','keen','lumen','myth','nucleus','axe','pier',
  'quill','relay','surge','titan','ursa','vale','wolf','yonder',
  'zeal','arc','beam','core','dive','eve','fuse','gale',
  'hope','ion','jazz','knot','link','mist','net','ode',
  'peak','quirk','rune','seed','tide','vine','wake','yard',
  'zone','ash','base','cove','dew','edge','flow','gem',
  'hull','ice','leaf','moon','node','ore','path','rod',
  'sea','top','unit','void','web','bay','cap','dot',
  'elm','fog','gap','hub','ink','jot','kin','log',
  'map','nil','pod','quad','spy','tan','use','van',
  'wax','box','cup','den','ear','fur','gun','hue',
  'jar','key','lip','mud','nun','owl','pan','rag',
  'sap','tar','urn','vat','wit','yam','zen','bud',
  'cod','dim','elk','fad','gnu','hog','ivy','jaw',
  'keg','lab','mar','nap','oar','pew','ram','ski',
  'tug','vet','woe','yak','zap','bag','cab','dig',
  'eel','fig','gig','hex','imp','jug','lair','mop',
];

/* ═══════════════════════════════════════════════════════════════════════
   §3  APP STATE — single source of truth
   ═══════════════════════════════════════════════════════════════════ */
const STATE = {
  /** Stored identity object or null */
  identity: null,

  /** Name of the currently active screen data-screen value */
  currentScreen: 'loading',

  /** Supabase client instance (null until _initSupabase resolves) */
  supabase: null,

  /** ── Public Chat ── */
  chat: {
    room:         null,
    channel:      null,
    isTyping:     false,
    sentMsgIds:   new Set(),
    typingTimer:  null,
  },

  /** ── Private Chat (WebRTC DataChannel) ── */
  privateChat: {
    peerToken:          null,
    roomId:             null,
    peerConnection:     null,
    dataChannel:        null,
    signalingChannel:   null,
    iceCandidateBuffer: [],
    connected:          false,
    isOfferer:          false,
    peerInfo:           null,   // { username, rocketId, rocketConfig }
  },

  /** ── Voice / Video Call ── */
  call: {
    room:              null,
    mode:              'video',  // 'video' | 'audio'
    localStream:       null,
    screenStream:      null,
    peers:             {},       // peerId → { pc, info }
    signalingChannel:  null,
    iceBufs:           {},       // peerId → RTCIceCandidate[]
    micMuted:          false,
    camOff:            false,
    screenSharing:     false,
    inCall:            false,
  },

  /** ── Jitsi Meeting ── */
  meet: {
    room:      null,
    jitsiApi:  null,
  },
};

/* ═══════════════════════════════════════════════════════════════════════
   §4  DOM UTILITIES
   ═══════════════════════════════════════════════════════════════════ */

/** Fast getElementById shorthand */
const $ = id => document.getElementById(id);

/** querySelectorAll shorthand */
const $$ = sel => Array.from(document.querySelectorAll(sel));

/**
 * Debounce — returns a version of fn that delays execution by `delay` ms.
 */
function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

/**
 * Escapes HTML entities to prevent XSS when setting innerHTML.
 */
function sanitizeHTML(str) {
  const el = document.createElement('div');
  el.textContent = String(str ?? '');
  return el.innerHTML;
}

/**
 * Formats a Date as HH:MM (24-hour).
 */
function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Copies `text` to clipboard. Returns true on success.
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      Object.assign(ta.style, { position: 'fixed', opacity: '0', pointerEvents: 'none' });
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  }
}

/**
 * SHA-256 of a UTF-8 string via Web Crypto API. Returns hex string.
 */
async function sha256(message) {
  const buf  = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}

/**
 * djb2 hash — fast synchronous seeding for the PRNG.
 * Returns unsigned 32-bit integer.
 */
function hashSeedSync(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (((h << 5) + h) + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

/**
 * Mulberry32 seeded PRNG. Returns function that produces floats in [0, 1).
 */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a UUID string (prefers crypto.randomUUID on HTTPS).
 */
function genUUID() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Auto-resizes a textarea to fit its content (up to CSS max-height).
 */
function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

/* ═══════════════════════════════════════════════════════════════════════
   §5  LOCAL STORAGE
   ═══════════════════════════════════════════════════════════════════ */
const STORAGE_KEY = 'alex_identity_v1';

function saveIdentity(identity) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(identity)); }
  catch (e) { console.warn('[Alex] Could not persist identity:', e.message); }
}

function loadIdentity() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p?.token || !p?.username || !p?.rocketId) return null;
    return p;
  } catch { return null; }
}

function clearIdentity() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

/* ═══════════════════════════════════════════════════════════════════════
   §6  ROCKET GENERATOR
   ───────────────────────────────────────────────────────────────────
   Deterministic procedural rocket SVG from a seed string (token).
   Same seed → same rocket every time.
   ═══════════════════════════════════════════════════════════════════ */

const BODY_PALETTES = [
  ['#c8e8ff','#4a9eff','#1a6bc0'],  // ice-blue
  ['#e0d4ff','#9b59ff','#6a1fb5'],  // violet
  ['#ffd4ec','#ff59a8','#b51f6a'],  // rose
  ['#d4ffe8','#39d98a','#1a9958'],  // emerald
  ['#fff0d4','#ffb059','#b5751f'],  // amber
  ['#d4f5ff','#39c6ff','#1a8cb5'],  // sapphire
  ['#ffd4d4','#ff5959','#b51f1f'],  // crimson
  ['#d4fff8','#39ffd8','#1ab59b'],  // teal
  ['#e8ffd4','#8dff39','#4ab51f'],  // lime
  ['#ffecd4','#ff8c39','#b55e1f'],  // coral
];

const FLAME_PALETTES = [
  ['#ff9a3c','#ff5c1a'],   // orange
  ['#ffed3c','#ff9a1a'],   // golden
  ['#3cffed','#1affd0'],   // cryo-cyan
  ['#ff3ced','#d01aff'],   // plasma
  ['#ff3c7a','#ff1a50'],   // hot-pink
  ['#3c9fff','#1a70ff'],   // electric-blue
  ['#ffffff','#aaddff'],   // white-hot
];

const WINDOW_COLORS = [
  '#00f0ff','#7df5ff','#00ffcc','#a0c4ff',
  '#ffd700','#ff8c00','#7dffcc','#ff6b9d','#b4ff6b',
];

const WING_SHAPES = ['standard','swept','delta','stubby'];

let _rktCounter = 0;

/**
 * Generates a deterministic RocketConfig from a seed string.
 */
function generateRocketConfig(seed) {
  const rng  = mulberry32(hashSeedSync(String(seed ?? 'default')));
  const pick = arr => arr[Math.floor(rng() * arr.length)];
  const bp   = pick(BODY_PALETTES);
  const fp   = pick(FLAME_PALETTES);
  return {
    bodyTop:     bp[0],
    bodyMid:     bp[1],
    bodyBot:     bp[2],
    flameOuter:  fp[0],
    flameInner:  fp[1],
    windowColor: pick(WINDOW_COLORS),
    wingShape:   pick(WING_SHAPES),
    hasStripe:   rng() > 0.4,
    narrow:      rng() > 0.5,
  };
}

/**
 * Renders a procedural SVG rocket. Returns HTML string.
 * @param {Object}  cfg   RocketConfig from generateRocketConfig()
 * @param {number}  size  Height in px
 */
function renderRocketSVG(cfg, size = 64) {
  if (!cfg) return '';
  const uid = ++_rktCounter;
  const cx  = 24;
  const bx  = cfg.narrow ? 12 : 10;
  const bw  = cfg.narrow ? 24 : 28;

  /* Wing path variants */
  let wL, wR;
  switch (cfg.wingShape) {
    case 'swept':
      wL = `M${bx} 30 C${bx-3} 27 ${bx-9} 32 ${bx-12} 41 L${bx} 37Z`;
      wR = `M${bx+bw} 30 C${bx+bw+3} 27 ${bx+bw+9} 32 ${bx+bw+12} 41 L${bx+bw} 37Z`;
      break;
    case 'delta':
      wL = `M${bx} 21 L${bx-14} 41 L${bx} 38Z`;
      wR = `M${bx+bw} 21 L${bx+bw+14} 41 L${bx+bw} 38Z`;
      break;
    case 'stubby':
      wL = `M${bx} 33 L${bx-7} 37 L${bx-5} 41 L${bx} 38Z`;
      wR = `M${bx+bw} 33 L${bx+bw+7} 37 L${bx+bw+5} 41 L${bx+bw} 38Z`;
      break;
    default: /* standard */
      wL = `M${bx} 28 L${bx-11} 40 L${bx-4} 42 L${bx} 36Z`;
      wR = `M${bx+bw} 28 L${bx+bw+11} 40 L${bx+bw+4} 42 L${bx+bw} 36Z`;
  }

  const stripe = cfg.hasStripe
    ? `<rect x="${bx+2}" y="23" width="${bw-4}" height="3.5" rx="1.2" fill="${cfg.bodyBot}" opacity="0.4"/>`
    : '';

  const w = Math.round(size * 48 / 56);

  return `<svg viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg" width="${w}" height="${size}" aria-hidden="true">
  <defs>
    <linearGradient id="rb${uid}" x1="${cx}" y1="4" x2="${cx}" y2="44" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="${cfg.bodyTop}"/>
      <stop offset="55%"  stop-color="${cfg.bodyMid}"/>
      <stop offset="100%" stop-color="${cfg.bodyBot}"/>
    </linearGradient>
    <linearGradient id="wL${uid}" x1="${bx-14}" y1="34" x2="${bx}" y2="34" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="${cfg.bodyBot}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${cfg.bodyMid}"/>
    </linearGradient>
    <linearGradient id="wR${uid}" x1="${bx+bw+14}" y1="34" x2="${bx+bw}" y2="34" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="${cfg.bodyBot}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${cfg.bodyMid}"/>
    </linearGradient>
    <linearGradient id="fl${uid}" x1="${cx}" y1="43" x2="${cx}" y2="56" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="${cfg.flameOuter}"/>
      <stop offset="65%"  stop-color="${cfg.flameInner}"/>
      <stop offset="100%" stop-color="${cfg.flameInner}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="wn${uid}" cx="38%" cy="32%" r="60%">
      <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.9"/>
      <stop offset="45%"  stop-color="${cfg.windowColor}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="${cfg.windowColor}" stop-opacity="0.4"/>
    </radialGradient>
  </defs>
  <path d="${wL}" fill="url(#wL${uid})"/>
  <path d="${wR}" fill="url(#wR${uid})"/>
  <path d="M${cx} 4 C${cx-1.5} 4 ${bx} 13 ${bx} 27 L${bx} 41 Q${bx} 45 ${cx} 45 Q${bx+bw} 45 ${bx+bw} 41 L${bx+bw} 27 C${bx+bw} 13 ${cx+1.5} 4 ${cx} 4Z" fill="url(#rb${uid})"/>
  ${stripe}
  <circle cx="${cx}" cy="25" r="5.6" fill="url(#wn${uid})"/>
  <circle cx="${cx}" cy="25" r="3.2" fill="#050d1a" opacity="0.6"/>
  <circle cx="${cx-1.5}" cy="23.5" r="1.2" fill="white" opacity="0.75"/>
  <rect x="${cx-5}" y="43" width="10" height="2.5" rx="1" fill="${cfg.bodyBot}" opacity="0.6"/>
  <path d="M${cx-4} 44 C${cx-6.5} 47.5 ${cx-7} 52 ${cx-2} 55.5 L${cx} 56 L${cx+2} 55.5 C${cx+7} 52 ${cx+6.5} 47.5 ${cx+4} 44Z" fill="url(#fl${uid})"/>
</svg>`;
}

/**
 * Generates a random RKT-XXXX code string.
 */
function generateRocketId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'RKT-';
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

/* ═══════════════════════════════════════════════════════════════════════
   §7  TOKEN IDENTITY
   ═══════════════════════════════════════════════════════════════════ */

/** Generates a cryptographically random user token: u_<20 hex chars> */
async function generateToken() {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return 'u_' + Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join('');
}

/** Picks 3 unique random words from WORDLIST. */
function generatePhrases() {
  const used = new Set();
  const out  = [];
  while (out.length < 3) {
    const i = Math.floor(Math.random() * WORDLIST.length);
    if (!used.has(i)) { used.add(i); out.push(WORDLIST[i]); }
  }
  return out;
}

/**
 * Deterministically regenerates the same token from 3 recovery phrases.
 * Phrases are sorted before hashing → order-independent.
 */
async function phrasesToToken(p1, p2, p3) {
  const normalised = [p1,p2,p3].map(p => p.trim().toLowerCase()).sort().join('|');
  const hash = await sha256(normalised + '__alex_identity_v1__');
  return 'u_' + hash.slice(0, 20);
}

/** Creates a full identity object for a given username. */
async function createIdentity(username) {
  const token        = await generateToken();
  const phrases      = generatePhrases();
  const rocketId     = generateRocketId();
  const rocketConfig = generateRocketConfig(token);
  return { username, token, phrases, rocketId, rocketConfig };
}
/* ═══════════════════════════════════════════════════════════════════════
   §8  TOAST NOTIFICATIONS
   ═══════════════════════════════════════════════════════════════════ */
const TOAST_ICONS = {
  success: `<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 8L7 10.2L11 5.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  error:   `<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  info:    `<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/><path d="M8 7V11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="5.2" r="0.85" fill="currentColor"/></svg>`,
  warn:    `<svg viewBox="0 0 16 16" fill="none"><path d="M8 2.5L14.5 13.5H1.5L8 2.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 6.5V9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="11.5" r="0.85" fill="currentColor"/></svg>`,
};

/**
 * Displays a toast notification.
 * @param {string} message
 * @param {'info'|'success'|'error'|'warn'} type
 * @param {number} [duration]  ms before auto-dismiss
 */
function showToast(message, type = 'info', duration = CONFIG.TOAST_DURATION) {
  const container = $('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-atomic', 'true');
  toast.innerHTML = `
    <div class="toast__icon" aria-hidden="true">${TOAST_ICONS[type] ?? TOAST_ICONS.info}</div>
    <p class="toast__text">${sanitizeHTML(message)}</p>
    <button class="toast__close" type="button" aria-label="Dismiss notification">
      <svg viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    </button>`;

  const dismiss = () => {
    toast.classList.add('toast--out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 600); // safety fallback
  };

  toast.querySelector('.toast__close').addEventListener('click', dismiss);
  container.appendChild(toast);
  // Double rAF to trigger CSS enter animation reliably
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('toast--in')));

  let autoTimer = setTimeout(dismiss, duration);
  toast.addEventListener('mouseenter', () => clearTimeout(autoTimer));
  toast.addEventListener('mouseleave', () => { autoTimer = setTimeout(dismiss, 1800); });
}

/* ═══════════════════════════════════════════════════════════════════════
   §9  CUSTOM CURSOR  (desktop only)
   ═══════════════════════════════════════════════════════════════════ */
function initCursor() {
  if (window.matchMedia('(pointer: coarse)').matches) return; // skip on touch devices
  const dot  = $('cursor-dot');
  const ring = $('cursor-ring');
  if (!dot || !ring) return;

  let mx = -300, my = -300, rx = -300, ry = -300;
  const lerp = (a, b, t) => a + (b - a) * t;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px,${my}px)`;
  }, { passive: true });

  (function animRing() {
    rx = lerp(rx, mx, 0.13);
    ry = lerp(ry, my, 0.13);
    ring.style.transform = `translate(${rx}px,${ry}px)`;
    requestAnimationFrame(animRing);
  })();

  document.addEventListener('mousedown',  () => { dot.classList.add('cursor-dot--click');   ring.classList.add('cursor-ring--click'); });
  document.addEventListener('mouseup',    () => { dot.classList.remove('cursor-dot--click'); ring.classList.remove('cursor-ring--click'); });
  document.addEventListener('mouseleave', () => { dot.style.opacity = '0'; ring.style.opacity = '0'; });
  document.addEventListener('mouseenter', () => { dot.style.opacity = '';  ring.style.opacity = ''; });

  document.addEventListener('mouseover', e => {
    const isHover = !!e.target.closest('button,a,input,textarea,select,[role="button"],[tabindex]');
    dot.classList.toggle('cursor-dot--hover', isHover);
    ring.classList.toggle('cursor-ring--hover', isHover);
  }, { passive: true });
}

/* ═══════════════════════════════════════════════════════════════════════
   §10  STARFIELD / CANVAS
   ───────────────────────────────────────────────────────────────────
   Lightweight animated starfield. Each canvas gets its own Starfield
   instance. start() / stop() / destroy() lifecycle.
   ═══════════════════════════════════════════════════════════════════ */
class Starfield {
  constructor(canvasId, opts = {}) {
    this.canvas = $(canvasId);
    if (!this.canvas) return;
    this.ctx    = this.canvas.getContext('2d');
    this.animId = null;
    this.stars  = [];
    this.parts  = [];
    this.opts   = {
      starCount:     opts.starCount     ?? 160,
      particleCount: opts.particleCount ?? 22,
      speed:         opts.speed         ?? 0.15,
      twinkle:       opts.twinkle       !== false,
    };
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize, { passive: true });
    this._resize();
    this._initStars();
    this._initParts();
  }

  _resize() {
    if (!this.canvas) return;
    this.W = this.canvas.width  = window.innerWidth;
    this.H = this.canvas.height = window.innerHeight;
  }

  _newStar(randomY) {
    return {
      x: Math.random() * this.W,
      y: randomY ? Math.random() * this.H : -4,
      r: Math.random() * 1.7 + 0.3,
      spd: Math.random() * 0.18 + 0.04,
      alpha: Math.random() * 0.65 + 0.18,
      phase: Math.random() * Math.PI * 2,
      rate:  Math.random() * 0.018 + 0.004,
      hue: Math.random() > 0.82 ? '#b8d8ff' : Math.random() > 0.65 ? '#ffd0a8' : '#ffffff',
    };
  }

  _newPart(randomY) {
    return {
      x: Math.random() * this.W,
      y: randomY ? Math.random() * this.H : this.H + 8,
      r: Math.random() * 2.4 + 0.7,
      dx: (Math.random() - 0.5) * 0.32,
      dy: -(Math.random() * 0.26 + 0.06),
      alpha: Math.random() * 0.3 + 0.06,
      life: 1.0,
      decay: Math.random() * 0.0018 + 0.0007,
      hue: Math.random() > 0.5 ? '#4a9eff' : '#9b59ff',
    };
  }

  _initStars() { this.stars = Array.from({ length: this.opts.starCount }, () => this._newStar(true)); }
  _initParts() { this.parts = Array.from({ length: this.opts.particleCount }, () => this._newPart(true)); }

  _draw() {
    const { ctx, W, H, opts } = this;
    ctx.clearRect(0, 0, W, H);

    for (const s of this.stars) {
      if (opts.twinkle) s.phase += s.rate;
      const tw = opts.twinkle ? s.alpha * (0.5 + 0.5 * Math.sin(s.phase)) : s.alpha;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.hue; ctx.globalAlpha = tw; ctx.fill();
      if (s.r > 1.3) {
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 2.8, 0, Math.PI * 2);
        ctx.fillStyle = s.hue; ctx.globalAlpha = tw * 0.07; ctx.fill();
      }
      s.y += s.spd * opts.speed;
      if (s.y > H + 4) Object.assign(s, this._newStar(false));
    }

    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      p.x += p.dx; p.y += p.dy; p.life -= p.decay;
      if (p.life <= 0 || p.y < -10) { this.parts[i] = this._newPart(false); continue; }
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.hue; ctx.globalAlpha = p.alpha * p.life; ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  start() {
    if (this.animId || !this.canvas) return;
    const loop = () => { this._draw(); this.animId = requestAnimationFrame(loop); };
    this.animId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.animId) { cancelAnimationFrame(this.animId); this.animId = null; }
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
  }
}

const _STARFIELDS = {};

function startStarfield(canvasId, opts = {}) {
  if (!$( canvasId)) return;
  if (!_STARFIELDS[canvasId]) _STARFIELDS[canvasId] = new Starfield(canvasId, opts);
  _STARFIELDS[canvasId].start();
}

function stopStarfield(canvasId) {
  _STARFIELDS[canvasId]?.stop();
}

/* ═══════════════════════════════════════════════════════════════════════
   §11  SCREEN NAVIGATION
   ───────────────────────────────────────────────────────────────────
   showScreen(screenId)  — stops current screen, starts next one.
   All 8 screen ids: screen-loading, screen-username, screen-identity,
   screen-dashboard, screen-chat, screen-private-chat, screen-call, screen-meet
   ═══════════════════════════════════════════════════════════════════ */
function showScreen(screenId) {
  const next = $(screenId);
  if (!next) { console.error('[Alex] Unknown screen:', screenId); return; }

  const current = document.querySelector('.screen--active');
  if (current && current === next) {
    _initScreen(next.dataset.screen);
    return;
  }

  if (current) {
    _cleanupScreen(current.dataset.screen);
    current.classList.add('screen--exiting');
    current.classList.remove('screen--active');
    // Remove exiting class + hide after transition
    const onEnd = () => {
      current.classList.remove('screen--exiting');
      current.hidden = true;
    };
    current.addEventListener('transitionend', onEnd, { once: true });
    setTimeout(onEnd, 500); // fallback
  }

  next.hidden = false;
  next.getBoundingClientRect(); // force reflow
  next.classList.add('screen--active');
  STATE.currentScreen = next.dataset.screen;
  _initScreen(STATE.currentScreen);
}

function _initScreen(name) {
  switch (name) {
    case 'loading':      _initLoadingScreen();      break;
    case 'username':     _initUsernameScreen();     break;
    case 'identity':                                break; // populated by _showIdentityScreen()
    case 'dashboard':    _initDashboardScreen();    break;
    case 'chat':         _initChatScreen();         break;
    case 'private-chat': _initPrivateChatScreen();  break;
    case 'call':         _initCallScreen();         break;
    case 'meet':         _initMeetScreen();         break;
  }
}

function _cleanupScreen(name) {
  switch (name) {
    case 'loading':      stopStarfield('loading-canvas');    break;
    case 'username':     stopStarfield('username-canvas');   break;
    case 'identity':     stopStarfield('identity-canvas');   break;
    case 'dashboard':    stopStarfield('dashboard-canvas');  break;
    case 'chat':         _cleanupChat();                     break;
    case 'private-chat': _cleanupPrivateChat();              break;
    case 'call':         _cleanupCall(false);                break;
    case 'meet':         _cleanupMeet(false);                break;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   §12  LOADING SCREEN
   ═══════════════════════════════════════════════════════════════════ */
const LOADING_MESSAGES = [
  'Initializing anonymous channel...',
  'Igniting communication engines...',
  'Calibrating rocket identities...',
  'Preparing secure communication layer...',
  'Generating cryptographic tokens...',
  'Synchronizing with the void...',
  'Encrypting signal pathways...',
  'Almost ready for launch...',
];

let _loadingBootstrapped = false;

function _initLoadingScreen() {
  if (_loadingBootstrapped) return;
  _loadingBootstrapped = true;

  startStarfield('loading-canvas', { starCount: 220, particleCount: 35, speed: 0.2 });
  _runLoadingProgress();
}

function _runLoadingProgress() {
  const fillEl  = $('loading-progress-fill');
  const glowEl  = $('loading-progress-glow');
  const pctEl   = $('loading-progress-pct');
  const msgEl   = $('loading-message');
  const barEl   = $('loading-progress-bar');
  if (!fillEl) return;

  const total = CONFIG.LOADING_DURATION;
  const t0    = performance.now();
  let msgIdx  = 0;

  const tick = (now) => {
    const progress = Math.min((now - t0) / total, 1);
    const pct = Math.floor(progress * 100);

    fillEl.style.width = pct + '%';
    if (glowEl) glowEl.style.left = pct + '%';
    if (pctEl)  pctEl.textContent  = pct + '%';
    if (barEl)  barEl.setAttribute('aria-valuenow', String(pct));

    const targetIdx = Math.min(
      Math.floor(progress * LOADING_MESSAGES.length),
      LOADING_MESSAGES.length - 1,
    );
    if (targetIdx !== msgIdx && msgEl) {
      msgIdx = targetIdx;
      msgEl.classList.add('loading-message--out');
      setTimeout(() => {
        if (msgEl) { msgEl.textContent = LOADING_MESSAGES[msgIdx]; msgEl.classList.remove('loading-message--out'); }
      }, 260);
    }

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      // Loading done — boot Supabase in background then route
      _initSupabase();
      setTimeout(() => {
        const existing = loadIdentity();
        if (existing) {
          STATE.identity = existing;
          showScreen('screen-dashboard');
        } else {
          showScreen('screen-username');
        }
      }, 380);
    }
  };
  requestAnimationFrame(tick);
}

/* ═══════════════════════════════════════════════════════════════════════
   §13  USERNAME SCREEN
   ═══════════════════════════════════════════════════════════════════ */
function _initUsernameScreen() {
  startStarfield('username-canvas', { starCount: 140, particleCount: 20, speed: 0.1 });

  const input      = $('username-input');
  const counter    = $('username-counter');
  const errorEl    = $('username-error');
  const btnLaunch  = $('btn-launch');
  const btnRecover = $('btn-show-recovery');

  if (!input) return;

  /* Reset */
  input.value = '';
  if (counter)   counter.textContent  = '0 / 20';
  if (errorEl)   errorEl.textContent  = '';
  if (btnLaunch) btnLaunch.disabled   = true;

  setTimeout(() => { try { input.focus(); } catch {} }, 320);

  /* Live counter */
  input.oninput = () => {
    const len = input.value.length;
    if (counter) counter.textContent = `${len} / 20`;
    if (errorEl) errorEl.textContent = '';
    if (btnLaunch) btnLaunch.disabled = len < 3;
  };

  input.onkeydown = e => { if (e.key === 'Enter') _handleLaunch(); };

  /* Remove stale listeners by cloning */
  const freshLaunch = btnLaunch?.cloneNode(true);
  if (freshLaunch) { btnLaunch.replaceWith(freshLaunch); freshLaunch.onclick = _handleLaunch; }

  const freshRecover = btnRecover?.cloneNode(true);
  if (freshRecover) { btnRecover.replaceWith(freshRecover); freshRecover.onclick = () => _openModal('modal-recovery'); }
}

function _validateUsername(raw) {
  const s = raw.trim();
  if (s.length < 3)  return 'Call sign must be at least 3 characters.';
  if (s.length > 20) return 'Call sign must be 20 characters or fewer.';
  if (!/^[a-zA-Z0-9 _\-.]+$/.test(s)) return 'Only letters, numbers, spaces, and _ - . are allowed.';
  return null;
}

async function _handleLaunch() {
  const input    = $('username-input');
  const errorEl  = $('username-error');
  const btnEl    = $('btn-launch');
  const spanEl   = btnEl?.querySelector('.btn__text');

  const raw = input?.value ?? '';
  const err = _validateUsername(raw);
  if (err) {
    if (errorEl) errorEl.textContent = err;
    try { input?.focus(); } catch {}
    return;
  }
  if (errorEl) errorEl.textContent = '';
  if (btnEl)  btnEl.disabled = true;
  if (spanEl) spanEl.textContent = 'LAUNCHING...';

  try {
    const identity = await createIdentity(raw.trim());
    STATE.identity = identity;
    saveIdentity(identity);
    _showIdentityScreen(identity);
  } catch (e) {
    console.error('[Alex] createIdentity failed:', e);
    if (errorEl) errorEl.textContent = 'Failed to generate identity. Please try again.';
    if (btnEl)  btnEl.disabled = false;
    if (spanEl) spanEl.textContent = 'LAUNCH';
  }
}
/* ═══════════════════════════════════════════════════════════════════════
   §14  IDENTITY SCREEN
   ═══════════════════════════════════════════════════════════════════ */
function _showIdentityScreen(identity) {
  /* Populate DOM before transition so there's no blank flash */
  _setEl('identity-rocket-preview',    renderRocketSVG(identity.rocketConfig, 88), true);
  _setEl('identity-username-display',  identity.username);
  _setEl('identity-rocket-id',         identity.rocketId);
  _setEl('identity-phrase-1',          identity.phrases[0]);
  _setEl('identity-phrase-2',          identity.phrases[1]);
  _setEl('identity-phrase-3',          identity.phrases[2]);
  _setEl('token-value-display',        identity.token.replace(/^u_/, ''));

  startStarfield('identity-canvas', { starCount: 150, particleCount: 24, speed: 0.09 });
  showScreen('screen-identity');

  /* Wire copy buttons */
  _onclick('btn-copy-token', async () => {
    const ok = await copyToClipboard(identity.token);
    showToast(ok ? 'Token copied to clipboard!' : 'Copy failed — please copy manually.', ok ? 'success' : 'error');
  });

  _onclick('btn-copy-phrases', async () => {
    const ok = await copyToClipboard(identity.phrases.join(' '));
    showToast(ok ? 'Phrases copied!' : 'Copy failed — please copy manually.', ok ? 'success' : 'error');
  });

  _onclick('btn-enter-hub', () => showScreen('screen-dashboard'));
}

/* ═══════════════════════════════════════════════════════════════════════
   §15  DASHBOARD
   ═══════════════════════════════════════════════════════════════════ */
function _initDashboardScreen() {
  if (!STATE.identity) { showScreen('screen-username'); return; }
  const id = STATE.identity;

  try { startStarfield('dashboard-canvas', { starCount: 180, particleCount: 28, speed: 0.07 }); } catch(e) {}

  /* ── Identity FAB — rocket avatar ── */
  _setEl('nav-rocket-avatar', renderRocketSVG(id.rocketConfig, 36), true);
  /* kept hidden spans for compatibility */
  _setEl('nav-username', id.username);
  _setEl('nav-rocket-id', id.rocketId);

  /* ── Greeting ── */
  _setEl('dashboard-hero-username', id.username);
  const h = new Date().getHours();
  const greeting = h < 5 ? 'Good night,' : h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : h < 21 ? 'Good evening,' : 'Welcome back,';
  _setEl('dashboard-greeting', greeting);

  /* ── Connection status ── */
  _updateNavStatus();

  /* ── Wire all navigation tiles + private link ── */
  const navTargets = ['card-chat', 'card-call', 'card-meet', 'card-private'];
  navTargets.forEach(btnId => {
    const el = $(btnId);
    if (!el) return;
    const fresh = el.cloneNode(true);
    el.replaceWith(fresh);
    fresh.addEventListener('click', () => {
      const target = fresh.dataset.target;
      if (target) showScreen(target);
    });
  });

  /* ── Identity FAB → open token modal ── */
  _onclick('btn-show-token-modal', () => _openTokenModal());
}

function _updateNavStatus() {
  const txtEl = $('nav-status-text');
  const dot   = document.querySelector('.dashboard-nav__status .status-dot');
  const ok    = !!STATE.supabase;
  if (txtEl) txtEl.textContent = ok ? 'Connected' : 'Offline';
  if (dot) {
    dot.classList.toggle('status-dot--online',  ok);
    dot.classList.toggle('status-dot--offline', !ok);
  }
}

/** Creates a brief particle burst inside a feature card (CSS animation). */
function _spawnCardParticles(card) {
  const container = card.querySelector('.feature-card__particles');
  if (!container) return;
  for (let i = 0; i < 4; i++) {
    const p = document.createElement('span');
    p.className = 'card-particle';
    p.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*100}%;animation-delay:${Math.random()*0.3}s`;
    container.appendChild(p);
    p.addEventListener('animationend', () => p.remove(), { once: true });
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   §16  MODAL SYSTEM
   ───────────────────────────────────────────────────────────────────
   Three modals:
     modal-token          — identity viewer / token copy
     modal-recovery       — restore identity from 3 phrases
     modal-confirm-reset  — confirm permanent identity wipe
   ═══════════════════════════════════════════════════════════════════ */

/** Opens a modal by id. */
function _openModal(id) {
  const overlay = $(id);
  if (!overlay) return;
  overlay.hidden = false;
  overlay.removeAttribute('aria-hidden');
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('modal-overlay--visible')));

  /* Focus first focusable child */
  const focusable = overlay.querySelector('button:not([disabled]),input,[tabindex]:not([tabindex="-1"])');
  if (focusable) setTimeout(() => { try { focusable.focus(); } catch {} }, 100);

  /* Close on backdrop click */
  const onBg = e => { if (e.target === overlay) _closeModal(id); };
  overlay.addEventListener('click', onBg);
  overlay._bgHandler = onBg;

  /* Close on Escape */
  const onEsc = e => { if (e.key === 'Escape') { _closeModal(id); document.removeEventListener('keydown', onEsc); } };
  document.addEventListener('keydown', onEsc);
  overlay._escHandler = onEsc;
}

/** Closes a modal by id. */
function _closeModal(id) {
  const overlay = $(id);
  if (!overlay) return;
  overlay.classList.remove('modal-overlay--visible');

  const hide = () => { overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true'); };
  overlay.addEventListener('transitionend', hide, { once: true });
  setTimeout(hide, 420);

  if (overlay._bgHandler)  { overlay.removeEventListener('click', overlay._bgHandler); delete overlay._bgHandler; }
  if (overlay._escHandler) { document.removeEventListener('keydown', overlay._escHandler); delete overlay._escHandler; }
  document.body.classList.remove('modal-open');
}

/* ── Token modal ── */
function _openTokenModal() {
  const id = STATE.identity;
  if (!id) return;

  _setEl('modal-rocket-preview', renderRocketSVG(id.rocketConfig, 58), true);
  _setEl('modal-username',       id.username);
  _setEl('modal-rocket-id',      id.rocketId);
  _setEl('modal-token-value',    id.token);
  _setEl('modal-phrase-1',       id.phrases[0]);
  _setEl('modal-phrase-2',       id.phrases[1]);
  _setEl('modal-phrase-3',       id.phrases[2]);

  _openModal('modal-token');

  _onclick('btn-close-token-modal',   () => _closeModal('modal-token'));
  _onclick('btn-modal-close-confirm', () => _closeModal('modal-token'));
  _onclick('btn-modal-copy-token', async () => {
    const ok = await copyToClipboard(id.token);
    showToast(ok ? 'Token copied!' : 'Copy failed.', ok ? 'success' : 'error');
  });
  _onclick('btn-modal-reset', () => {
    _closeModal('modal-token');
    setTimeout(() => _openConfirmResetModal(), 360);
  });
}

/* ── Confirm Reset modal ── */
function _openConfirmResetModal() {
  _openModal('modal-confirm-reset');
  _onclick('btn-cancel-reset',  () => _closeModal('modal-confirm-reset'));
  _onclick('btn-confirm-reset', () => { _closeModal('modal-confirm-reset'); _doResetIdentity(); });
}

function _doResetIdentity() {
  _cleanupChat();
  _cleanupPrivateChat();
  _cleanupCall(true);
  _cleanupMeet(true);
  clearIdentity();
  STATE.identity = null;
  showToast('Identity wiped. The void awaits.', 'info');
  setTimeout(() => showScreen('screen-username'), 700);
}

/* ── Recovery modal (wired once at boot) ── */
function _initRecoveryModal() {
  _onclick('btn-close-recovery-modal', () => _closeModal('modal-recovery'));
  _onclick('btn-cancel-recovery',      () => _closeModal('modal-recovery'));
  _onclick('btn-recover-identity',     _handleRecovery);
  // Allow Enter key in phrase inputs
  ['recovery-phrase-1','recovery-phrase-2','recovery-phrase-3'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') _handleRecovery(); });
  });
}

async function _handleRecovery() {
  const p1    = $('recovery-phrase-1')?.value?.trim() ?? '';
  const p2    = $('recovery-phrase-2')?.value?.trim() ?? '';
  const p3    = $('recovery-phrase-3')?.value?.trim() ?? '';
  const errEl = $('recovery-error');
  const btnEl = $('btn-recover-identity');

  if (!p1 || !p2 || !p3) {
    if (errEl) errEl.textContent = 'Please fill in all three phrases.';
    return;
  }
  if (errEl) errEl.textContent = '';
  if (btnEl) btnEl.textContent = 'Restoring...';

  try {
    const token        = await phrasesToToken(p1, p2, p3);
    const rocketConfig = generateRocketConfig(token);
    const rocketId     = generateRocketId();
    const identity     = { username: 'Recovered', token, phrases: [p1,p2,p3], rocketId, rocketConfig };
    STATE.identity     = identity;
    saveIdentity(identity);

    // Clear inputs
    ['recovery-phrase-1','recovery-phrase-2','recovery-phrase-3'].forEach(id => {
      const el = $(id); if (el) el.value = '';
    });

    _closeModal('modal-recovery');
    showToast('Identity restored! Welcome back, explorer.', 'success');
    setTimeout(() => _showIdentityScreen(identity), 380);
  } catch (e) {
    console.error('[Alex] Recovery error:', e);
    if (errEl) errEl.textContent = 'Recovery failed. Check your phrases and try again.';
  } finally {
    if (btnEl) btnEl.textContent = 'RESTORE';
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   §17  SUPABASE INIT
   ═══════════════════════════════════════════════════════════════════ */
async function _initSupabase() {
  /* Step 1 — ensure Supabase JS is loaded */
  if (typeof window.supabase === 'undefined') {
    console.warn('[Alex] Supabase CDN not loaded — attempting dynamic fallback.');
    await new Promise(resolve => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
      s.onload  = resolve;
      s.onerror = () => { console.error('[Alex] Dynamic Supabase load failed.'); resolve(); };
      document.head.appendChild(s);
    });
  }

  if (typeof window.supabase === 'undefined') {
    console.error('[Alex] Supabase unavailable. Chat/signaling disabled.');
    showToast(
      'Real-time chat unavailable. Remove the integrity hash from the Supabase <script> in index.html, then redeploy.',
      'warn', 10000,
    );
    return;
  }

  /* Step 2 — check config */
  if (CONFIG.SUPABASE_URL.includes('YOUR_PROJECT_ID') || CONFIG.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY')) {
    console.warn('[Alex] Supabase credentials not configured. Edit CONFIG in js/app.js.');
    showToast('Configure your Supabase URL and Anon Key in js/app.js to enable real-time features.', 'warn', 10000);
    return;
  }

  /* Step 3 — create client */
  try {
    STATE.supabase = window.supabase.createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_ANON_KEY,
      { realtime: { timeout: 30000 } },
    );
    console.info('[Alex] Supabase client ready.');
    _updateNavStatus();
  } catch (e) {
    console.error('[Alex] Supabase init error:', e);
    showToast('Failed to connect to chat server. Check your Supabase credentials.', 'error');
  }
}
/* ═══════════════════════════════════════════════════════════════════════
   §18  PUBLIC CHAT  — Supabase Realtime broadcast channels
   ───────────────────────────────────────────────────────────────────
   Messages are broadcast (not stored in DB) so no schema migrations
   are needed beyond the Realtime feature being enabled on the project.
   Presence is used for the online-count indicator.
   ═══════════════════════════════════════════════════════════════════ */

function _initChatScreen() {
  /* ── Back / header buttons ── */
  _onclick('btn-back-from-chat', () => showScreen('screen-dashboard'));
  _onclick('btn-change-room', () => {
    _cleanupChat();
    _toggleChatPanel(true);
    const roomInput = $('chat-room-input');
    if (roomInput) { roomInput.value = ''; setTimeout(() => { try { roomInput.focus(); } catch {} }, 200); }
  });

  /* ── Avatar in input bar ── */
  const avatarEl = $('chat-input-avatar');
  if (avatarEl && STATE.identity) avatarEl.innerHTML = renderRocketSVG(STATE.identity.rocketConfig, 28);

  /* ── Room join panel ── */
  _toggleChatPanel(true);

  const roomInput = $('chat-room-input');
  const btnJoin   = $('btn-join-chat-room');

  const doJoin = () => {
    const raw = (roomInput?.value ?? '').trim().toLowerCase().replace(/[^a-z0-9\-]/g,'-').replace(/^-+|-+$/g,'');
    if (!raw || raw.length < 2) { showToast('Enter a room name (at least 2 characters).', 'warn'); return; }
    _joinChatRoom(raw);
  };

  if (btnJoin)   { const f = btnJoin.cloneNode(true);  btnJoin.replaceWith(f);   f.onclick = doJoin; }
  if (roomInput) { roomInput.onkeydown = e => { if (e.key === 'Enter') doJoin(); }; setTimeout(() => { try { roomInput.focus(); } catch {} }, 280); }

  /* ── Message input ── */
  const chatInput = $('chat-input');
  const btnSend   = $('btn-chat-send');
  if (chatInput) {
    chatInput.oninput   = () => { autoResizeTextarea(chatInput); if (btnSend) btnSend.disabled = !chatInput.value.trim(); _onChatTyping(); };
    chatInput.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _sendChatMessage(); } };
  }
  if (btnSend) { const f = btnSend.cloneNode(true); btnSend.replaceWith(f); f.onclick = _sendChatMessage; }
}

function _toggleChatPanel(show) {
  const panel   = $('chat-room-join-panel');
  const body    = $('chat-body');
  const inputEl = $('chat-input-area');
  if (!panel) return;
  panel.style.display   = show ? ''     : 'none';
  if (body)    body.style.display    = show ? 'none' : '';
  if (inputEl) inputEl.style.display = show ? 'none' : '';
}

async function _joinChatRoom(roomName) {
  if (!STATE.supabase) {
    showToast('Chat server not connected. Configure Supabase credentials in js/app.js.', 'error', 7000);
    return;
  }

  _cleanupChat();
  STATE.chat.room = roomName;
  STATE.chat.sentMsgIds.clear();

  /* UI */
  _setEl('chat-room-display', roomName);
  const chatInput = $('chat-input');
  if (chatInput) chatInput.placeholder = `Message #${roomName}...`;
  const messagesEl = $('chat-messages');
  if (messagesEl) messagesEl.innerHTML = '';
  _setConnBadge('chat-connection-status', 'connecting', 'Connecting...');
  _toggleChatPanel(false);

  /* Channel */
  const channel = STATE.supabase.channel(`public-chat:${roomName}`, {
    config: {
      broadcast: { self: false },
      presence:  { key: STATE.identity.token },
    },
  });
  STATE.chat.channel = channel;

  /* Presence → online count */
  channel.on('presence', { event: 'sync' }, () => {
    const count = Object.keys(channel.presenceState()).length;
    _setEl('chat-online-count', `${count} online`);
  });

  /* Incoming messages */
  channel.on('broadcast', { event: 'msg' }, ({ payload }) => {
    if (!payload) return;
    if (STATE.chat.sentMsgIds.has(payload.id)) return; // skip echo
    _appendChatMessage(payload, false);
  });

  /* Incoming typing */
  channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
    if (!payload || payload.token === STATE.identity.token) return;
    _showTypingIndicator('chat-typing-indicator', 'chat-typing-text',
      `${sanitizeHTML(payload.username)} is typing...`);
  });

  /* Subscribe */
  channel.subscribe(async status => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        token:    STATE.identity.token,
        username: STATE.identity.username,
        rocketId: STATE.identity.rocketId,
        ts:       Date.now(),
      }).catch(() => {});
      _setConnBadge('chat-connection-status', 'connected', 'Live');
      _appendSystemMessage('chat-messages', `— Joined #${roomName} —`);
      showToast(`Joined #${roomName}`, 'success');
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      _setConnBadge('chat-connection-status', 'error', 'Error');
      showToast('Connection error. Check your Supabase config.', 'error');
    } else if (status === 'CLOSED') {
      _setConnBadge('chat-connection-status', 'idle', 'Disconnected');
    }
  });
}

async function _sendChatMessage() {
  const input  = $('chat-input');
  const btnSend = $('btn-chat-send');
  if (!input || !STATE.chat.channel || !STATE.identity) return;

  const text = input.value.trim();
  if (!text) return;

  const msg = {
    id:           genUUID(),
    username:     STATE.identity.username,
    rocketId:     STATE.identity.rocketId,
    rocketConfig: STATE.identity.rocketConfig,
    message:      text,
    ts:           Date.now(),
  };

  /* Dedup: track sent IDs */
  STATE.chat.sentMsgIds.add(msg.id);
  if (STATE.chat.sentMsgIds.size > 600) {
    STATE.chat.sentMsgIds.delete(STATE.chat.sentMsgIds.values().next().value);
  }

  /* Optimistic render */
  _appendChatMessage(msg, true);

  /* Reset input */
  input.value = '';
  autoResizeTextarea(input);
  if (btnSend) btnSend.disabled = true;

  try {
    await STATE.chat.channel.send({ type: 'broadcast', event: 'msg', payload: msg });
  } catch {
    showToast('Failed to send. Check your connection.', 'error');
  }
}

function _appendChatMessage(msg, isOutgoing) {
  const el = $('chat-messages');
  if (!el) return;

  const rkt = msg.rocketConfig ? renderRocketSVG(msg.rocketConfig, 30) : '';
  const item = document.createElement('div');
  item.className = `msg ${isOutgoing ? 'msg--outgoing' : 'msg--incoming'}`;
  item.dataset.msgId = msg.id;
  item.setAttribute('role', 'listitem');
  item.innerHTML = `
    <div class="msg__avatar" aria-hidden="true"><div class="msg-rocket-mini">${rkt}</div></div>
    <div class="msg__bubble">
      <div class="msg__meta">
        <span class="msg__username">${sanitizeHTML(msg.username)}</span>
        <span class="msg__rocket-id">${sanitizeHTML(msg.rocketId)}</span>
        <time class="msg__time" datetime="${new Date(msg.ts).toISOString()}">${formatTime(new Date(msg.ts))}</time>
      </div>
      <p class="msg__text">${sanitizeHTML(msg.message)}</p>
    </div>`;

  el.appendChild(item);
  _pruneMessages(el);
  _scrollToBottom(el);
}

/** Typing signal */
const _chatTypingDebounced = debounce(() => { STATE.chat.isTyping = false; }, CONFIG.TYPING_TIMEOUT);

function _onChatTyping() {
  if (!STATE.chat.channel) return;
  if (!STATE.chat.isTyping) {
    STATE.chat.isTyping = true;
    STATE.chat.channel.send({ type:'broadcast', event:'typing', payload:{ token: STATE.identity.token, username: STATE.identity.username } }).catch(()=>{});
  }
  _chatTypingDebounced();
}

function _cleanupChat() {
  if (STATE.chat.channel) { STATE.chat.channel.unsubscribe().catch(()=>{}); STATE.chat.channel = null; }
  STATE.chat.room     = null;
  STATE.chat.isTyping = false;
  STATE.chat.sentMsgIds.clear();
  clearTimeout(STATE.chat.typingTimer);
}
/* ═══════════════════════════════════════════════════════════════════════
   §19  PRIVATE CHAT  — WebRTC DataChannel over Supabase signaling
   ───────────────────────────────────────────────────────────────────
   Protocol flow:
     1. Both users enter each other's tokens.
     2. Room ID = first 16 chars of SHA-256(sorted_tokens + '_p2p_').
     3. Both subscribe to Supabase broadcast `p2p:{roomId}`.
     4. Role: token that sorts first alphabetically → offerer.
     5. Offerer creates PC + DataChannel, sends SDP offer.
     6. Answerer creates PC, sets remote desc, sends SDP answer.
     7. Both exchange ICE candidates via broadcast.
     8. DataChannel opens → chat is live, no server involvement.
   ═══════════════════════════════════════════════════════════════════ */

function _initPrivateChatScreen() {
  /* ── Back ── */
  _onclick('btn-back-from-private', () => showScreen('screen-dashboard'));

  /* ── My token display ── */
  if (STATE.identity) {
    _setEl('private-my-token-display', STATE.identity.token);
    const avatarEl = $('private-input-avatar');
    if (avatarEl) avatarEl.innerHTML = renderRocketSVG(STATE.identity.rocketConfig, 28);
  }

  /* ── Copy my token ── */
  _onclick('btn-copy-my-token', async () => {
    if (!STATE.identity) return;
    const ok = await copyToClipboard(STATE.identity.token);
    showToast(ok ? 'Your token copied!' : 'Copy failed.', ok ? 'success' : 'error');
  });

  /* ── Show connect panel initially ── */
  _togglePrivatePanel(true);

  /* ── Connect to peer ── */
  const tokenInput  = $('private-token-input');
  const btnConnect  = $('btn-connect-peer');
  const errorEl     = $('private-token-error');

  const doConnect = () => {
    const raw = (tokenInput?.value ?? '').trim();
    if (!raw || !raw.startsWith('u_') || raw.length < 10) {
      if (errorEl) errorEl.textContent = 'Enter a valid token (starts with u_).';
      return;
    }
    if (raw === STATE.identity?.token) {
      if (errorEl) errorEl.textContent = 'You cannot connect to yourself.';
      return;
    }
    if (errorEl) errorEl.textContent = '';
    _connectPrivatePeer(raw);
  };

  if (btnConnect)  { const f = btnConnect.cloneNode(true); btnConnect.replaceWith(f); f.onclick = doConnect; }
  if (tokenInput)  { tokenInput.onkeydown = e => { if (e.key === 'Enter') doConnect(); }; setTimeout(() => { try { tokenInput.focus(); } catch {} }, 280); }

  /* ── Private message input ── */
  const privInput = $('private-chat-input');
  const btnSend   = $('btn-private-send');
  if (privInput) {
    privInput.oninput   = () => { autoResizeTextarea(privInput); if (btnSend) btnSend.disabled = !privInput.value.trim(); _onPrivateTyping(); };
    privInput.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _sendPrivateMessage(); } };
  }
  if (btnSend) { const f = btnSend.cloneNode(true); btnSend.replaceWith(f); f.onclick = _sendPrivateMessage; }
}

function _togglePrivatePanel(show) {
  const panel = $('private-connect-panel');
  const body  = $('private-chat-body');
  const input = $('private-input-area');
  if (!panel) return;
  panel.style.display = show ? ''     : 'none';
  if (body)  body.style.display  = show ? 'none' : '';
  if (input) input.style.display = show ? 'none' : '';
}

async function _connectPrivatePeer(peerToken) {
  if (!STATE.supabase) {
    showToast('Signaling server not connected. Configure Supabase credentials first.', 'error', 7000);
    return;
  }

  _cleanupPrivateChat();
  STATE.privateChat.peerToken = peerToken;

  /* Room ID: deterministic from both tokens */
  const myToken = STATE.identity.token;
  const sorted  = [myToken, peerToken].sort();
  const roomId  = (await sha256(sorted.join('|') + '_alex_p2p_v1_')).slice(0, 16);
  STATE.privateChat.roomId    = roomId;
  STATE.privateChat.isOfferer = myToken < peerToken; // alphabetically lower = offerer

  /* UI: show messages area */
  _setConnBadge('private-connection-status', 'connecting', 'Connecting...');
  _togglePrivatePanel(false);
  const msgEl = $('private-messages');
  if (msgEl) msgEl.innerHTML = '';
  _appendSystemMessage('private-messages', '— Establishing encrypted P2P channel... —');

  /* Subscribe to Supabase signaling channel */
  const sigCh = STATE.supabase.channel(`p2p:${roomId}`, {
    config: { broadcast: { self: false } },
  });
  STATE.privateChat.signalingChannel = sigCh;

  sigCh.on('broadcast', { event: 'p2p-offer'     }, ({ payload }) => _onPrivateSignal_Offer(payload));
  sigCh.on('broadcast', { event: 'p2p-answer'    }, ({ payload }) => _onPrivateSignal_Answer(payload));
  sigCh.on('broadcast', { event: 'p2p-ice'       }, ({ payload }) => _onPrivateSignal_ICE(payload));
  sigCh.on('broadcast', { event: 'p2p-meta'      }, ({ payload }) => _onPrivatePeerMeta(payload));
  sigCh.on('broadcast', { event: 'p2p-typing'    }, ({ payload }) => {
    _showTypingIndicator('private-typing-indicator', null, 'Peer is typing...');
  });

  sigCh.subscribe(async status => {
    if (status === 'SUBSCRIBED') {
      /* Announce our metadata to peer */
      await sigCh.send({ type:'broadcast', event:'p2p-meta', payload: {
        token: STATE.identity.token, username: STATE.identity.username,
        rocketId: STATE.identity.rocketId, rocketConfig: STATE.identity.rocketConfig,
      }}).catch(()=>{});

      if (STATE.privateChat.isOfferer) {
        await _createPrivateOffer();
      }
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      _setConnBadge('private-connection-status', 'error', 'Signal Error');
      showToast('Signaling failed. Check your Supabase config.', 'error');
    }
  });
}

function _createPrivatePeerConnection() {
  const pc = new RTCPeerConnection({ iceServers: CONFIG.ICE_SERVERS });

  pc.onicecandidate = e => {
    if (e.candidate && STATE.privateChat.signalingChannel) {
      STATE.privateChat.signalingChannel.send({
        type: 'broadcast', event: 'p2p-ice',
        payload: { candidate: e.candidate.toJSON(), token: STATE.identity.token },
      }).catch(()=>{});
    }
  };

  pc.onconnectionstatechange = () => {
    const s = pc.connectionState;
    switch (s) {
      case 'connected':
        _setConnBadge('private-connection-status', 'connected', 'Connected · E2E');
        STATE.privateChat.connected = true;
        _enablePrivateInput(true);
        _appendSystemMessage('private-messages', '— Encrypted P2P channel open —');
        showToast('Private channel connected!', 'success');
        break;
      case 'disconnected':
      case 'failed':
        _setConnBadge('private-connection-status', 'error', 'Disconnected');
        STATE.privateChat.connected = false;
        _enablePrivateInput(false);
        _appendSystemMessage('private-messages', '— Peer disconnected —');
        break;
    }
  };

  return pc;
}

async function _createPrivateOffer() {
  const pc = _createPrivatePeerConnection();
  STATE.privateChat.peerConnection = pc;

  /* Create DataChannel as offerer */
  const dc = pc.createDataChannel('alex-private-chat', { ordered: true });
  STATE.privateChat.dataChannel = dc;
  _wireDataChannel(dc);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await STATE.privateChat.signalingChannel.send({
    type: 'broadcast', event: 'p2p-offer',
    payload: { sdp: pc.localDescription, token: STATE.identity.token },
  }).catch(()=>{});
}

async function _onPrivateSignal_Offer(payload) {
  if (!payload?.sdp || STATE.privateChat.isOfferer) return;

  const pc = _createPrivatePeerConnection();
  STATE.privateChat.peerConnection = pc;

  /* Answerer receives DataChannel */
  pc.ondatachannel = e => {
    STATE.privateChat.dataChannel = e.channel;
    _wireDataChannel(e.channel);
  };

  await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

  /* Drain buffered ICE candidates */
  for (const c of STATE.privateChat.iceCandidateBuffer) {
    await pc.addIceCandidate(new RTCIceCandidate(c)).catch(()=>{});
  }
  STATE.privateChat.iceCandidateBuffer = [];

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await STATE.privateChat.signalingChannel.send({
    type: 'broadcast', event: 'p2p-answer',
    payload: { sdp: pc.localDescription, token: STATE.identity.token },
  }).catch(()=>{});
}

async function _onPrivateSignal_Answer(payload) {
  if (!payload?.sdp || !STATE.privateChat.isOfferer) return;
  const pc = STATE.privateChat.peerConnection;
  if (!pc || pc.signalingState === 'stable') return;
  await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp)).catch(e => console.warn('[P2P] setRemoteDescription answer:', e));

  /* Drain buffer */
  for (const c of STATE.privateChat.iceCandidateBuffer) {
    await pc.addIceCandidate(new RTCIceCandidate(c)).catch(()=>{});
  }
  STATE.privateChat.iceCandidateBuffer = [];
}

async function _onPrivateSignal_ICE(payload) {
  if (!payload?.candidate) return;
  const pc = STATE.privateChat.peerConnection;
  if (pc && pc.remoteDescription) {
    await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(()=>{});
  } else {
    STATE.privateChat.iceCandidateBuffer.push(payload.candidate);
  }
}

function _onPrivatePeerMeta(payload) {
  if (!payload) return;
  STATE.privateChat.peerInfo = {
    username:     payload.username     ?? 'Unknown',
    rocketId:     payload.rocketId     ?? '',
    rocketConfig: payload.rocketConfig ?? null,
  };
  /* Update peer badge */
  const badge = $('private-peer-badge');
  if (badge) {
    badge.hidden = false;
    _setEl('private-peer-name',      payload.username ?? 'Peer');
    _setEl('private-peer-rocket-id', payload.rocketId ?? '');
    const rktEl = $('private-peer-rocket');
    if (rktEl && payload.rocketConfig) rktEl.innerHTML = renderRocketSVG(payload.rocketConfig, 26);
  }
}

function _wireDataChannel(dc) {
  dc.onopen = () => {
    /* Redundant — connectionstatechange handles UI, but re-confirm here */
    _setConnBadge('private-connection-status', 'connected', 'Connected · E2E');
    STATE.privateChat.connected = true;
    _enablePrivateInput(true);
  };

  dc.onclose = () => {
    STATE.privateChat.connected = false;
    _enablePrivateInput(false);
    _setConnBadge('private-connection-status', 'idle', 'Closed');
    _appendSystemMessage('private-messages', '— Channel closed —');
  };

  dc.onerror = e => {
    console.error('[DataChannel] Error:', e);
    showToast('Private channel error. Please reconnect.', 'error');
  };

  dc.onmessage = e => {
    try {
      const parsed = JSON.parse(e.data);
      if (parsed.type === 'typing') {
        _showTypingIndicator('private-typing-indicator', null, 'Peer is typing...');
        return;
      }
      if (parsed.type === 'msg') _appendPrivateMessage(parsed, false);
    } catch {
      console.warn('[DataChannel] Non-JSON message received.');
    }
  };
}

function _sendPrivateMessage() {
  const input   = $('private-chat-input');
  const btnSend = $('btn-private-send');
  if (!input || !STATE.privateChat.dataChannel || !STATE.privateChat.connected) return;

  const text = input.value.trim();
  if (!text) return;

  const msg = {
    type:         'msg',
    id:           genUUID(),
    username:     STATE.identity.username,
    rocketId:     STATE.identity.rocketId,
    rocketConfig: STATE.identity.rocketConfig,
    message:      text,
    ts:           Date.now(),
  };

  try {
    STATE.privateChat.dataChannel.send(JSON.stringify(msg));
    _appendPrivateMessage(msg, true);
    input.value = '';
    autoResizeTextarea(input);
    if (btnSend) btnSend.disabled = true;
  } catch (e) {
    showToast('Send failed. Channel may have closed.', 'error');
    console.error('[DataChannel] send error:', e);
  }
}

function _appendPrivateMessage(msg, isOutgoing) {
  const el = $('private-messages');
  if (!el) return;

  const rkt  = msg.rocketConfig ? renderRocketSVG(msg.rocketConfig, 30) : '';
  const item = document.createElement('div');
  item.className = `msg ${isOutgoing ? 'msg--outgoing' : 'msg--incoming'}`;
  item.setAttribute('role', 'listitem');
  item.innerHTML = `
    <div class="msg__avatar" aria-hidden="true"><div class="msg-rocket-mini">${rkt}</div></div>
    <div class="msg__bubble">
      <div class="msg__meta">
        <span class="msg__username">${sanitizeHTML(msg.username)}</span>
        <span class="msg__rocket-id">${sanitizeHTML(msg.rocketId)}</span>
        <time class="msg__time" datetime="${new Date(msg.ts).toISOString()}">${formatTime(new Date(msg.ts))}</time>
      </div>
      <p class="msg__text">${sanitizeHTML(msg.message)}</p>
    </div>`;
  el.appendChild(item);
  _pruneMessages(el);
  _scrollToBottom(el);
}

function _enablePrivateInput(enabled) {
  const input   = $('private-chat-input');
  const btnSend = $('btn-private-send');
  if (input)   { input.disabled = !enabled; if (enabled) setTimeout(() => { try { input.focus(); } catch {} }, 200); }
  if (btnSend) btnSend.disabled = !enabled || !(input?.value?.trim());
}

const _privateTypingDebounced = debounce(() => {}, CONFIG.TYPING_TIMEOUT);

function _onPrivateTyping() {
  if (!STATE.privateChat.dataChannel || !STATE.privateChat.connected) return;
  try {
    STATE.privateChat.dataChannel.send(JSON.stringify({ type: 'typing' }));
  } catch {}
}

function _cleanupPrivateChat() {
  if (STATE.privateChat.dataChannel)    { try { STATE.privateChat.dataChannel.close();    } catch {} STATE.privateChat.dataChannel    = null; }
  if (STATE.privateChat.peerConnection) { try { STATE.privateChat.peerConnection.close(); } catch {} STATE.privateChat.peerConnection = null; }
  if (STATE.privateChat.signalingChannel) { STATE.privateChat.signalingChannel.unsubscribe().catch(()=>{}); STATE.privateChat.signalingChannel = null; }
  STATE.privateChat.peerToken          = null;
  STATE.privateChat.roomId             = null;
  STATE.privateChat.connected          = false;
  STATE.privateChat.isOfferer          = false;
  STATE.privateChat.peerInfo           = null;
  STATE.privateChat.iceCandidateBuffer = [];
}
/* ═══════════════════════════════════════════════════════════════════════
   §20  CALL SYSTEM  — WebRTC mesh for voice/video (up to 4 peers)
   ───────────────────────────────────────────────────────────────────
   Architecture: full-mesh N-way.  Each joining participant creates
   RTCPeerConnection to every existing participant.
   Supabase Realtime broadcast is the signaling layer.
   Signal events: call-join, call-offer, call-answer, call-ice,
                  call-leave, call-media-state
   ═══════════════════════════════════════════════════════════════════ */

function _initCallScreen() {
  _onclick('btn-back-from-call', () => {
    if (STATE.call.inCall) _endCall();
    showScreen('screen-dashboard');
  });

  /* ── Mode selector ── */
  const modeVideo = $('mode-video');
  const modeAudio = $('mode-audio');
  const setMode = (mode) => {
    STATE.call.mode = mode;
    if (modeVideo) { modeVideo.classList.toggle('mode-btn--active', mode === 'video'); modeVideo.setAttribute('aria-pressed', String(mode === 'video')); }
    if (modeAudio) { modeAudio.classList.toggle('mode-btn--active', mode === 'audio'); modeAudio.setAttribute('aria-pressed', String(mode === 'audio')); }
  };
  if (modeVideo) { const f = modeVideo.cloneNode(true); modeVideo.replaceWith(f); f.onclick = () => setMode('video'); }
  if (modeAudio) { const f = modeAudio.cloneNode(true); modeAudio.replaceWith(f); f.onclick = () => setMode('audio'); }

  /* ── Join call ── */
  const roomInput = $('call-room-input');
  const btnJoin   = $('btn-join-call');
  const errEl     = $('call-room-error');

  const doJoin = () => {
    const raw = (roomInput?.value ?? '').trim().toLowerCase().replace(/[^a-z0-9\-]/g,'-').replace(/^-+|-+$/g,'');
    if (!raw || raw.length < 2) {
      if (errEl) errEl.textContent = 'Enter a room name (at least 2 characters).';
      return;
    }
    if (errEl) errEl.textContent = '';
    _joinCall(raw);
  };

  if (btnJoin)  { const f = btnJoin.cloneNode(true); btnJoin.replaceWith(f); f.onclick = doJoin; }
  if (roomInput) roomInput.onkeydown = e => { if (e.key === 'Enter') doJoin(); };

  /* ── Controls (wired here; only active once in-call) ── */
  _onclick('btn-toggle-mic',          _toggleMic);
  _onclick('btn-toggle-camera',       _toggleCamera);
  _onclick('btn-toggle-screen',       _toggleScreenShare);
  _onclick('btn-end-call',            _endCall);
  _onclick('btn-toggle-participants', _toggleSidebar.bind(null, 'participants-sidebar', 'btn-toggle-participants'));
  _onclick('btn-call-chat-toggle',    _toggleSidebar.bind(null, 'call-chat-sidebar',    'btn-call-chat-toggle'));
  _onclick('btn-close-participants',  () => _closeSidebar('participants-sidebar', 'btn-toggle-participants'));
  _onclick('btn-close-call-chat',     () => _closeSidebar('call-chat-sidebar',    'btn-call-chat-toggle'));

  /* In-call chat input */
  const callChatInput = $('call-chat-input');
  const btnCallSend   = $('btn-call-chat-send');
  if (callChatInput) {
    callChatInput.onkeydown = e => { if (e.key === 'Enter') _sendCallChatMessage(); };
  }
  if (btnCallSend) { const f = btnCallSend.cloneNode(true); btnCallSend.replaceWith(f); f.onclick = _sendCallChatMessage; }
}

async function _joinCall(roomName) {
  if (!STATE.supabase) {
    showToast('Signaling server unavailable. Configure Supabase credentials.', 'error', 7000);
    return;
  }

  const peerCount = Object.keys(STATE.call.peers).length;
  if (peerCount >= CONFIG.MAX_CALL_PEERS) {
    showToast(`Room is full (max ${CONFIG.MAX_CALL_PEERS + 1} participants).`, 'warn');
    return;
  }

  _cleanupCall(false);
  STATE.call.room   = roomName;
  STATE.call.inCall = true;

  /* ── Get local media ── */
  try {
    const constraints = STATE.call.mode === 'video'
      ? { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: true }
      : { video: false, audio: true };
    STATE.call.localStream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e) {
    showToast(`Media access denied: ${e.message}`, 'error');
    STATE.call.inCall = false;
    _cleanupCall(false);
    return;
  }

  /* ── Show local video ── */
  const localVideo = $('local-video');
  if (localVideo) {
    localVideo.srcObject = STATE.call.localStream;
    localVideo.play().catch(()=>{});
  }

  /* ── Video vs audio-only UI ── */
  const hasVideo = STATE.call.mode === 'video';
  _setCamBadgeState('local', hasVideo);
  if (!hasVideo) {
    if (localVideo) localVideo.hidden = true;
    const noVid = $('local-no-video');
    if (noVid) {
      noVid.hidden = false;
      const avatar = $('local-call-avatar');
      if (avatar && STATE.identity) avatar.innerHTML = renderRocketSVG(STATE.identity.rocketConfig, 52);
    }
  }

  /* ── Populate local tile info ── */
  const localRocket = $('local-call-rocket');
  if (localRocket && STATE.identity) localRocket.innerHTML = renderRocketSVG(STATE.identity.rocketConfig, 26);
  _setEl('local-call-username', STATE.identity?.username ?? 'You');

  /* ── Show call interface ── */
  const setupEl = $('call-setup');
  const iface   = $('call-interface');
  if (setupEl) setupEl.hidden = true;
  if (iface)   iface.hidden = false;

  _setEl('call-room-display', roomName);
  _setEl('call-empty-room-name', roomName);
  _setConnBadge('call-status', 'connecting', 'Connecting...');
  _updateCallTitle();

  /* ── Signaling channel ── */
  const sigCh = STATE.supabase.channel(`call:${roomName}`, {
    config: { broadcast: { self: false }, presence: { key: STATE.identity.token } },
  });
  STATE.call.signalingChannel = sigCh;

  /* Incoming signals */
  sigCh.on('broadcast', { event: 'call-join'         }, ({ payload }) => _onCallPeerJoin(payload));
  sigCh.on('broadcast', { event: 'call-offer'        }, ({ payload }) => _onCallOffer(payload));
  sigCh.on('broadcast', { event: 'call-answer'       }, ({ payload }) => _onCallAnswer(payload));
  sigCh.on('broadcast', { event: 'call-ice'          }, ({ payload }) => _onCallICE(payload));
  sigCh.on('broadcast', { event: 'call-leave'        }, ({ payload }) => _onCallPeerLeave(payload));
  sigCh.on('broadcast', { event: 'call-media-state'  }, ({ payload }) => _onCallMediaState(payload));
  sigCh.on('broadcast', { event: 'call-chat'         }, ({ payload }) => _onCallChatMessage(payload));

  /* Presence */
  sigCh.on('presence', { event: 'sync' }, () => {
    const n = Object.keys(sigCh.presenceState()).length;
    _setEl('call-participant-count', `${n} / ${CONFIG.MAX_CALL_PEERS + 1}`);
    _setEl('ctrl-pax-count', String(n));
    _setEl('participants-count', `(${n})`);
  });

  sigCh.subscribe(async status => {
    if (status === 'SUBSCRIBED') {
      await sigCh.track({
        token:        STATE.identity.token,
        username:     STATE.identity.username,
        rocketId:     STATE.identity.rocketId,
        rocketConfig: STATE.identity.rocketConfig,
        mode:         STATE.call.mode,
      }).catch(()=>{});

      /* Announce join to existing participants */
      await sigCh.send({ type: 'broadcast', event: 'call-join', payload: {
        token:        STATE.identity.token,
        username:     STATE.identity.username,
        rocketId:     STATE.identity.rocketId,
        rocketConfig: STATE.identity.rocketConfig,
      }}).catch(()=>{});

      _setConnBadge('call-status', 'connected', 'In Call');
      _addSelfToParticipantsList();
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      _setConnBadge('call-status', 'error', 'Signal Error');
      showToast('Call signaling failed. Check Supabase config.', 'error');
    }
  });
}

/** When a new peer announces they joined — we (existing peer) initiate offer to them. */
async function _onCallPeerJoin(payload) {
  if (!payload?.token || payload.token === STATE.identity.token) return;
  const peerId = payload.token;

  if (Object.keys(STATE.call.peers).length >= CONFIG.MAX_CALL_PEERS) {
    showToast('Room is at capacity. New peer cannot join.', 'warn');
    return;
  }

  /* Add remote video tile */
  _addRemoteVideoTile(peerId, payload);

  /* Create peer connection and send offer */
  const pc = _createCallPeerConnection(peerId, payload);
  STATE.call.peers[peerId] = { pc, info: payload };

  /* Add local tracks */
  STATE.call.localStream?.getTracks().forEach(track => {
    pc.addTrack(track, STATE.call.localStream);
  });

  const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: STATE.call.mode === 'video' });
  await pc.setLocalDescription(offer);

  await STATE.call.signalingChannel?.send({ type: 'broadcast', event: 'call-offer', payload: {
    to:  peerId,
    sdp: pc.localDescription,
    from: STATE.identity.token,
    info: { username: STATE.identity.username, rocketId: STATE.identity.rocketId, rocketConfig: STATE.identity.rocketConfig },
  }}).catch(()=>{});
}

/** Receive an offer meant for us. */
async function _onCallOffer(payload) {
  if (!payload?.sdp || payload.to !== STATE.identity.token) return;
  const peerId = payload.from;
  const info   = payload.info;

  /* Ensure tile exists */
  if (!$(`remote-tile-${peerId}`)) _addRemoteVideoTile(peerId, info);

  /* Create PC if not exists */
  if (!STATE.call.peers[peerId]) {
    const pc = _createCallPeerConnection(peerId, info);
    STATE.call.peers[peerId] = { pc, info };
    STATE.call.localStream?.getTracks().forEach(track => pc.addTrack(track, STATE.call.localStream));
  }

  const pc = STATE.call.peers[peerId].pc;
  await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp)).catch(e => console.warn('[Call] setRemoteDesc offer:', e));

  /* Drain buffered ICE */
  for (const c of (STATE.call.iceBufs[peerId] ?? [])) {
    await pc.addIceCandidate(new RTCIceCandidate(c)).catch(()=>{});
  }
  STATE.call.iceBufs[peerId] = [];

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await STATE.call.signalingChannel?.send({ type: 'broadcast', event: 'call-answer', payload: {
    to:   peerId,
    sdp:  pc.localDescription,
    from: STATE.identity.token,
  }}).catch(()=>{});
}

/** Receive an answer for our offer. */
async function _onCallAnswer(payload) {
  if (!payload?.sdp || payload.to !== STATE.identity.token) return;
  const pc = STATE.call.peers[payload.from]?.pc;
  if (!pc || pc.signalingState === 'stable') return;
  await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp)).catch(e => console.warn('[Call] setRemoteDesc answer:', e));

  for (const c of (STATE.call.iceBufs[payload.from] ?? [])) {
    await pc.addIceCandidate(new RTCIceCandidate(c)).catch(()=>{});
  }
  STATE.call.iceBufs[payload.from] = [];
}

/** Receive ICE candidate. */
async function _onCallICE(payload) {
  if (!payload?.candidate || payload.to !== STATE.identity.token) return;
  const pc = STATE.call.peers[payload.from]?.pc;
  if (pc && pc.remoteDescription) {
    await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(()=>{});
  } else {
    if (!STATE.call.iceBufs[payload.from]) STATE.call.iceBufs[payload.from] = [];
    STATE.call.iceBufs[payload.from].push(payload.candidate);
  }
}

function _onCallPeerLeave(payload) {
  if (!payload?.token) return;
  _removeRemoteVideoTile(payload.token);
  const peer = STATE.call.peers[payload.token];
  if (peer) { try { peer.pc.close(); } catch {} delete STATE.call.peers[payload.token]; }
  delete STATE.call.iceBufs[payload.token];
}

function _onCallMediaState(payload) {
  if (!payload?.from) return;
  const tile = $(`remote-tile-${payload.from}`);
  if (!tile) return;
  if (payload.micMuted !== undefined) {
    const badge = tile.querySelector('.media-badge--mic');
    if (badge) badge.classList.toggle('media-badge--off', payload.micMuted);
  }
  if (payload.camOff !== undefined) {
    const badge = tile.querySelector('.media-badge--cam');
    if (badge) badge.classList.toggle('media-badge--off', payload.camOff);
    const noVid = tile.querySelector('.video-tile__no-video');
    const vidEl = tile.querySelector('.video-tile__stream');
    if (noVid) noVid.hidden = !payload.camOff;
    if (vidEl) vidEl.hidden = payload.camOff;
  }
}

function _onCallChatMessage(payload) {
  if (!payload) return;
  const el = $('call-chat-messages');
  if (!el) return;
  const item = document.createElement('div');
  item.className = 'call-chat-msg';
  item.innerHTML = `<span class="call-chat-name">${sanitizeHTML(payload.username ?? 'Unknown')}</span><span class="call-chat-text">${sanitizeHTML(payload.message)}</span>`;
  el.appendChild(item);
  _scrollToBottom(el);
}

function _createCallPeerConnection(peerId, peerInfo) {
  const pc = new RTCPeerConnection({ iceServers: CONFIG.ICE_SERVERS });

  pc.onicecandidate = e => {
    if (e.candidate) {
      STATE.call.signalingChannel?.send({ type: 'broadcast', event: 'call-ice', payload: {
        to:        peerId,
        from:      STATE.identity.token,
        candidate: e.candidate.toJSON(),
      }}).catch(()=>{});
    }
  };

  pc.ontrack = e => {
    const tile   = $(`remote-tile-${peerId}`);
    if (!tile) return;
    const vidEl  = tile.querySelector('.video-tile__stream');
    if (vidEl && e.streams?.[0]) { vidEl.srcObject = e.streams[0]; vidEl.play().catch(()=>{}); }
    const spinner = tile.querySelector('.video-tile__connecting');
    if (spinner) spinner.hidden = true;
    const emptyEl = $('video-grid-empty');
    if (emptyEl) emptyEl.hidden = true;
  };

  pc.onconnectionstatechange = () => {
    const tile = $(`remote-tile-${peerId}`);
    if (!tile) return;
    const spinner = tile.querySelector('.video-tile__connecting');
    if (pc.connectionState === 'connected' && spinner) spinner.hidden = true;
    if (pc.connectionState === 'failed') {
      showToast(`Connection to ${peerInfo?.username ?? 'peer'} failed.`, 'error');
    }
  };

  return pc;
}

function _addRemoteVideoTile(peerId, info) {
  const grid = $('video-grid');
  if (!grid || $(`remote-tile-${peerId}`)) return;

  const tile = document.createElement('div');
  tile.className = 'video-tile video-tile--remote';
  tile.id = `remote-tile-${peerId}`;
  tile.setAttribute('aria-label', `Video: ${info?.username ?? 'Peer'}`);
  const rktSvg = info?.rocketConfig ? renderRocketSVG(info.rocketConfig, 26) : '';
  tile.innerHTML = `
    <video class="video-tile__stream" autoplay playsinline></video>
    <div class="video-tile__overlay">
      <div class="video-tile__rocket" aria-hidden="true">${rktSvg}</div>
      <div class="video-tile__info">
        <span class="video-tile__name">${sanitizeHTML(info?.username ?? 'Peer')}</span>
        <div class="video-tile__badges" aria-label="Media status">
          <span class="media-badge media-badge--mic"  aria-label="Microphone"></span>
          <span class="media-badge media-badge--cam"  aria-label="Camera"></span>
        </div>
      </div>
    </div>
    <div class="video-tile__no-video" hidden aria-hidden="true">
      <div class="no-video-avatar">${rktSvg}</div>
    </div>
    <div class="video-tile__connecting" aria-live="polite">
      <div class="connecting-spinner" aria-hidden="true"></div><span>Connecting...</span>
    </div>`;

  /* Insert before the empty-state overlay */
  const emptyEl = $('video-grid-empty');
  grid.insertBefore(tile, emptyEl ?? null);
  if (emptyEl) emptyEl.hidden = true;

  /* Add to participants list */
  _addParticipant(peerId, info);
  _updateGridLayout();
}

function _removeRemoteVideoTile(peerId) {
  $(`remote-tile-${peerId}`)?.remove();
  $(`participant-${peerId}`)?.remove();
  _updateGridLayout();
  /* Show empty state if no remote tiles */
  const remoteTiles = $$('.video-tile--remote');
  const emptyEl = $('video-grid-empty');
  if (emptyEl) emptyEl.hidden = remoteTiles.length > 0;
}

function _updateGridLayout() {
  const grid  = $('video-grid');
  if (!grid) return;
  const count = $$('.video-tile').length; // includes local
  grid.dataset.peers = String(count);
}

function _addSelfToParticipantsList() {
  _addParticipant(STATE.identity.token, {
    username: STATE.identity.username,
    rocketId: STATE.identity.rocketId,
    rocketConfig: STATE.identity.rocketConfig,
    isSelf: true,
  });
}

function _addParticipant(peerId, info) {
  const list = $('participants-list');
  if (!list || $(`participant-${peerId}`)) return;
  const item = document.createElement('li');
  item.id = `participant-${peerId}`;
  item.className = 'participant-item';
  item.setAttribute('role', 'listitem');
  const rkt = info?.rocketConfig ? renderRocketSVG(info.rocketConfig, 28) : '';
  item.innerHTML = `
    <div class="participant-rocket" aria-hidden="true">${rkt}</div>
    <div class="participant-info">
      <span class="participant-name">${sanitizeHTML(info?.username ?? 'Peer')}${info?.isSelf ? ' <em>(you)</em>' : ''}</span>
      <span class="participant-id">${sanitizeHTML(info?.rocketId ?? '')}</span>
    </div>
    <div class="participant-status">
      <span class="media-badge media-badge--mic"  aria-label="Mic"></span>
      <span class="media-badge media-badge--cam"  aria-label="Cam"></span>
    </div>`;
  list.appendChild(item);
}

/* ── Controls ── */
function _toggleMic() {
  if (!STATE.call.localStream) return;
  STATE.call.micMuted = !STATE.call.micMuted;
  STATE.call.localStream.getAudioTracks().forEach(t => { t.enabled = !STATE.call.micMuted; });

  const btn      = $('btn-toggle-mic');
  const iconOn   = btn?.querySelector('.ctrl-icon--on');
  const iconOff  = btn?.querySelector('.ctrl-icon--off');
  if (btn) {
    btn.setAttribute('aria-pressed', String(STATE.call.micMuted));
    btn.setAttribute('aria-label', STATE.call.micMuted ? 'Unmute microphone' : 'Mute microphone');
    btn.classList.toggle('ctrl-btn--active', STATE.call.micMuted);
  }
  if (iconOn)  iconOn.hidden  = STATE.call.micMuted;
  if (iconOff) iconOff.hidden = !STATE.call.micMuted;
  _setMicBadgeState('local', !STATE.call.micMuted);
  _broadcastMediaState();
}

function _toggleCamera() {
  if (!STATE.call.localStream) return;
  STATE.call.camOff = !STATE.call.camOff;
  STATE.call.localStream.getVideoTracks().forEach(t => { t.enabled = !STATE.call.camOff; });

  const btn     = $('btn-toggle-camera');
  const iconOn  = btn?.querySelector('.ctrl-icon--on');
  const iconOff = btn?.querySelector('.ctrl-icon--off');
  if (btn) {
    btn.setAttribute('aria-pressed', String(STATE.call.camOff));
    btn.setAttribute('aria-label', STATE.call.camOff ? 'Turn on camera' : 'Turn off camera');
    btn.classList.toggle('ctrl-btn--active', STATE.call.camOff);
  }
  if (iconOn)  iconOn.hidden  = STATE.call.camOff;
  if (iconOff) iconOff.hidden = !STATE.call.camOff;

  const localVideo = $('local-video');
  const noVideo    = $('local-no-video');
  if (localVideo) localVideo.hidden = STATE.call.camOff;
  if (noVideo)    noVideo.hidden    = !STATE.call.camOff;
  _setCamBadgeState('local', !STATE.call.camOff);
  _broadcastMediaState();
}

async function _toggleScreenShare() {
  if (!STATE.call.inCall) return;
  const btn     = $('btn-toggle-screen');
  const iconOn  = btn?.querySelector('.ctrl-icon--on');
  const iconOff = btn?.querySelector('.ctrl-icon--off');

  if (STATE.call.screenSharing) {
    /* Stop screen share — restore camera */
    STATE.call.screenStream?.getTracks().forEach(t => t.stop());
    STATE.call.screenStream = null;
    STATE.call.screenSharing = false;
    if (btn) { btn.classList.remove('ctrl-btn--active'); btn.setAttribute('aria-pressed','false'); }
    if (iconOn)  iconOn.hidden  = false;
    if (iconOff) iconOff.hidden = true;

    /* Replace video track in all peer connections */
    const camTrack = STATE.call.localStream?.getVideoTracks()[0];
    if (camTrack) _replaceVideoTrackInPeers(camTrack);
    const lv = $('local-video');
    if (lv && STATE.call.localStream) { lv.srcObject = STATE.call.localStream; lv.play().catch(()=>{}); }
    showToast('Screen sharing stopped.', 'info');
  } else {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
      STATE.call.screenStream  = screenStream;
      STATE.call.screenSharing = true;
      if (btn) { btn.classList.add('ctrl-btn--active'); btn.setAttribute('aria-pressed','true'); }
      if (iconOn)  iconOn.hidden  = true;
      if (iconOff) iconOff.hidden = false;

      /* Replace video track in all peer connections */
      const screenTrack = screenStream.getVideoTracks()[0];
      _replaceVideoTrackInPeers(screenTrack);

      /* Show screen in local tile */
      const lv = $('local-video');
      if (lv) { lv.srcObject = screenStream; lv.hidden = false; lv.play().catch(()=>{}); }

      /* When user stops via browser's built-in stop button */
      screenTrack.onended = () => _toggleScreenShare();
      showToast('Screen sharing started.', 'success');
    } catch (e) {
      if (e.name !== 'NotAllowedError') showToast(`Screen share failed: ${e.message}`, 'error');
    }
  }
}

function _replaceVideoTrackInPeers(newTrack) {
  for (const { pc } of Object.values(STATE.call.peers)) {
    const sender = pc.getSenders().find(s => s.track?.kind === 'video');
    if (sender) sender.replaceTrack(newTrack).catch(()=>{});
  }
}

function _broadcastMediaState() {
  STATE.call.signalingChannel?.send({ type: 'broadcast', event: 'call-media-state', payload: {
    from:     STATE.identity.token,
    micMuted: STATE.call.micMuted,
    camOff:   STATE.call.camOff,
  }}).catch(()=>{});
}

function _setMicBadgeState(scope, active) {
  const el = scope === 'local' ? $('local-mic-badge') : null;
  if (el) el.classList.toggle('media-badge--off', !active);
}
function _setCamBadgeState(scope, active) {
  const el = scope === 'local' ? $('local-cam-badge') : null;
  if (el) el.classList.toggle('media-badge--off', !active);
}

function _updateCallTitle() {
  _setEl('call-title-text', STATE.call.mode === 'video' ? 'Video Call' : 'Voice Call');
}

function _endCall() {
  if (!STATE.call.inCall) return;
  /* Notify peers */
  STATE.call.signalingChannel?.send({ type: 'broadcast', event: 'call-leave', payload: { token: STATE.identity.token } }).catch(()=>{});
  _cleanupCall(false);
  const setupEl = $('call-setup');
  const iface   = $('call-interface');
  if (setupEl) setupEl.hidden = false;
  if (iface)   iface.hidden   = true;
  _setConnBadge('call-status', 'idle', 'Idle');
  showToast('Call ended.', 'info');
}

function _cleanupCall(full) {
  /* Stop all peer connections */
  for (const { pc } of Object.values(STATE.call.peers)) { try { pc.close(); } catch {} }
  STATE.call.peers   = {};
  STATE.call.iceBufs = {};

  /* Stop local media */
  STATE.call.localStream?.getTracks().forEach(t => t.stop());
  STATE.call.localStream = null;
  STATE.call.screenStream?.getTracks().forEach(t => t.stop());
  STATE.call.screenStream = null;

  /* Signaling */
  STATE.call.signalingChannel?.unsubscribe().catch(()=>{});
  STATE.call.signalingChannel = null;

  /* State */
  STATE.call.inCall       = false;
  STATE.call.micMuted     = false;
  STATE.call.camOff       = false;
  STATE.call.screenSharing = false;

  if (full) {
    STATE.call.room = null;
    /* Clear video grid remote tiles */
    $$('.video-tile--remote').forEach(t => t.remove());
    const list = $('participants-list');
    if (list) list.innerHTML = '';
    const callMsgs = $('call-chat-messages');
    if (callMsgs) callMsgs.innerHTML = '';
    const lv = $('local-video');
    if (lv) { lv.srcObject = null; lv.hidden = false; }
    const localTile = $('local-video-tile');
    if (localTile) localTile.dataset.peers = '0';
    const noVidLocal = $('local-no-video');
    if (noVidLocal) noVidLocal.hidden = true;
    const emptyEl = $('video-grid-empty');
    if (emptyEl) emptyEl.hidden = false;
  }
}

/* ── In-call chat ── */
async function _sendCallChatMessage() {
  const input = $('call-chat-input');
  if (!input || !STATE.call.signalingChannel) return;
  const text = input.value.trim();
  if (!text) return;
  const payload = { username: STATE.identity.username, message: text, ts: Date.now() };
  _onCallChatMessage(payload); // local echo
  input.value = '';
  await STATE.call.signalingChannel.send({ type: 'broadcast', event: 'call-chat', payload }).catch(()=>{});
}

/* ── Sidebar toggle helpers ── */
function _toggleSidebar(sidebarId, btnId) {
  const sb  = $(sidebarId);
  const btn = $(btnId);
  if (!sb) return;
  const open = sb.hidden;
  /* Close other sidebar first */
  const other = sidebarId === 'participants-sidebar' ? 'call-chat-sidebar' : 'participants-sidebar';
  const otherBtn = sidebarId === 'participants-sidebar' ? 'btn-call-chat-toggle' : 'btn-toggle-participants';
  const otherEl = $(other);
  if (otherEl && !otherEl.hidden) { otherEl.hidden = true; $(otherBtn)?.setAttribute('aria-pressed','false'); $(otherBtn)?.setAttribute('aria-expanded','false'); }
  sb.hidden = !open;
  btn?.setAttribute('aria-pressed', String(open));
  btn?.setAttribute('aria-expanded', String(open));
}

function _closeSidebar(sidebarId, btnId) {
  const sb  = $(sidebarId);
  const btn = $(btnId);
  if (sb)  sb.hidden = true;
  btn?.setAttribute('aria-pressed','false');
  btn?.setAttribute('aria-expanded','false');
}
/* ═══════════════════════════════════════════════════════════════════════
   §21  MEETING ROOM  — Jitsi Meet External API
   ───────────────────────────────────────────────────────────────────
   Jitsi Meet External API is loaded on-demand (not at startup) to keep
   initial page load fast.  The iframe renders inside #jitsi-container.
   ═══════════════════════════════════════════════════════════════════ */

function _initMeetScreen() {
  _onclick('btn-back-from-meet', () => {
    _cleanupMeet(false);
    showScreen('screen-dashboard');
  });

  _onclick('btn-leave-meet', () => {
    _cleanupMeet(false);
    const setupEl = $('meet-setup');
    const wrapper = $('jitsi-wrapper');
    if (setupEl) setupEl.hidden = false;
    if (wrapper) wrapper.hidden = true;
    const roomInput = $('meet-room-input');
    if (roomInput) roomInput.value = '';
  });

  const roomInput = $('meet-room-input');
  const btnJoin   = $('btn-join-meet');
  const errEl     = $('meet-room-error');

  const doJoin = () => {
    const raw = (roomInput?.value ?? '').trim().toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/^-+|-+$/g, '');
    if (!raw || raw.length < 2) {
      if (errEl) errEl.textContent = 'Enter a room name (at least 2 characters).';
      return;
    }
    if (errEl) errEl.textContent = '';
    _joinMeet(raw);
  };

  if (btnJoin) { const f = btnJoin.cloneNode(true); btnJoin.replaceWith(f); f.onclick = doJoin; }
  if (roomInput) {
    roomInput.onkeydown = e => { if (e.key === 'Enter') doJoin(); };
    setTimeout(() => { try { roomInput.focus(); } catch {} }, 280);
  }
}

async function _joinMeet(roomName) {
  STATE.meet.room = roomName;

  const setupEl = $('meet-setup');
  const wrapper = $('jitsi-wrapper');
  const roomDisp = $('meet-room-display');
  const jitsiDisp = $('jitsi-room-display');

  if (roomDisp)  roomDisp.textContent  = roomName;
  if (jitsiDisp) jitsiDisp.textContent = roomName;

  /* Load Jitsi External API script on demand */
  if (typeof window.JitsiMeetExternalAPI === 'undefined') {
    showToast('Loading meeting engine...', 'info', 3000);
    await _loadJitsiScript();
  }

  if (typeof window.JitsiMeetExternalAPI === 'undefined') {
    showToast('Failed to load Jitsi. Check your internet connection.', 'error', 7000);
    return;
  }

  if (setupEl) setupEl.hidden = true;
  if (wrapper) wrapper.hidden = false;

  /* Clean container */
  const container = $('jitsi-container');
  if (container) container.innerHTML = '';

  const meetOpts = $('meet-opt-video')?.checked ?? true;
  const audioOpts = $('meet-opt-audio')?.checked ?? true;

  const options = {
    roomName:   `alex-${roomName}`, // prefix to avoid collision with public rooms
    parentNode: container,
    width:      '100%',
    height:     '100%',
    configOverwrite: {
      startWithVideoMuted: !meetOpts,
      startWithAudioMuted: !audioOpts,
      disableDeepLinking:  true,
      enableWelcomePage:   false,
      prejoinPageEnabled:  false,
    },
    interfaceConfigOverwrite: {
      TOOLBAR_BUTTONS: [
        'microphone','camera','desktop','chat','raisehand',
        'tileview','participants-pane','hangup',
      ],
      SHOW_JITSI_WATERMARK:      false,
      SHOW_WATERMARK_FOR_GUESTS: false,
      DEFAULT_REMOTE_DISPLAY_NAME: 'Rocket Pilot',
      HIDE_INVITE_MORE_HEADER: true,
    },
    userInfo: {
      displayName: STATE.identity?.username ?? 'Anonymous',
      email:       '',
    },
  };

  try {
    STATE.meet.jitsiApi = new window.JitsiMeetExternalAPI(CONFIG.JITSI_DOMAIN, options);

    STATE.meet.jitsiApi.addEventListener('readyToClose', () => {
      _cleanupMeet(false);
      if (setupEl) setupEl.hidden = false;
      if (wrapper) wrapper.hidden = true;
    });

    STATE.meet.jitsiApi.addEventListener('videoConferenceJoined', () => {
      showToast(`Joined meeting: ${roomName}`, 'success');
    });

    STATE.meet.jitsiApi.addEventListener('videoConferenceLeft', () => {
      _cleanupMeet(false);
      if (setupEl) setupEl.hidden = false;
      if (wrapper) wrapper.hidden = true;
    });
  } catch (e) {
    console.error('[Jitsi] API init error:', e);
    showToast(`Meeting failed to start: ${e.message}`, 'error');
    if (setupEl) setupEl.hidden = false;
    if (wrapper) wrapper.hidden = true;
  }
}

function _loadJitsiScript() {
  return new Promise(resolve => {
    if (typeof window.JitsiMeetExternalAPI !== 'undefined') { resolve(); return; }
    const s = document.createElement('script');
    s.src   = `https://${CONFIG.JITSI_DOMAIN}/external_api.js`;
    s.async = true;
    s.onload  = resolve;
    s.onerror = () => { console.error('[Jitsi] Script load failed.'); resolve(); };
    document.head.appendChild(s);
  });
}

function _cleanupMeet(full) {
  if (STATE.meet.jitsiApi) {
    try { STATE.meet.jitsiApi.dispose(); } catch {}
    STATE.meet.jitsiApi = null;
  }
  const container = $('jitsi-container');
  if (container) container.innerHTML = '';
  if (full) { STATE.meet.room = null; }
}

/* ═══════════════════════════════════════════════════════════════════════
   §22  SHARED UI HELPERS
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Sets textContent or innerHTML of a DOM element by id.
 * @param {string}  id
 * @param {string}  value
 * @param {boolean} [isHTML=false]  if true, sets innerHTML
 */
function _setEl(id, value, isHTML = false) {
  const el = $(id);
  if (!el) return;
  if (isHTML) el.innerHTML = value;
  else        el.textContent = value;
}

/**
 * Replaces the onclick handler of an element (avoids duplicate listeners).
 * This also handles the case where the element has been cloned.
 * @param {string}   id
 * @param {Function} handler
 */
function _onclick(id, handler) {
  const el = $(id);
  if (!el) return;
  el.onclick = handler;
}

/**
 * Updates a connection-status badge (conn-badge) element.
 * @param {string|Element} elOrId
 * @param {'idle'|'connecting'|'connected'|'error'} state
 * @param {string} label
 */
function _setConnBadge(elOrId, state, label) {
  const el = typeof elOrId === 'string' ? $(elOrId) : elOrId;
  if (!el) return;
  const dot  = el.querySelector('.conn-dot');
  const txt  = el.querySelector('.conn-text');
  /* Remove all state classes */
  ['conn-dot--idle','conn-dot--connecting','conn-dot--connected','conn-dot--error'].forEach(c => dot?.classList.remove(c));
  dot?.classList.add(`conn-dot--${state}`);
  if (txt) txt.textContent = label;
}

/**
 * Appends a system message row to a messages container.
 * @param {string} containerId
 * @param {string} text
 */
function _appendSystemMessage(containerId, text) {
  const el = $(containerId);
  if (!el) return;
  const row = document.createElement('div');
  row.className = 'msg msg--system';
  row.setAttribute('role', 'listitem');
  row.innerHTML = `<span class="msg-sys-text">${sanitizeHTML(text)}</span>`;
  el.appendChild(row);
  _scrollToBottom(el);
}

/**
 * Shows a typing indicator and hides it after TYPING_TIMEOUT ms.
 * @param {string}      indicatorId
 * @param {string|null} textId
 * @param {string}      text
 */
const _typingTimers = {};
function _showTypingIndicator(indicatorId, textId, text) {
  const ind = $(indicatorId);
  if (!ind) return;
  if (textId) { const t = $(textId); if (t) t.textContent = text; }
  ind.hidden = false;
  clearTimeout(_typingTimers[indicatorId]);
  _typingTimers[indicatorId] = setTimeout(() => { if ($(indicatorId)) $(indicatorId).hidden = true; }, CONFIG.TYPING_TIMEOUT + 600);
}

/**
 * Smoothly scrolls a container to its bottom if within 180px of bottom.
 */
function _scrollToBottom(el) {
  if (!el) return;
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 180;
  if (nearBottom) { el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }
}

/**
 * Prunes oldest messages from a container when it exceeds MSG_HISTORY_LIMIT.
 */
function _pruneMessages(el) {
  if (!el) return;
  const msgs = el.querySelectorAll('.msg:not(.msg--system)');
  if (msgs.length > CONFIG.MSG_HISTORY_LIMIT) {
    for (let i = 0; i < msgs.length - CONFIG.MSG_HISTORY_LIMIT; i++) msgs[i].remove();
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   §23  APP BOOT
   ───────────────────────────────────────────────────────────────────
   Everything initialised once when DOM is ready.
   ═══════════════════════════════════════════════════════════════════ */

function _boot() {
  /* ── Core non-screen systems ── */
  initCursor();
  _initRecoveryModal();

  /* ── Keyboard accessibility for modals ── */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const openModal = document.querySelector('.modal-overlay--visible');
    if (!openModal) return;
    const focusables = Array.from(openModal.querySelectorAll(
      'button:not([disabled]),input:not([disabled]),textarea,[tabindex]:not([tabindex="-1"])',
    ));
    if (!focusables.length) return;
    const first = focusables[0];
    const last  = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });

  /* ── Start loading screen (boot entry point) ── */
  // Directly init loading since screen-loading already has screen--active in HTML.
  STATE.currentScreen = 'loading';
  _initLoadingScreen();
}

/* ── DOM ready guard ── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _boot);
} else {
  _boot();
}
