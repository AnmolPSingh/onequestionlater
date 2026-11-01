// Visitors whose device asks for reduced motion get the finished page, still and silent.
export const isCalm = () => document.documentElement.classList.contains('calm');
