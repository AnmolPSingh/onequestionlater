// Threads are written in % of their stage. Drawing them in real pixels keeps the line one even weight
// and lets its length-based reveal work, which a stretched SVG doesn't.
export function fitThreads(scope = document) {
  scope.querySelectorAll('svg.thread').forEach((svg) => {
    const { width, height } = svg.getBoundingClientRect();
    if (!width) return;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.querySelectorAll('path').forEach((path) => {
      if (!path.dataset.d) path.dataset.d = path.getAttribute('d');
      let axis = 0;
      path.setAttribute('d', path.dataset.d.replace(/-?\d+(\.\d+)?/g, (n) => (parseFloat(n) * (axis++ % 2 ? height : width) / 100).toFixed(1)));
    });
  });
}
