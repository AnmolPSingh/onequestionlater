import { startPortrait } from './portrait.js';
import { createScore } from './score.js';

// The playhead. Drag it, click a clip, use the arrow keys, or press Play to run through the years.
const YEARS_PER_SECOND = 0.22;
const root = document.documentElement;
const isCalm = () => root.classList.contains('calm');

function calmToggle() {
  const button = document.querySelector('[data-calm-toggle]');
  button.hidden = false;
  const sync = () => button.setAttribute('aria-pressed', String(isCalm()));
  sync();
  button.addEventListener('click', () => {
    const calm = !isCalm();
    root.classList.toggle('calm', calm);
    try { localStorage.setItem('calm', calm ? '1' : '0'); } catch { /* private mode: still works for this visit */ }
    sync();
    document.dispatchEvent(new CustomEvent('calmchange'));
  });
}

function initSession() {
  const session = document.querySelector('[data-session]');
  if (!session) return;
  const data = JSON.parse(document.getElementById('session-data').textContent);
  const { start, end, eras, milestones } = data;

  const lanes = session.querySelector('[data-lanes]');
  const firstLane = session.querySelector('.lane');
  const playhead = session.querySelector('[data-playhead]');
  const inspector = session.querySelector('[data-inspector]');
  const ins = {
    photo: inspector.querySelector('[data-ins-photo]'),
    date: inspector.querySelector('[data-ins-date]'),
    title: inspector.querySelector('[data-ins-title]'),
    line: inspector.querySelector('[data-ins-line]'),
    link: inspector.querySelector('[data-ins-link]'),
  };
  const timecode = session.querySelector('[data-timecode]');
  const playButton = session.querySelector('[data-play]');
  const playLabel = session.querySelector('[data-play-label]');
  const playIcon = session.querySelector('[data-play-icon]');
  const clipLinks = new Map([...session.querySelectorAll('[data-clip]')].map((a) => [a.dataset.clip, a]));
  const score = createScore();

  let portrait = null;
  let year = end - 0.05;
  let shown = null;
  let playing = false;
  let raf = 0;

  const toX = (y) => (y - start) / (end - start);
  const toYear = (clientX) => {
    const box = firstLane.getBoundingClientRect();
    return Math.min(end, Math.max(start, start + ((clientX - box.left) / box.width) * (end - start)));
  };

  // The most recent milestone that has started by this year, preferring one still running.
  const at = (y) => {
    const started = milestones.filter((m) => m.from <= y);
    if (!started.length) return milestones[0];
    return started.filter((m) => m.to >= y).at(-1) ?? started.at(-1);
  };

  const inspect = (m) => {
    if (m === shown) return;
    if (shown) clipLinks.get(shown.id)?.removeAttribute('aria-current');
    shown = m;
    clipLinks.get(m.id)?.setAttribute('aria-current', 'true');
    ins.date.textContent = m.date;
    ins.title.textContent = m.title;
    ins.line.textContent = m.line;
    ins.photo.hidden = !m.photo;
    if (m.photo) ins.photo.src = m.photo;
    ins.link.hidden = !m.work;
    if (m.work) ins.link.href = `/work/${m.work}`;
  };

  const place = () => {
    const box = lanes.getBoundingClientRect();
    const lane = firstLane.getBoundingClientRect();
    const px = lane.left - box.left + toX(year) * lane.width;
    playhead.style.setProperty('--play-px', `${px}px`);
    const sessionBox = session.getBoundingClientRect();
    portrait?.setPlay((box.left - sessionBox.left + px) / sessionBox.width);
  };

  const setYear = (y) => {
    year = Math.min(end, Math.max(start, y));
    place();
    const m = at(year);
    inspect(m);
    const whole = Math.floor(year);
    timecode.textContent = String(Math.min(whole, end - 1));
    playhead.setAttribute('aria-valuenow', year.toFixed(1));
    playhead.setAttribute('aria-valuetext', `${m.date}, ${m.title}`);
    score.cue(eras.filter(([from]) => from <= year).at(-1)?.[1]);
  };

  const stop = () => {
    playing = false;
    cancelAnimationFrame(raf);
    playLabel.textContent = 'Play';
    playIcon.textContent = '▶';
    inspector.setAttribute('aria-live', 'polite');
  };

  const play = () => {
    if (year >= end - 0.1) setYear(start);
    playing = true;
    playLabel.textContent = 'Pause';
    playIcon.textContent = '❙❙';
    inspector.setAttribute('aria-live', 'off'); // don't read every clip aloud while it runs
    let last = performance.now();
    const tick = (now) => {
      setYear(year + ((now - last) / 1000) * YEARS_PER_SECOND);
      last = now;
      portrait?.setLevel(score.level());
      if (year >= end) { stop(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };

  playButton.addEventListener('click', () => (playing ? stop() : play()));

  // Drag anywhere on the lanes. A press on a clip jumps to its start instead of following the link.
  let dragging = false;
  lanes.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const clip = e.target.closest('[data-clip]');
    stop();
    dragging = true;
    lanes.setPointerCapture(e.pointerId);
    if (clip) {
      e.preventDefault();
      setYear(milestones.find((m) => m.id === clip.dataset.clip).from + 0.01);
    } else {
      setYear(toYear(e.clientX));
    }
  });
  lanes.addEventListener('pointermove', (e) => { if (dragging) setYear(toYear(e.clientX)); });
  const endDrag = () => { dragging = false; };
  lanes.addEventListener('pointerup', endDrag);
  lanes.addEventListener('pointercancel', endDrag);

  // Keyboard users follow a clip link, which also moves the playhead. Liner notes stay reachable with JS off.
  clipLinks.forEach((link, id) => link.addEventListener('click', (e) => {
    e.preventDefault();
    setYear(milestones.find((m) => m.id === id).from + 0.01);
    playhead.focus({ preventScroll: true });
  }));

  // Slider keys step clip to clip.
  playhead.addEventListener('keydown', (e) => {
    const index = milestones.indexOf(at(year));
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    let target = null;
    if (step) target = milestones[Math.min(milestones.length - 1, Math.max(0, index + step))].from + 0.01;
    if (e.key === 'Home') target = start;
    if (e.key === 'End') target = end;
    if (target === null) return;
    e.preventDefault();
    stop();
    setYear(target);
  });

  addEventListener('resize', place, { passive: true });

  const applyMotion = async () => {
    const calm = isCalm();
    playButton.hidden = calm;
    if (calm) {
      stop();
      portrait?.stop();
      portrait = null;
    } else if (!portrait) {
      portrait = await startPortrait(session, session.querySelector('[data-portrait]'));
      place();
    }
  };
  document.addEventListener('calmchange', applyMotion);

  playhead.hidden = false;
  setYear(year);
  applyMotion();
  score.init(session.querySelector('[data-sound-toggle]'), () => portrait);

  // Below the timeline, the Ask section has its own cue; leaving it returns to the playhead's era.
  const ask = document.getElementById('ask');
  if (ask) {
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) score.cue('door');
      else setYear(year);
    }, { threshold: 0.35 }).observe(ask);
  }
}

calmToggle();
initSession();
