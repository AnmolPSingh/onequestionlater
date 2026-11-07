import Lenis from 'lenis';
import { createScene } from './scene.js';
import * as shapes from './shapes.js';
import { createScore } from './score.js';
import { startCursor } from './cursor.js';
import { playLoader } from './loader.js';
import { isCalm } from './calm.js';
import { quietBehindText } from './quiet.js';
import { createWhale } from './whale.js';

// The conductor: one loop reads the scroll position and drives the figure, the particle morphs,
// the flight through the years and the walk into the light. The HTML is
// already the finished page, so reduced motion just never starts any of it.
const PARTICLES = innerWidth < 640 ? 26000 : 58000; // a phone builds every shape on a slower CPU, so it gets fewer dots
const GLOBE_SHIFT = 0.2; // of the screen's half-width, so the globe sits clear of its sentence; .orbit in base.css moves with it
const DESERT_AHEAD = 6; // screens before the close at which its 350 KB of dots start to download
const FORM_SECONDS = 2.8;
const LEAN = [0.07, 0.035]; // radians the figure leans toward the light, sideways and up: about 4 and 2 degrees
const HERO_TURN_SCROLL = 1.05; // screens of scroll it takes me to turn from facing you to the three-quarter slant, toward the words
const HERO_ASIDE_SCROLL = 0.45;
const PAIR_GAP = 0.018; // of the screen's width, between two pictures that share a scene
const RUN_UP = 0.6; // stops of track before the first scene
const RUN_OUT = 0.2;
const FLY_TAIL = 1.4; // screens after the last scene: the stars gather into the words and hold
const WALK_END = 3.97; // just short of the horizon; keep under 1 + FAR in scene.js
const CLOSE_HOLD = 0.3; // screens the landscape holds before the walk, long enough to read the line beside me
const CLOSE_WALK = 1.4; // screens the walk into the light takes: with the hold, about two scrolls from the line to white
const CLOSE_END = CLOSE_HOLD + CLOSE_WALK + 0.6; // screens into the close where the contact details are fully in
const CLOSE_IDLE_MS = 20000; // if nobody scrolls on from the line, the walk carries on by itself
const CLOSE_AUTO_SECONDS = 5;
const root = document.documentElement;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const whenIdle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 500 }) : setTimeout(fn, 60));

const score = createScore();
let formStart = null; // when the portrait starts to form, which is when the loader hands over
let markReady;
const sceneReady = new Promise((resolve) => { markReady = resolve; });
const gated = root.classList.contains('loading');
playLoader(sceneReady, (withSound) => score.enter(withSound)).then(() => { formStart = performance.now(); });
const session = document.querySelector('[data-session]');
const clipLinks = new Map([...session.querySelectorAll('[data-clip]')].map((a) => [a.dataset.clip, a]));

/* ---------- Motion ---------- */

function splitWords(el) {
  const text = el.textContent;
  el.textContent = '';
  const words = text.trim().split(/\s+/).map((word) => {
    const span = document.createElement('span');
    span.className = 'word';
    span.textContent = word;
    el.append(span, ' ');
    return span;
  });
  return { el, text, words };
}

// Each moment flies in from its own side: a spiral of angles, so no two neighbours come the same way.
function buildStops() {
  return [...session.querySelectorAll('.moment:not(.quiet)')].map((el, i) => ({
    el,
    id: el.dataset.moment,
    visual: el.querySelector('.moment-visual'),
    also: el.querySelector('.moment-visual.also'),
    text: el.querySelector('.moment-text'),
    dx: Math.cos(i * 2.4),
    dy: Math.sin(i * 2.4),
    side: el.dataset.side === 'right' ? 1 : -1,
    overlap: parseFloat(el.dataset.overlap) || 0,
    shift: 0,
    alsoShift: 0,
    on: false,
  }));
}

const ramp = (v, a, b) => clamp((v - a) / (b - a));

// Two pictures share the focus side by side, or with the second tucked behind the first.
function measurePair(stop) {
  const first = stop.visual.offsetWidth;
  const second = stop.also.offsetWidth;
  const gap = stop.overlap ? -stop.overlap * second : innerWidth * PAIR_GAP;
  stop.shift = (-stop.side * (second + gap)) / 2;
  stop.alsoShift = (stop.side * (first + gap)) / 2;
}

