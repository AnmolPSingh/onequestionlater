// A soft light that stands in for the pointer. Links and form fields keep their normal cursors.
const EASE = 0.24;

export function startCursor() {
  const cursor = { x: 0, y: 0, on: false, tick() {}, stop() {} };
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return cursor;

  const root = document.documentElement;
  const orb = document.createElement('div');
  orb.className = 'cursor-orb';
  orb.setAttribute('aria-hidden', 'true');
  document.body.append(orb);
  root.classList.add('orb-on');

  let targetX = 0;
  let targetY = 0;
  const onMove = (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
    if (cursor.on) return;
    cursor.on = true;
    cursor.x = targetX;
    cursor.y = targetY;
    orb.classList.add('on');
  };
  const onLeave = () => {
    cursor.on = false;
    orb.classList.remove('on');
  };
  addEventListener('pointermove', onMove, { passive: true });
  root.addEventListener('mouseleave', onLeave);

  cursor.tick = () => {
    cursor.x += (targetX - cursor.x) * EASE;
    cursor.y += (targetY - cursor.y) * EASE;
    orb.style.transform = `translate3d(${cursor.x}px, ${cursor.y}px, 0)`;
  };
  cursor.stop = () => {
    removeEventListener('pointermove', onMove);
    root.removeEventListener('mouseleave', onLeave);
    root.classList.remove('orb-on');
    orb.remove();
  };
  return cursor;
}
