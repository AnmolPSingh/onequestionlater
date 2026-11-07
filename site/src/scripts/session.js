import Lenis from 'lenis';
import { createScene } from './scene.js';
import * as shapes from './shapes.js';
import { startCursor } from './cursor.js';
import { isCalm } from './calm.js';
import { quietBehindText } from './quiet.js';

// The story page: my life as a long arrangement. While the session is pinned, scroll is the camera
// flying forward: each moment appears far away, comes to you and passes, and the tracks run underneath,
// ending in "What comes next" in particles. The HTML is already the finished page, so reduced motion
// just never starts any of it.
const PARTICLES = innerWidth < 640 ? 26000 : 58000;
const PAIR_GAP = 0.018; // of the screen's width, between two pictures that share a scene
const RUN_UP = 0.6; // stops of track before the first scene
const RUN_OUT = 0.2;
const FLY_TAIL = 1.4; // screens after the last scene: the stars gather into the words and hold
const root = document.documentElement;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ramp = (v, a, b) => clamp((v - a) / (b - a));

const session = document.querySelector('[data-session]');
const clipLinks = new Map([...session.querySelectorAll('[data-clip]')].map((a) => [a.dataset.clip, a]));

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

async function start() {
  const scene = createScene(PARTICLES);
  if (!scene) { root.classList.add('no-scene'); return; }

  const head = session.querySelector('[data-head]');
  const pin = session.querySelector('[data-pin]');
  const nextLine = session.querySelector('[data-next-line]');
  const nextMark = session.querySelector('.session-next');
  const arrangement = session.querySelector('[data-arrangement]');
  const firstClip = session.querySelector('.clip');
  const stops = buildStops();
  const lenis = new Lenis({ lerp: 0.09, anchors: true });

  document.body.prepend(scene.canvas);
  const quiet = quietBehindText(scene.canvas);
  root.classList.add('scene-on');
  await new Promise(requestAnimationFrame); // let the pinned heights apply before measuring

  let sessionTop = 0;
  let sessionRange = 1;
  let slotWidth = 1;
  let nextTop = 0;

  const layout = () => {
    const aspect = innerWidth / innerHeight;
    const wide = innerWidth >= 900;
    scene.resize();
    const y = scrollY;
    sessionTop = session.getBoundingClientRect().top + y;
    sessionRange = Math.max(1, session.offsetHeight - innerHeight * (1 + FLY_TAIL));
    nextTop = nextMark.getBoundingClientRect().top + y;
    slotWidth = firstClip.offsetWidth / (parseFloat(firstClip.style.getPropertyValue('--b')) - parseFloat(firstClip.style.getPropertyValue('--a')));
    scene.setShape('tunnel', shapes.tunnel(PARTICLES, aspect));
    scene.setShape('next', shapes.words(PARTICLES, wide ? ['What comes next'] : ['What comes', 'next'], aspect));
  };
  layout();

  let lastWidth = innerWidth;
  let timer = 0;
  addEventListener('resize', () => {
    if (innerWidth === lastWidth && Math.abs(innerHeight - scene.canvas.clientHeight) < 140) return;
    lastWidth = innerWidth;
    clearTimeout(timer);
    timer = setTimeout(layout, 180);
  }, { passive: true });

  const cursor = startCursor();
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

  let current = null;
  const t0 = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    lenis.raf(now);
    quiet();
    const time = (now - t0) / 1000;
    const y = scrollY;
    const vw = innerWidth;
    const vh = innerHeight;
    const aspect = vw / vh;
    root.classList.toggle('scrolled', y > 40);
    cursor.tick();
    const light = cursor.on ? [((cursor.x / vw) * 2 - 1) * aspect, 1 - (cursor.y / vh) * 2] : [Math.sin(time * 0.31) * 0.4, 0.2 + Math.cos(time * 0.23) * 0.4];

    // The flight through the years: scroll is the camera moving forward.
    const play = clamp((y - sessionTop) / sessionRange);
    const stopAt = -RUN_UP + play * flightStops;
    const flyEnd = sessionTop + sessionRange;
    if (y < sessionTop + session.offsetHeight) {
      const tiltX = cursor.on ? (cursor.x / vw - 0.5) * 2 : 0;
      const tiltY = cursor.on ? (0.5 - cursor.y / vh) * 2 : 0;
      stops.forEach((stop, i) => flyStop(stop, stopAt - i, i, stops.length, vw, vh, tiltX, tiltY));
      // The tracks and their shade arrive once the section has settled, and leave before it goes, so no edge ever crosses the particles.
      pin.style.setProperty('--veil', (ramp(y, sessionTop - vh * 0.1, sessionTop + vh * 0.35) * (1 - ramp(y, flyEnd - vh * 0.15, flyEnd + vh * 0.3))).toFixed(3));
      head.style.opacity = (1 - ramp(stopAt, -0.3, -0.02)).toFixed(3); // the page opens on the heading
      arrangement.scrollLeft = Math.max(0, stopAt) * slotWidth;
      const nearest = stops[clamp(Math.floor(stopAt), 0, stops.length - 1)];
      if (nearest !== current) {
        if (current) clipLinks.get(current.id)?.removeAttribute('aria-current');
        clipLinks.get(nearest.id)?.setAttribute('aria-current', 'true');
        current = nearest;
      }
      nextLine.style.opacity = ramp(y, nextTop - vh * 0.25, nextTop) * (1 - ramp(y, nextTop + vh * 0.2, nextTop + vh * 0.5));
    }

    scene.draw({
      from: 'tunnel',
      to: 'next',
      morph: clamp((y - (nextTop - vh)) / vh),
      time,
      mouse: light,
      fly: play * 16 + time * 0.05,
    });
  };
  requestAnimationFrame(frame);
}

document.fonts.ready.then(() => {
  if (isCalm()) return;
  start().catch((err) => {
    console.warn('Motion unavailable; showing the complete static page.', err);
    root.classList.remove('scene-on');
    root.classList.add('no-scene');
  });
});