function place(visual, t, dx, dy, tiltX, tiltY, vw, vh, shift = 0) {
  // Far away it's small and off to one side; it hangs at the focus, then passes the camera and is gone.
  const push = Math.sign(t) * Math.abs(t) ** 1.6 * 2.2;
  const z = push < 0 ? push * 1500 : push * 620;
  const out = Math.abs(push) * (t < 0 ? 0.12 : 0.3);
  const here = 1 - clamp(Math.abs(t) * 2);
  visual.style.transform = `translate(calc(-50% + ${shift.toFixed(1)}px), -50%) perspective(1000px) translate3d(${(dx * out * vw).toFixed(1)}px, ${(dy * out * vh).toFixed(1)}px, ${z.toFixed(1)}px) rotateY(${(tiltX * (2 + here * 5) + t * 6).toFixed(2)}deg) rotateX(${(tiltY * (2 + here * 4)).toFixed(2)}deg)`;
}

// s runs 0 to 1 while the playhead is inside this scene's slot, and nothing of it shows outside that.
function flyStop(stop, s, index, count, vw, vh, tiltX, tiltY) {
  const on = s > -0.02 && s < 1.08;
  if (on !== stop.on) {
    stop.on = on;
    stop.el.classList.toggle('live', on);
    if (on && stop.also) measurePair(stop);
  }
  if (!on) return;
  // A pair arrives and leaves in opposite directions, each away from the other.
  place(stop.visual, s - 0.46, stop.also ? -stop.side : stop.dx, stop.also ? -0.2 : stop.dy, tiltX, tiltY, vw, vh, stop.shift);
  const fade = ramp(s, 0, 0.2) * (1 - ramp(s, 0.8, 1.06));
  stop.visual.style.opacity = fade;
  stop.visual.style.zIndex = count - index;
  if (stop.also) {
    place(stop.also, s - 0.46, stop.side, 0.45, tiltX, tiltY, vw, vh, stop.alsoShift);
    stop.also.style.opacity = fade;
    stop.also.style.zIndex = count - index - 1;
  }
  stop.text.style.opacity = ramp(s, 0, 0.08) * (1 - ramp(s, 0.9, 1));
  stop.text.style.transform = `translateY(${((s - 0.5) * 16).toFixed(1)}px)`;
}

