import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { startPortal } from './portal.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

// The HTML is already the finished story. Everything here animates *towards* it,
// and Calm mode reverts it all back to that final state.
const root = document.documentElement;
const isCalm = () => root.classList.contains('calm');
const SCRUB = 0.6;
const ENDINGS = ['make a sound.', 'learn the tool.', 'ask why.', 'say yes.', 'remove things.', 'find out.'];

/* ---------- Always on: progress line, rail, arrow keys, Calm toggle ---------- */

function progressLine() {
  const header = document.querySelector('.site-header');
  const update = () => {
    const max = root.scrollHeight - innerHeight;
    header.style.setProperty('--progress', max > 0 ? (scrollY / max).toFixed(4) : '0');
  };
  addEventListener('scroll', update, { passive: true });
  update();
}

function rail() {
  document.querySelectorAll('[data-rail]').forEach((link) => {
    ScrollTrigger.create({
      trigger: document.getElementById(link.dataset.rail),
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: ({ isActive }) => (isActive ? link.setAttribute('aria-current', 'true') : link.removeAttribute('aria-current')),
    });
  });
}

// Left and right jump chapter to chapter; up, down and space stay native.
function arrowKeys() {
  const chapters = [...document.querySelectorAll('.chapter')];
  addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    if (e.altKey || e.metaKey || e.ctrlKey || e.target.closest('input, textarea, select, [contenteditable]')) return;
    const mid = innerHeight * 0.55;
    const tops = chapters.map((c) => c.getBoundingClientRect().top);
    const next = e.key === 'ArrowRight'
      ? chapters.find((_, i) => tops[i] > mid + 1)
      : [...chapters].reverse().find((c) => c.getBoundingClientRect().top < -innerHeight * 0.1);
    if (!next) return;
    e.preventDefault();
    next.scrollIntoView({ behavior: isCalm() ? 'auto' : 'smooth' });
  });
}

function calmToggle() {
  const button = document.querySelector('[data-calm-toggle]');
  if (!button) return;
  button.hidden = false;
  const sync = () => button.setAttribute('aria-pressed', String(isCalm()));
  sync();
  button.addEventListener('click', () => {
    const calm = !isCalm();
    root.classList.toggle('calm', calm);
    try { localStorage.setItem('calm', calm ? '1' : '0'); } catch { /* private mode: the toggle still works for this visit */ }
    sync();
    document.dispatchEvent(new CustomEvent('calmchange'));
  });
}

/* ---------- Story motion (off in Calm mode) ---------- */

// Types steps into an aria-hidden span; the element keeps its real text as its accessible name.
function typewriter(el, steps, { stopOnScroll = false } = {}) {
  const final = el.textContent;
  el.setAttribute('aria-label', final);
  el.innerHTML = '<span aria-hidden="true"><span class="typed"></span><span class="caret"></span></span>';
  const out = el.querySelector('.typed');
  let i = 0;
  let timer = 0;
  const finish = () => { clearTimeout(timer); i = steps.length; out.textContent = final; };
  const tick = () => {
    if (i >= steps.length) return;
    const [op, text, ms] = steps[i++];
    out.textContent = op === 'add' ? out.textContent + text : out.textContent.slice(0, -1);
    timer = setTimeout(tick, ms);
  };
  const onScroll = () => { if (scrollY > 40) finish(); };
  if (stopOnScroll) addEventListener('scroll', onScroll, { passive: true });
  timer = setTimeout(tick, 500);
  return () => {
    finish();
    removeEventListener('scroll', onScroll);
    el.textContent = final;
    el.removeAttribute('aria-label');
  };
}

const typeSteps = (text, ms) => [...text].map((ch) => ['add', ch, ms]);

function typeOpening() {
  const h = document.querySelector('.opening-title');
  if (!h) return () => {};
  const steps = typeSteps('Be curious enough to ', 55);
  for (const ending of ENDINGS) {
    const typed = typeSteps(ending, 45);
    typed[typed.length - 1][2] = 900; // hold the full ending before deleting it
    steps.push(...typed, ...Array.from({ length: ending.length }, () => ['del', '', 24]));
  }
  steps.push(['del', '', 80], ...typeSteps('...', 170));
  return typewriter(h, steps, { stopOnScroll: true });
}

