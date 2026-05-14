// Tiled 2x capture, for browsers whose device scale factor cannot be set (embedded or remote browsers).
// Each tile is the page scaled up with a CSS transform and screenshotted over CDP; the tiles are
// stitched into one 2x PNG in the film page, which saves it through server.py with a JSON manifest.
// If you can launch the browser yourself, tools/capture.py (device scale factor 2) is simpler.
//
// page: the app being filmed (Playwright Page); cdp: a CDP session for that page;
// film: a Playwright Page open on the film server (for example http://127.0.0.1:8020/capture/);
// baseUrl: the app's origin, for go(path).
//
//   const cdp = await page.context().newCDPSession(page);
//   const cap = await tiledCapture({ page, film, cdp, baseUrl: 'http://localhost:3000' });
//   await cap.setSize(1920, 1080);
//   await cap.go('/dashboard');
//   const boxes = { summary: await page.evaluate(() => window.captureBox('Summary', { card: true })) };
//   await cap.tiled('overview', 1920, 1080, boxes);
async function tiledCapture({ page, film, cdp, baseUrl }) {
  const helper = await film.evaluate(() => fetch('/capture/capture-helpers.js').then(r => r.text()));
  const setSize = async (W, H) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false, screenWidth: W, screenHeight: H });
    await page.waitForTimeout(700);
  };
  const settle = () => page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(res, 140)))));
  // Inject the box helpers and hide scrollbars and text carets.
  const prep = async () => {
    await page.evaluate(helper);
    await page.evaluate(() => {
      if (!document.getElementById('film-capture-style')) {
        const style = document.createElement('style');
        style.id = 'film-capture-style';
        style.textContent = '*::-webkit-scrollbar{width:0!important;height:0!important;display:none!important} *{scrollbar-width:none!important;caret-color:transparent!important}';
        document.head.appendChild(style);
      }
    });
  };
  const go = async (path, wait = 2600) => {
    await page.goto(baseUrl + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(wait);
    await prep();
  };
  const saveJson = async (name, data) => {
    const body = JSON.stringify(data);
    await film.evaluate(async ({ name, body }) => { await fetch('/save/shots/' + name + '.json', { method: 'POST', body }); }, { name, body });
  };
  // Capture the top-left W x H layout pixels of the page at 2x as shots/<name>.png, plus <name>.json.
  const tiled = async (name, W, H, boxes, extra = {}) => {
    const probe = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const surface = await film.evaluate(b64 => {
      const b = Uint8Array.from(atob(b64.slice(0, 64)), c => c.charCodeAt(0));
      const v = new DataView(b.buffer);
      return { w: v.getUint32(16), h: v.getUint32(20) };
    }, probe.data);
    const fit = Math.min(surface.w / W, surface.h / H);
    const s = Math.ceil(2.02 / fit);
    // The transform moves content under the resting pointer, so hover styles would differ per tile.
    // Route changes can focus the main region, which draws a focus ring around the whole page.
    await page.evaluate(() => {
      if (document.activeElement && document.activeElement.tagName === 'MAIN') document.activeElement.blur();
      const style = document.createElement('style');
      style.id = 'film-no-hover';
      style.textContent = '*{pointer-events:none!important}';
      document.head.appendChild(style);
    });
    await settle();
    const tiles = [];
    for (let r = 0; r < s; r++) for (let c = 0; c < s; c++) {
      await page.evaluate(({ tx, ty, s }) => {
        const el = document.documentElement;
        el.style.transformOrigin = '0 0';
        el.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
      }, { tx: -c * W, ty: -r * H, s });
      await settle();
      tiles.push((await cdp.send('Page.captureScreenshot', { format: 'png' })).data);
    }
    await page.evaluate(() => {
      document.documentElement.style.transform = '';
      document.getElementById('film-no-hover')?.remove();
    });
    const kb = await film.evaluate(async ({ tiles, name, W, H, s }) => {
      const canvas = new OffscreenCanvas(W * 2, H * 2);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      for (let i = 0; i < tiles.length; i++) {
        const bytes = Uint8Array.from(atob(tiles[i]), ch => ch.charCodeAt(0));
        const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const fit = Math.min(bmp.width / W, bmp.height / H);
        const c = i % s, r = Math.floor(i / s);
        ctx.drawImage(bmp, 0, 0, W * fit, H * fit, c * 2 * W / s, r * 2 * H / s, 2 * W / s, 2 * H / s);
        bmp.close();
      }
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      await fetch('/save/shots/' + name + '.png', { method: 'POST', body: blob });
      return Math.round(blob.size / 1024);
    }, { tiles, name, W, H, s });
    await saveJson(name, { name, width: W, height: H, scale: 2, boxes, ...extra });
    return { name, s, kb };
  };
  return { setSize, settle, prep, go, tiled, saveJson };
}

if (typeof module !== 'undefined') module.exports = tiledCapture;
