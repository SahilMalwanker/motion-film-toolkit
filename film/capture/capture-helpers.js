// Capture helpers injected into the page being filmed: element boxes in layout (CSS) pixels.
// captureBox('Save') finds the smallest visible element whose text starts with 'Save';
// { card: true } climbs to the enclosing rounded, bordered or filled panel.
window.captureBox = function captureBox(text, options = {}) {
  const scope = options.scope ? document.querySelector(options.scope) : document.body;
  if (!scope) return null;
  let best = null;
  for (const el of scope.querySelectorAll(options.selector || '*')) {
    if (el.closest('svg')) continue;
    const own = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
    if (!own) continue;
    const hit = options.exact ? own === text : own.startsWith(text);
    if (!hit) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
    if (getComputedStyle(el).visibility === 'hidden') continue;
    if (!best || r.width * r.height < best.area) best = { el, area: r.width * r.height };
  }
  if (!best) return null;
  let node = best.el;
  if (options.card) {
    let walker = best.el;
    while (walker && walker !== document.body) {
      const cs = getComputedStyle(walker);
      const radius = parseFloat(cs.borderTopLeftRadius) || 0;
      const bordered = (parseFloat(cs.borderTopWidth) || 0) > 0;
      const filled = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
      const r = walker.getBoundingClientRect();
      if (radius >= 6 && (bordered || filled) && r.height >= (options.minHeight || 40) && r.width >= (options.minWidth || 60)) { node = walker; break; }
      walker = walker.parentElement;
    }
  }
  const r = node.getBoundingClientRect();
  return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
};

window.captureRect = function captureRect(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
};

window.captureStyle = function captureStyle(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const cs = getComputedStyle(el);
  return {
    font: `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,
    fontSize: parseFloat(cs.fontSize),
    lineHeight: parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5,
    color: cs.color,
    background: cs.backgroundColor,
    padding: [parseFloat(cs.paddingTop), parseFloat(cs.paddingRight), parseFloat(cs.paddingBottom), parseFloat(cs.paddingLeft)],
  };
};