function typeClose() {
  const h = document.querySelector('.close-title');
  if (!h) return () => {};
  let stop = () => {};
  const st = ScrollTrigger.create({
    trigger: h,
    start: 'top 70%',
    once: true,
    onEnter: () => { stop = typewriter(h, typeSteps(h.textContent, 60)); },
  });
  return () => { st.kill(); stop(); };
}

function chapterHeads() {
  document.querySelectorAll('.ch-head').forEach((head) => {
    const end = head.querySelector('.end');
    // aria 'none': SplitText's default hides the pieces and labels a span, which loses heading text and link names.
    const split = SplitText.create(end, { type: 'lines', mask: 'lines', tag: 'span', aria: 'none' });
    gsap.from(split.lines, {
      yPercent: 105,
      stagger: 0.12,
      ease: 'power3.out',
      scrollTrigger: { trigger: end, start: 'top 90%', end: 'top 45%', scrub: SCRUB },
    });
    gsap.from(head.querySelectorAll('.ch-num, .lead'), {
      opacity: 0,
      y: 12,
      ease: 'power2.out',
      scrollTrigger: { trigger: head, start: 'top 80%', end: 'top 30%', scrub: SCRUB },
    });
  });
}

// Elimar's word-by-word dissolve. Blur only on wider screens, where it stays smooth.
function wordDissolves() {
  const blur = matchMedia('(min-width: 900px)').matches;
  document.querySelectorAll('.beat, .beat-h, .pull p, .moment > p:not([data-tool-tag]), .full-circle > p:not(:has(a)), .pattern > p').forEach((el) => {
    const split = SplitText.create(el, { type: 'words', tag: 'span', aria: 'none' });
    gsap.from(split.words, {
      opacity: 0.08,
      ...(blur && { filter: 'blur(6px)' }),
      stagger: 0.05,
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 85%', end: 'bottom 60%', scrub: SCRUB },
    });
  });
  gsap.utils.toArray('[data-tool-tag]').forEach((tag) => {
    gsap.from(tag, { opacity: 0, x: -16, ease: 'power2.out', scrollTrigger: { trigger: tag, start: 'top 90%', end: 'top 70%', scrub: SCRUB } });
  });
}

const intro = (trigger) => gsap.timeline({ scrollTrigger: { trigger, start: 'top 75%', end: 'top 10%', scrub: SCRUB } });
const bodyOf = (selector) => document.querySelector(selector)?.closest('.ch-body');

function graphics() {
  const wave = bodyOf('.g-wave');
  if (wave) intro(wave).from('.g-wave .bar', { scaleY: 0.04, stagger: { each: 0.02, from: 'center' }, ease: 'power2.out' });

  const posters = bodyOf('.g-posters');
  if (posters) {
    intro(posters).fromTo('.g-posters .poster',
      { rotation: 0, svgOrigin: '240 330' },
      { rotation: (_, el) => Number(el.dataset.angle), svgOrigin: '240 330', ease: 'power2.out' });
  }

  const radio = bodyOf('.g-radio');
  if (radio) {
    intro(radio)
      .from('.g-radio .ring', { scale: 0, opacity: 0, transformOrigin: '50% 50%', stagger: 0.15, ease: 'power2.out' })
      .from('.g-radio .strip', { x: 260, ease: 'power2.inOut' }, '>-0.2');
  }

  const phones = bodyOf('.g-phones');
  if (phones) intro(phones).from('.g-phones .ui > *', { opacity: 0, scaleX: 0.2, transformOrigin: '0% 50%', stagger: 0.05, ease: 'power2.out' });

  const orbit = bodyOf('.g-orbit');
  if (orbit) {
    intro(orbit)
      .from('.g-orbit .sats', { rotation: -40, svgOrigin: '240 180', ease: 'power2.out' })
      .from('.g-orbit .sat', { opacity: 0, scale: 0, transformOrigin: '50% 50%', stagger: 0.1 }, 0);
  }

  // 07: the mess loses boxes and lines across the whole chapter until three steps remain.
  const diagram = bodyOf('.g-diagram');
  if (diagram) {
    gsap.timeline({ scrollTrigger: { trigger: diagram, start: 'top 60%', end: 'bottom 75%', scrub: SCRUB } })
      .fromTo('.g-diagram .extra', { opacity: 1 }, { opacity: 0, stagger: { each: 0.12, from: 'random' }, ease: 'power1.in' })
      .from('.g-diagram .clean', { opacity: 0.3, ease: 'none' }, 0);
  }
}

