// Headings that gather from dust as they arrive and blow apart as they leave. The real
// text stays in the DOM for readers and search; it's only made transparent while this draws.
const STEP = 2;
const SPREAD = 150;

function sample(el) {
  const box = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  const off = document.createElement('canvas');
  off.width = Math.ceil(box.width);
  off.height = Math.ceil(box.height);
  const ctx = off.getContext('2d', { willReadFrequently: true });
  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  ctx.letterSpacing = style.letterSpacing;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.1;
  ctx.fillText(el.textContent.trim(), 0, lineHeight * 0.82);
  const { data, width, height } = ctx.getImageData(0, 0, off.width, off.height);
  const points = [];
  for (let y = 0; y < height; y += STEP) {
    for (let x = 0; x < width; x += STEP) {
      if (data[(y * width + x) * 4 + 3] > 120) {
        points.push({ x, y, a: Math.random() * 6.28, r: Math.random(), s: Math.random() * 0.45 });
      }
    }
  }
  return { points, width, height };
}

const isOneLine = (el) => {
  const style = getComputedStyle(el);
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.1;
  return el.getBoundingClientRect().height < lineHeight * 1.6;
};

export function startDisintegrate(elements) {
  // Sampling draws one line of text, so a wrapped heading simply stays as real text.
  const items = [...elements].filter(isOneLine).map((el) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'dust-text';
    canvas.setAttribute('aria-hidden', 'true');
    el.classList.add('dust-host');
    el.append(canvas);
    return { el, canvas, ctx: canvas.getContext('2d'), points: [], width: 0, height: 0 };
  });

  const measure = () => items.forEach((item) => {
    Object.assign(item, sample(item.el));
    item.canvas.width = item.width + SPREAD * 2;
    item.canvas.height = item.height + SPREAD * 2;
  });
  measure();

  return {
    measure,
    tick(time) {
      const vh = innerHeight;
      items.forEach((item) => {
        const box = item.el.getBoundingClientRect();
        if (box.bottom < -SPREAD || box.top > vh + SPREAD) return;
        // 1 while scattered below the fold, 0 once settled, back up to 1 past the top.
        const enter = Math.min(1, Math.max(0, (box.top - vh * 0.55) / (vh * 0.35)));
        const leave = Math.min(1, Math.max(0, (vh * 0.08 - box.top) / (vh * 0.3)));
        const spread = Math.max(enter, leave);
        const { ctx, canvas, points } = item;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#f3eee4';
        points.forEach((p) => {
          const t = Math.min(1, Math.max(0, (spread - p.s) / (1 - p.s)));
          const eased = t * t;
          const shimmer = Math.sin(time * 1.8 + p.a * 5) * 0.5; // never fully at rest
          const x = p.x + Math.cos(p.a) * eased * SPREAD * p.r + shimmer * 0.5 + SPREAD;
          const y = p.y + Math.sin(p.a) * eased * SPREAD * p.r - eased * 60 + shimmer * 0.5 + SPREAD;
          ctx.globalAlpha = 1 - t * 0.9;
          ctx.fillRect(x, y, 1.6, 1.6);
        });
        ctx.globalAlpha = 1;
      });
    },
    stop() {
      items.forEach(({ el, canvas }) => { canvas.remove(); el.classList.remove('dust-host'); });
    },
  };
}
