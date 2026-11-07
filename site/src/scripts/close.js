import * as shapes from './shapes.js';
import { createWhale } from './whale.js';

// The close, shared by the home page and the story page: the particles settle into the dot desert
// beside "Still no signal. Still not stopping.", scrolling walks you into the light, the page turns
// white with a whale swimming in it, and the contact details arrive. Twenty still seconds on the line
// and the walk goes on by itself.
const DESERT_AHEAD = 6; // screens before the close at which its 350 KB of dots start to download
const WALK_END = 3.97; // just short of the horizon; keep under 1 + FAR in scene.js
const HOLD = 0.3; // screens the landscape holds before the walk, long enough to read the line beside me
const WALK = 1.4; // screens the walk into the light takes: with the hold, about two scrolls from the line to white
const END = HOLD + WALK + 0.6; // screens into the close where the contact details are fully in; .close's height in base.css follows it
const IDLE_MS = 20000;
const AUTO_SECONDS = 5;
const root = document.documentElement;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => t * t * (3 - 2 * t);
const ramp = (v, a, b) => clamp((v - a) / (b - a));

export function createClose(scene, lenis, particles) {
  const el = document.querySelector('[data-close]');
  const title = document.querySelector('[data-close-title]');
  const lead = document.querySelector('[data-close-lead]');
  const details = document.querySelector('[data-close-details]');
  const white = document.querySelector('[data-white]');
  const ghost = document.querySelector('[data-ghost]');
  const whale = createWhale(white, [title, details]);
  let top = 0;
  let focus = [0, 0];
  let frame = null;
  let points = null;
  let asked = false;
  let lastY = scrollY;
  let stillSince = performance.now();
  let autoWalked = false;

  const build = () => { if (points && frame) scene.setShape('desert', shapes.desert(particles, points, frame)); };

  // The landscape covers the screen. On a narrow one it slides over so I'm in the middle of it.
  const layout = () => {
    const aspect = innerWidth / innerHeight;
    top = el.getBoundingClientRect().top + scrollY;
    const h = Math.max(2, (2 * aspect) / shapes.DESERT.ratio);
    const w = h * shapes.DESERT.ratio;
    frame = { w, h, x: innerWidth >= 900 ? 0 : Math.min((0.5 - shapes.DESERT.axis) * w, w / 2 - aspect) };
    focus = [clamp((shapes.DESERT.focus[0] - 0.5) * w + frame.x, -aspect * 0.8, aspect * 0.8), (0.5 - shapes.DESERT.focus[1]) * h];
    const pxPerUnit = innerHeight / 2;
    ghost.style.width = `${w * pxPerUnit}px`;
    ghost.style.height = `${h * pxPerUnit}px`;
    ghost.style.left = `${innerWidth / 2 + (frame.x - w / 2) * pxPerUnit}px`;
    ghost.style.top = `${innerHeight / 2 - (h / 2) * pxPerUnit}px`;
    ghost.style.transformOrigin = `${(focus[0] - frame.x + w / 2) * pxPerUnit}px ${(h / 2 - focus[1]) * pxPerUnit}px`;
  };

  // The contact block lives inside the pinned close. Its DOM position is the close's beginning, but
  // its readable state is near the end of the scroll.
  const toContact = (hash) => { if (hash === '#contact') lenis.scrollTo(top + innerHeight * END, { immediate: true }); };
  document.querySelectorAll('a[href="/#contact"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      history.pushState(null, '', '#contact');
      toContact('#contact');
    });
  });
  addEventListener('popstate', () => toContact(location.hash));

  return {
    layout,
    build,
    get top() { return top; },
    toContact,
    // Runs every frame. Returns what the particle scene needs for the walk.
    tick(now, y, cursor) {
      const vh = innerHeight;
      const walking = clamp((y - top - vh * HOLD) / (vh * WALK));
      const walk = walking ** 1.7 * WALK_END;
      const light = ease(ramp(walking, 0.68, 0.97));
      if (!asked && y > top - vh * DESERT_AHEAD) {
        asked = true;
        fetch('/hero/desert.bin')
          .then((res) => { if (!res.ok) throw new Error(`desert.bin returned ${res.status}`); return res.arrayBuffer(); })
          .then((buffer) => { points = new Uint16Array(buffer); build(); })
          .catch((err) => console.warn('Desert scene unavailable; the page ends on the words.', err));
      }
      const near = y > top - vh * 1.9;
      ghost.style.visibility = near ? 'visible' : 'hidden';
      if (near) {
        const arrive = ramp(y, top - vh * 1.6, top - vh * 0.9);
        ghost.style.opacity = (arrive * (0.3 + walking * 0.6)).toFixed(3);
        ghost.style.transform = `scale(${(4 / (4 - walk)).toFixed(4)})`;
        white.style.opacity = light.toFixed(3);
        lead.style.opacity = (ramp(y, top - vh * 0.15, top + vh * 0.12) * (1 - ramp(walking, 0.03, 0.16))).toFixed(3);
        title.style.opacity = ramp(y, top + vh * (HOLD + WALK * 0.96), top + vh * (HOLD + WALK + 0.2));
        details.style.opacity = ramp(y, top + vh * (HOLD + WALK + 0.3), top + vh * END);
        root.classList.toggle('whiteout', light > 0.55);
        if (light > 0.01) whale.draw(now, cursor.on ? [cursor.x, cursor.y] : null);
      }

      // Once the line is up, twenty still seconds and the walk into the light goes on without you.
      if (Math.abs(y - lastY) > 0.5) { lastY = y; stillSince = now; }
      if (y < top - vh) autoWalked = false;
      if (!autoWalked && y > top - vh * 0.05 && walking < 1 && now - stillSince > IDLE_MS) {
        autoWalked = true;
        lenis.scrollTo(top + vh * END, { duration: AUTO_SECONDS, easing: ease });
      }
      return { walk, focus, ground: 1 - ramp(y, top - vh * 1.6, top - vh * 0.9) }; // in the close the desert photo is the ground
    },
  };
}