function prints() {
  const mm = gsap.matchMedia();
  // Desktop: prints sit in the sticky stage, so they drop in one by one across the chapter.
  mm.add('(min-width: 900px)', () => {
    document.querySelectorAll('.ch-body').forEach((body) => {
      const items = body.querySelectorAll('.prints > .print, .board > .print');
      if (!items.length) return;
      gsap.from(items, {
        y: 90,
        opacity: 0,
        rotation: 6,
        stagger: 0.5,
        ease: 'power3.out',
        scrollTrigger: { trigger: body, start: 'top 45%', end: 'center 45%', scrub: SCRUB },
      });
    });
  });
  // Phones: everything stacks, so each print drops in as it arrives.
  mm.add('(max-width: 899px)', () => {
    document.querySelectorAll('.prints > .print, .board > .print').forEach((p) => {
      gsap.from(p, { y: 60, opacity: 0, rotation: 5, ease: 'power3.out', scrollTrigger: { trigger: p, start: 'top 95%', end: 'top 60%', scrub: SCRUB } });
    });
  });
  document.querySelectorAll('.moment .print, .frames .print').forEach((p) => {
    gsap.from(p, { y: 70, opacity: 0, rotation: 5, ease: 'power3.out', scrollTrigger: { trigger: p, start: 'top 95%', end: 'top 55%', scrub: SCRUB } });
  });
  return () => mm.revert();
}

// Seven words dim one by one, then curiosity lights.
function pattern() {
  const section = document.querySelector('.pattern');
  if (!section) return;
  gsap.timeline({ scrollTrigger: { trigger: section, start: 'top 35%', end: 'center 35%', scrub: SCRUB } })
    .from('.pattern-words li', { color: '#f7f5f1', stagger: 0.25, ease: 'none' })
    .from('.pattern .lit', { color: '#f7f5f1', ease: 'none' });
}

function videos() {
  const io = new IntersectionObserver((entries) => entries.forEach(({ target: v, isIntersecting }) => {
    if (v.hasAttribute('data-loop-video')) {
      if (isIntersecting) v.play().catch(() => {});
      else v.pause();
    } else if (isIntersecting && !v.dataset.played) {
      v.dataset.played = '1';
      v.play().catch(() => {});
    }
  }), { threshold: 0.4 });
  // preload stays "none": a video only downloads once it scrolls into view and play() asks for it.
  const all = document.querySelectorAll('[data-loop-video], [data-play-once]');
  all.forEach((v) => io.observe(v));
  return () => {
    io.disconnect();
    all.forEach((v) => { v.pause(); v.currentTime = 0; delete v.dataset.played; });
  };
}

function story(cleanups) {
  cleanups.push(typeOpening(), typeClose(), videos(), startPortal());
  chapterHeads();
  wordDissolves();
  graphics();
  cleanups.push(prints());
  pattern();
}

// Returns a revert function, or null if the motion couldn't be built (the final HTML then stands).
function buildStory() {
  const cleanups = [];
  const ctx = gsap.context(() => {});
  const revert = () => { cleanups.forEach((fn) => fn()); ctx.revert(); };
  try {
    ctx.add(() => story(cleanups));
    return revert;
  } catch (err) {
    console.error('Motion failed to build; showing the finished story instead.', err);
    revert();
    return null;
  }
}

/* ---------- Boot ---------- */

progressLine();
calmToggle();

document.fonts.ready.then(() => {
  rail();
  arrowKeys();
  let revert = null;
  document.addEventListener('calmchange', () => {
    if (isCalm()) { revert?.(); revert = null; }
    else if (!revert) revert = buildStory();
    ScrollTrigger.refresh();
  });
  if (!isCalm()) revert = buildStory();
});