async function startMotion() {
  const scene = createScene(PARTICLES);
  if (!scene) { root.classList.add('no-scene'); markReady(); return; }

  let figure;
  let land;
  try {
    const [p, l] = await Promise.all(['/hero/views.bin', '/hero/land.bin'].map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url} returned ${res.status}`);
      return res.arrayBuffer();
    }));
    figure = shapes.readViews(p);
    land = new Uint8Array(l);
  } catch (err) {
    console.warn('Particle data unavailable; showing the static page.', err);
    scene.stop();
    root.classList.add('no-scene');
    markReady();
    return;
  }

  const sections = [...document.querySelectorAll('[data-shape]')];
  const portraitEl = document.querySelector('[data-portrait]');
  const closeEl = document.querySelector('[data-close]');
  const closeTitle = document.querySelector('[data-close-title]');
  const closeLead = document.querySelector('[data-close-lead]');
  const closeDetails = document.querySelector('[data-close-details]');
  const whiteLayer = document.querySelector('[data-white]');
  const ghost = document.querySelector('[data-ghost]');
  const head = session.querySelector('[data-head]');
  const pin = session.querySelector('[data-pin]');
  const nextLine = session.querySelector('[data-next-line]');
  const nextMark = session.querySelector('.session-next');
  const arrangement = session.querySelector('[data-arrangement]');
  const firstClip = session.querySelector('.clip');
  const stops = buildStops();
  const spots = [...document.querySelectorAll('[data-spot]')].map((el) => ({ el, x: 0, y: 0, o: 0 }));
  const lenis = new Lenis({ lerp: 0.09, anchors: true });

  document.body.prepend(scene.canvas);
  const quiet = quietBehindText(scene.canvas);
  root.classList.add('scene-on');
  await new Promise(requestAnimationFrame); // let the pinned heights apply before measuring

  const toUnits = (px, py) => {
    const aspect = innerWidth / innerHeight;
    return [((px / innerWidth) * 2 - 1) * aspect, 1 - (py / innerHeight) * 2];
  };

  let tops = [];
  let sessionTop = 0;
  let sessionRange = 1;
  let slotWidth = 1;
  let nextTop = 0;
  let closeTop = 0;
  let heroPan = [0, 0];
  let heroEnd = { x: 0, y: 0, zoom: 1 };
  let focus = [0, 0];
  let desertPoints = null;
  let desertAsked = false;
  let placeDesert = () => {};
  let layoutRun = 0;

  const layout = () => {
    const aspect = innerWidth / innerHeight;
    const wide = innerWidth >= 900;
    scene.resize();

    // Measured with the page at rest, so scroll offsets are stable.
    const y = scrollY;
    tops = sections.map((s) => s.getBoundingClientRect().top + y);
    sessionTop = session.getBoundingClientRect().top + y;
    sessionRange = Math.max(1, session.offsetHeight - innerHeight * (1 + FLY_TAIL));
    nextTop = nextMark.getBoundingClientRect().top + y;
    slotWidth = firstClip.offsetWidth / (parseFloat(firstClip.style.getPropertyValue('--b')) - parseFloat(firstClip.style.getPropertyValue('--a')));
    closeTop = closeEl.getBoundingClientRect().top + y;

    const fig = portraitEl.getBoundingClientRect();
    const [bx, by] = toUnits(fig.left, fig.top + y);
    const bw = (fig.width / innerWidth) * 2 * aspect;
    const bh = (fig.height / innerHeight) * 2;
    heroPan = [bx + bw / 2, by - shapes.HEAD_PIVOT * bh];
    heroEnd = wide ? { x: aspect * 0.56, y: heroPan[1] - 0.04, zoom: 0.98 } : { x: aspect * 0.42, y: heroPan[1] - 1.18, zoom: 0.62 }; // clear of the statement: right on a wide screen, below it on a phone
    scene.setShape('cloud', shapes.cloud(PARTICLES));
    scene.setShape('portrait', shapes.portrait(PARTICLES, figure, 0, { w: bw, h: bh }));

    // The landscape covers the screen. On a narrow one it slides over so I'm in the middle of it.
    const h = Math.max(2, (2 * aspect) / shapes.DESERT.ratio);
    const w = h * shapes.DESERT.ratio;
    const frame = { w, h, x: wide ? 0 : Math.min((0.5 - shapes.DESERT.axis) * w, w / 2 - aspect) };
    focus = [clamp((shapes.DESERT.focus[0] - 0.5) * w + frame.x, -aspect * 0.8, aspect * 0.8), (0.5 - shapes.DESERT.focus[1]) * h];
    const pxPerUnit = innerHeight / 2;
    ghost.style.width = `${w * pxPerUnit}px`;
    ghost.style.height = `${h * pxPerUnit}px`;
    ghost.style.left = `${innerWidth / 2 + (frame.x - w / 2) * pxPerUnit}px`;
    ghost.style.top = `${innerHeight / 2 - (h / 2) * pxPerUnit}px`;
    ghost.style.transformOrigin = `${(focus[0] - frame.x + w / 2) * pxPerUnit}px ${(h / 2 - focus[1]) * pxPerUnit}px`;
    const buildDesert = () => { if (desertPoints) scene.setShape('desert', shapes.desert(PARTICLES, desertPoints, frame)); };
    placeDesert = buildDesert;

    // The rest are built one per idle moment, so loading never blocks the page.
    const pending = [
      () => scene.setShape('slant', shapes.portrait(PARTICLES, figure, 1, { w: bw, h: bh })), // only seen once you scroll, so built when the page is idle
      () => scene.setShape('tunnel', shapes.tunnel(PARTICLES, aspect)),
      () => scene.setShape('globe', shapes.globe(PARTICLES, land)),
      () => scene.setShape('next', shapes.words(PARTICLES, wide ? ['What comes next'] : ['What comes', 'next'], aspect)),
      () => scene.setShape('field', shapes.field(PARTICLES, aspect)), // quiet dust where the words are the point
      buildDesert, // only once its dots have arrived; they are fetched as the close comes near
    ];
    const run = ++layoutRun;
    const next = () => {
      if (run !== layoutRun || !pending.length) return;
      pending.shift()();
      whenIdle(next);
    };
    whenIdle(next);
  };
  layout();

  // The displayed contact block lives inside a pinned scene. Its DOM position is
  // the scene's beginning, but its readable state is near the end of the scroll.
  const navigateToSection = (hash) => {
    if (hash === '#contact') {
      lenis.scrollTo(closeTop + innerHeight * CLOSE_END, { immediate: true });
      return true;
    }
    return false;
  };
  document.querySelectorAll('a[href="/#contact"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const hash = new URL(link.href).hash;
      history.pushState(null, '', hash);
      navigateToSection(hash);
    });
  });
  addEventListener('popstate', () => navigateToSection(location.hash));
  requestAnimationFrame(() => navigateToSection(location.hash));


  let lastWidth = innerWidth;
  let timer = 0;
  const onResize = () => {
    if (innerWidth === lastWidth && Math.abs(innerHeight - scene.canvas.clientHeight) < 140) return;
    lastWidth = innerWidth;
    clearTimeout(timer);
    timer = setTimeout(layout, 180);
  };
  addEventListener('resize', onResize, { passive: true });

  const reveals = [...document.querySelectorAll('[data-words]')].map(splitWords);
  const cursor = startCursor();
  const lean = [0, 0];
  const flightStops = stops.length + RUN_UP + RUN_OUT;

  // Clips take you to their moment. Keyboard focus does too, so the tracks work without a mouse.
  const goToStop = (at) => lenis.scrollTo(sessionTop + ((at + 0.4 + RUN_UP) / flightStops) * sessionRange);
  const onClip = (e) => {
    e.preventDefault();
    e.stopPropagation(); // Lenis's anchor handling would chase the moment's hidden list item
    goToStop(parseFloat(e.currentTarget.dataset.at));
  };
  const onClipFocus = (e) => { if (e.currentTarget.matches(':focus-visible')) goToStop(parseFloat(e.currentTarget.dataset.at)); };
  clipLinks.forEach((link) => { link.addEventListener('click', onClip); link.addEventListener('focus', onClipFocus); });


  let bass = 0;
  let shrill = 0;
  let current = null;
  const t0 = performance.now();
  let raf = 0;
  let lastY = scrollY;
  let stillSince = t0;
  let autoWalked = false;
  const whale = createWhale(whiteLayer, [closeTitle, closeDetails]);
  markReady();

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    lenis.raf(now);
    quiet();
    const time = (now - t0) / 1000;
    const y = scrollY;
    const vw = innerWidth;
    const vh = innerHeight;
    const aspect = vw / vh;

    // The pointer is the light. With no pointer, as on a phone, it wanders slowly over the figure.
    root.classList.toggle('scrolled', y > 40);
    cursor.tick();
    const light = cursor.on ? toUnits(cursor.x, cursor.y) : [Math.sin(time * 0.31) * 0.4, 0.2 + Math.cos(time * 0.23) * 0.4];
    lean[0] += ((light[0] / aspect) * LEAN[0] - lean[0]) * 0.09;
    lean[1] += (-light[1] * LEAN[1] - lean[1]) * 0.09;

    // Which two shapes are in play, and how far between them.
    let from = 0;
    let to = 0;
    let morph = 1;
    for (let i = 1; i < sections.length; i++) {
      const begin = tops[i] - vh;
      if (y < begin) break;
      from = i - 1;
      to = i;
      morph = clamp((y - begin) / vh);
      if (morph >= 1) { from = i; morph = 1; }
    }
    let fromName = sections[from].dataset.shape;
    let toName = sections[to].dataset.shape;
    if (from === to || fromName === toName) { toName = fromName; morph = 1; } // the figure doesn't morph, it turns
    const formed = formStart === null ? 0 : (now - formStart) / 1000 / FORM_SECONDS;
    if (formed < 1 && y < 10) {
      // The cloud gathers into the portrait once the visitor has chosen how to enter.
      fromName = 'cloud';
      toName = 'portrait';
      morph = 1 - (1 - clamp(formed)) ** 3;
    }
    // I turn by flowing from the front view into the three-quarter slant, toward the words; once turned, I stay turned.
    const turning = ease(clamp(y / (vh * HERO_TURN_SCROLL)));
    if (y >= 10) {
      if (fromName === 'portrait' && toName === 'portrait') { toName = 'slant'; morph = turning; }
      else {
        if (fromName === 'portrait') fromName = 'slant';
        if (toName === 'portrait') toName = 'slant';
      }
    }
    if (!scene.has(toName)) toName = fromName;
    if (!scene.has(fromName)) { fromName = 'cloud'; toName = 'cloud'; }

    const levels = score.levels();
    bass += (levels.low - bass) * 0.12;
    shrill += (levels.high - shrill) * 0.12;

    // The figure: at the hero it faces you; scrolling turns it and walks it to the right.
    // I step aside faster than I turn, so the statement's words arrive on empty dark and never on me.
    const aside = ease(clamp(y / (vh * HERO_ASIDE_SCROLL)));
    const pan = [lerp(heroPan[0], heroEnd.x, aside), lerp(heroPan[1], heroEnd.y, aside)];
    const zoom = lerp(1, heroEnd.zoom, aside);


    // The flight through the years: scroll is the camera moving forward.
    const play = clamp((y - sessionTop) / sessionRange);
    const stopAt = -RUN_UP + play * flightStops;
    const flyEnd = sessionTop + sessionRange;
    const inSession = y > sessionTop - vh && y < sessionTop + session.offsetHeight;
    if (inSession) {
      const tiltX = cursor.on ? (cursor.x / vw - 0.5) * 2 : 0;
      const tiltY = cursor.on ? (0.5 - cursor.y / vh) * 2 : 0;
      stops.forEach((stop, i) => flyStop(stop, stopAt - i, i, stops.length, vw, vh, tiltX, tiltY));
      // The tracks and their shade arrive once the section has settled, and leave before it goes, so no edge ever crosses the particles.
      pin.style.setProperty('--veil', (ramp(y, sessionTop - vh * 0.1, sessionTop + vh * 0.35) * (1 - ramp(y, flyEnd - vh * 0.15, flyEnd + vh * 0.3))).toFixed(3));
      head.style.opacity = ramp(y, sessionTop - vh * 0.1, sessionTop + vh * 0.1) * (1 - ramp(stopAt, -0.3, -0.02));
      arrangement.scrollLeft = Math.max(0, stopAt) * slotWidth;
      const nearest = stops[clamp(Math.floor(stopAt), 0, stops.length - 1)];
      if (nearest !== current) {
        if (current) clipLinks.get(current.id)?.removeAttribute('aria-current');
        clipLinks.get(nearest.id)?.setAttribute('aria-current', 'true');
        current = nearest;
      }
      nextLine.style.opacity = ramp(y, nextTop - vh * 0.25, nextTop) * (1 - ramp(y, nextTop + vh * 0.2, nextTop + vh * 0.5));
    }


    // The close: the particles settle into the landscape, then scrolling walks you into the light.
    const walking = clamp((y - closeTop - vh * CLOSE_HOLD) / (vh * CLOSE_WALK));
    const walk = walking ** 1.7 * WALK_END;
    const white = ease(ramp(walking, 0.68, 0.97));
    if (!desertAsked && y > closeTop - vh * DESERT_AHEAD) {
      desertAsked = true;
      fetch('/hero/desert.bin')
        .then((res) => { if (!res.ok) throw new Error(`desert.bin returned ${res.status}`); return res.arrayBuffer(); })
        .then((buffer) => { desertPoints = new Uint16Array(buffer); placeDesert(); })
        .catch((err) => console.warn('Desert scene unavailable; the page ends on the words.', err));
    }
    const nearClose = y > closeTop - vh * 1.9;
    ghost.style.visibility = nearClose ? 'visible' : 'hidden';
    if (nearClose) {
      const arrive = ramp(y, closeTop - vh * 1.6, closeTop - vh * 0.9);
      ghost.style.opacity = (arrive * (0.3 + walking * 0.6)).toFixed(3);
      ghost.style.transform = `scale(${(4 / (4 - walk)).toFixed(4)})`;
      whiteLayer.style.opacity = white.toFixed(3);
      closeLead.style.opacity = (ramp(y, closeTop - vh * 0.15, closeTop + vh * 0.12) * (1 - ramp(walking, 0.03, 0.16))).toFixed(3);
      closeTitle.style.opacity = ramp(y, closeTop + vh * (CLOSE_HOLD + CLOSE_WALK * 0.96), closeTop + vh * (CLOSE_HOLD + CLOSE_WALK + 0.2));
      closeDetails.style.opacity = ramp(y, closeTop + vh * (CLOSE_HOLD + CLOSE_WALK + 0.3), closeTop + vh * CLOSE_END);
      root.classList.toggle('whiteout', white > 0.55);
      if (white > 0.01) whale.draw(now, cursor.on ? [cursor.x, cursor.y] : null);
    }

    // Once the line is up, twenty still seconds and the walk into the light goes on without you.
    if (Math.abs(y - lastY) > 0.5) { lastY = y; stillSince = now; }
    if (y < closeTop - vh) autoWalked = false;
    if (!autoWalked && y > closeTop - vh * 0.05 && walking < 1 && now - stillSince > CLOSE_IDLE_MS) {
      autoWalked = true;
      lenis.scrollTo(closeTop + vh * CLOSE_END, { duration: CLOSE_AUTO_SECONDS, easing: ease });
    }

    // Words stay dim until the light finds them. With no pointer, the scroll carries the light across.
    spots.forEach((spot) => {
      const rect = spot.el.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > vh) return;
      const near = cursor.on && cursor.x > rect.left - 140 && cursor.x < rect.right + 140 && cursor.y > rect.top - 140 && cursor.y < rect.bottom + 140;
      const tx = cursor.on ? cursor.x - rect.left : rect.width * clamp((vh * 0.9 - rect.top) / (vh * 0.75));
      const ty = cursor.on ? cursor.y - rect.top : rect.height / 2;
      spot.x += (tx - spot.x) * 0.1;
      spot.y += (ty - spot.y) * 0.1;
      spot.o += ((near || !cursor.on ? 1 : 0) - spot.o) * 0.08;
      spot.el.style.setProperty('--x', `${spot.x.toFixed(1)}px`);
      spot.el.style.setProperty('--y', `${spot.y.toFixed(1)}px`);
      spot.el.style.setProperty('--o', spot.o.toFixed(3));
    });


    reveals.forEach((r) => {
      const box = r.el.getBoundingClientRect();
      if (box.bottom < -40 || box.top > vh + 40) return;
      const p = clamp((vh * 0.92 - box.top) / (vh * 0.28)); // done by mid-screen, so pinned text finishes
      r.words.forEach((w, i) => {
        const o = clamp(p * (r.words.length + 5) - i, 0, 1);
        w.style.opacity = 0.08 + o * 0.92;
        w.style.filter = o < 1 ? `blur(${(1 - o) * 6}px)` : '';
      });
    });

    scene.draw({
      from: fromName,
      to: toName,
      morph,
      time,
      mouse: light,
      lean,
      level: Math.min(1, bass * 1.1),
      high: Math.min(1, shrill * 2),
      pan,
      zoom,
      globeX: innerWidth >= 900 ? aspect * GLOBE_SHIFT : 0,
      fly: play * 16 + time * 0.05,
      walk,
      focus,
      ground: 1 - ramp(y, closeTop - vh * 1.6, closeTop - vh * 0.9), // in the close the desert photo is the ground
    });
  };
  raf = requestAnimationFrame(frame);
}

score.init(document.querySelector('[data-sound-toggle]'), isCalm, gated);

// Content and the model poster remain visible if enhancement fails or WebGL is unavailable.
document.fonts.ready.then(() => {
  if (isCalm()) { markReady(); return; }
  startMotion().catch((err) => {
    console.warn('Motion unavailable; showing the complete static site.', err);
    root.classList.remove('scene-on');
    root.classList.add('no-scene');
    markReady();
  });
});
