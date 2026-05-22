const preview = document.getElementById('motion-preview');
const motionToggle = document.getElementById('motion-toggle');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let playing = false;

function setMotion(on) {
  playing = on;
  preview.src = on ? preview.dataset.motion : preview.dataset.still;
  motionToggle.textContent = on ? 'Pause motion loop' : 'Play motion loop';
  motionToggle.setAttribute('aria-pressed', String(on));
}

motionToggle.hidden = false;
motionToggle.addEventListener('click', () => setMotion(!playing));
reducedMotion.addEventListener('change', event => {
  if (event.matches) setMotion(false);
});
setMotion(!reducedMotion.matches);

for (const button of document.querySelectorAll('[data-copy]')) {
  button.hidden = false;
  button.addEventListener('click', async () => {
    const status = document.getElementById('copy-status');
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      button.textContent = 'Copied';
      status.textContent = 'Server command copied to clipboard.';
      setTimeout(() => { button.textContent = 'Copy'; }, 1800);
    } catch {
      status.textContent = 'Clipboard access is unavailable. Select the command to copy it manually.';
    }
  });
}