// The dots fall almost to nothing wherever there is text to read, and come back where they are the subject.
// Mark reading blocks with data-read (optionally data-read="0.3" for how faint) and the places the dots are the
// point, like the globe, with data-subject. Call the returned tick once a frame.
const FAINT = 0.15;
const EASE = 0.08;

export function quietBehindText(canvas, { full = 1 } = {}) {
  const reading = [...document.querySelectorAll('[data-read]')];
  const subjects = [...document.querySelectorAll('[data-subject]')];
  let level = full;
  return () => {
    const vh = innerHeight;
    const holdsCentre = (el) => { const r = el.getBoundingClientRect(); return r.top < vh * 0.5 && r.bottom > vh * 0.5; };
    let target = full;
    if (!subjects.some(holdsCentre)) {
      const block = reading.find(holdsCentre);
      if (block) target = parseFloat(block.dataset.read) || FAINT;
    }
    level += (target - level) * EASE;
    canvas.style.opacity = level.toFixed(3);
  };
}
