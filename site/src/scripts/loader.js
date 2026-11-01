// Frames wipe up one after another inside a small box. Once the scene is ready the white falls away
// and the last frame hands over to particles lying exactly where it was, which go on to form the
// portrait. Resolves with that frame's place and pixels as the handover starts.
const WIPE = { duration: 650, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)', fill: 'forwards' };
const CLEAR = { duration: 700, easing: 'ease-out', fill: 'forwards' };
const STAGGER = 120;
const HOLD = 300;
const HANDOVER = 300; // ms after the white starts to go before the photo gives way to its dots
const SAMPLE = 96; // pixels across the frame the dots read their brightness from

// The frame's brightness, cropped the way object-fit: cover crops it on screen.
function sample(img, rect) {
  const width = SAMPLE;
  const height = Math.round((SAMPLE * rect.height) / rect.width);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, (width - img.naturalWidth * scale) / 2, (height - img.naturalHeight * scale) / 2, img.naturalWidth * scale, img.naturalHeight * scale);
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const luma = new Float32Array(width * height);
  for (let i = 0; i < luma.length; i++) luma[i] = (rgba[i * 4] * 0.3 + rgba[i * 4 + 1] * 0.59 + rgba[i * 4 + 2] * 0.11) / 255;
  return { width, height, luma };
}

export async function playLoader(ready) {
  const root = document.documentElement;
  const loader = document.querySelector('[data-loader]');
  if (!loader || !root.classList.contains('loading')) return null;
  const frames = [...loader.querySelectorAll('[data-loader-frame]')];
  const last = frames[frames.length - 1];

  await Promise.all(frames.map((img) => img.decode().catch(() => {}))); // a frame that fails just doesn't show
  const wipes = frames.slice(1).map((img, i) => img.animate([{ clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { ...WIPE, delay: HOLD + i * STAGGER }));
  await Promise.all([...wipes.map((wipe) => wipe.finished), ready]);

  const rect = last.getBoundingClientRect();
  let photo = null;
  try { photo = { rect, ...sample(last, rect) }; } catch { /* no pixels: the portrait blows in from the cloud instead */ }
  root.classList.add('opening');
  loader.animate([{ backgroundColor: '#fff' }, { backgroundColor: 'rgb(255 255 255 / 0)' }], CLEAR);
  last.parentElement.animate([{ opacity: 1 }, { opacity: 0 }], { ...CLEAR, delay: HANDOVER }).finished.then(() => { // the whole box, so no earlier frame shows through
    loader.remove();
    root.classList.remove('loading', 'opening');
    try { sessionStorage.setItem('loaded', '1'); } catch { /* private mode: it plays again, which is fine */ }
  });
  return photo;
}
