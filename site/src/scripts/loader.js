// The visitor chooses sound or silence. The choice is made inside the click, which is the only time a
// browser lets sound start; then, once the scene is ready, the choice fades and the particles gather.
const CLEAR = { duration: 700, easing: 'ease-out', fill: 'forwards' };

export async function playLoader(ready, onChoice) {
  const root = document.documentElement;
  const loader = document.querySelector('[data-loader]');
  if (!loader || !root.classList.contains('loading')) return;
  root.classList.add('gate'); // tells the inline fallback in Base.astro the page is waiting on a person, not stuck

  const buttons = [...loader.querySelectorAll('[data-enter]')];
  await new Promise((resolve) => buttons.forEach((button) => button.addEventListener('click', () => {
    buttons.forEach((b) => { b.disabled = true; });
    onChoice(button.dataset.enter === 'sound');
    resolve();
  }, { once: true })));
  await ready;

  root.classList.add('opening');
  await loader.animate([{ opacity: 1 }, { opacity: 0 }], CLEAR).finished;
  loader.remove();
  root.classList.remove('loading', 'opening', 'gate');
  try { sessionStorage.setItem('loaded', '1'); } catch { /* private mode: it asks again, which is fine */ }
}
