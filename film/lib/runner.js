// Automation for agents and scripts. film/index.html?run=<action> performs one action, then writes
// film/out/report.json, which tools/run.py waits for. Actions:
//   check   load the storyboard, verify screens, boxes and encoders, time a few frames
//   stills  save JPEG stills at each beat's key moments, or at ?times=1.5,4,9.2
//   sheet   save contact sheets: labelled grids of frames, film/out/sheet-1.jpg, sheet-2.jpg, ...
//   proof   save each screen with its named boxes drawn on it, film/out/proof-<screen>.jpg
//   render  render the MP4, or ?from=&to= for part of it, to film/out/<name>.mp4
import { out, shots, post, renderFrame, pickVideoCodec, aacSupported } from './core.js';

const NAME = /^[a-z0-9][a-z0-9_-]{0,60}$/;

async function save(report) {
  await post('/save/out/report.json', new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
}
const describe = error => String((error && (error.stack || error.message)) || error);

// film: the started film or null; failure: the error that stopped it from starting, if any.
export async function automate(film, failure, params) {
  const report = {
    action: params.get('run'), story: params.get('story') || 'storyboard.js', token: params.get('token') || null,
    started: new Date().toISOString(), done: false, ok: false, errors: [], warnings: [], steps: [], files: [],
  };
  const t0 = performance.now();
  try {
    if (failure) throw failure;
    report.duration = Number(film.duration.toFixed(2));
    report.beats = film.timeline;
    report.warnings.push(...film.warnings);
    if (document.visibilityState !== 'visible') report.warnings.push('The page is hidden; browsers slow hidden tabs down. Keep the window visible.');
    const action = ACTIONS[report.action];
    if (!action) throw new Error(`Unknown action "${report.action}"; use one of ${Object.keys(ACTIONS).join(', ')}`);
    await action(film, params, report);
    report.ok = true;
  } catch (error) {
    report.errors.push(describe(error));
  }
  report.errors.push(...(window.__filmErrors || []));
  report.ok = report.ok && report.errors.length === 0;
  report.seconds = Math.round((performance.now() - t0) / 100) / 10;
  report.done = true;
  await save(report);
  document.title = `${report.ok ? 'done' : 'failed'} · ${report.action}`;
  return report;
}

function times(film, params, withTransitions) {
  const given = params.get('times');
  if (!given) return film.stillTimes(withTransitions);
  return given.split(',').map(Number).filter(t => Number.isFinite(t) && t >= 0 && t < film.duration);
}
function nameOf(params, fallback) {
  const name = params.get('name') || fallback;
  if (!NAME.test(name)) throw new Error(`?name= must use a-z, 0-9, '-' and '_': ${name}`);
  return name;
}

const ACTIONS = {
  async check(film, params, report) {
    report.support = { video: await pickVideoCodec(), audio: await aacSupported() };
    if (!report.support.video) report.errors.push('No H.264 VideoEncoder: rendering needs Chrome or Edge');
    if (!report.support.audio) report.warnings.push('No AAC AudioEncoder: the MP4 will be silent; the soundtrack is saved as a WAV beside it');
    const probes = [0.5, film.duration / 2, Math.max(0, film.duration - 1)];
    const t = performance.now();
    for (const p of probes) renderFrame(p);
    report.frameMs = Math.round((performance.now() - t) / probes.length);
    report.screens = Object.values(shots).map(s => ({ name: s.name, size: [s.W, s.H], scale: s.scale, boxes: Object.keys(s.boxes) }));
    report.steps.push(`checked ${film.timeline.length} beats over ${film.duration.toFixed(1)} s`);
  },

  async stills(film, params, report) {
    const list = times(film, params, true);
    const prefix = nameOf(params, 'still');
    const saved = await film.preview(list, prefix);
    report.files = saved.map(f => `film/out/${f}`);
    report.stills = list.map((t, i) => ({ t, file: report.files[i], beat: film.beatAt(t).label }));
    report.steps.push(`saved ${saved.length} stills`);
  },

  async sheet(film, params, report) {
    const list = times(film, params, params.has('transitions'));
    const prefix = nameOf(params, 'sheet');
    const cols = 4, per = 20, tw = 480, th = 270, label = 30, gap = 8;
    for (let s = 0; s * per < list.length; s++) {
      const chunk = list.slice(s * per, (s + 1) * per);
      const rows = Math.ceil(chunk.length / cols);
      const canvas = new OffscreenCanvas(cols * (tw + gap) + gap, rows * (th + label + gap) + gap);
      const g = canvas.getContext('2d');
      g.fillStyle = '#16181D';
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.font = '600 16px "Segoe UI", system-ui, sans-serif';
      g.textBaseline = 'alphabetic';
      chunk.forEach((t, i) => {
        renderFrame(t);
        const x = gap + (i % cols) * (tw + gap), y = gap + Math.floor(i / cols) * (th + label + gap);
        g.drawImage(out, x, y, tw, th);
        const beat = film.beatAt(t);
        let text = `${t.toFixed(2)} s  ·  ${beat.index} ${beat.label}`;
        while (g.measureText(text).width > tw - 8 && text.length > 8) text = `${text.slice(0, -2)}…`;
        g.fillStyle = '#D7DBE3';
        g.fillText(text, x + 4, y + th + 21);
      });
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.86 });
      const file = `${prefix}-${s + 1}.jpg`;
      await post(`/save/out/${file}`, blob);
      report.files.push(`film/out/${file}`);
    }
    report.sheetTimes = list;
    report.steps.push(`saved ${report.files.length} contact sheet(s) with ${list.length} frames`);
  },

  async proof(film, params, report) {
    const palette = ['#F87171', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#F472B6', '#2DD4BF', '#FB923C'];
    for (const s of Object.values(shots)) {
      const k = Math.min(1800 / s.W, 2600 / s.H, s.scale);
      const canvas = new OffscreenCanvas(Math.round(s.W * k) + 80, Math.round(s.H * k) + 80);
      const g = canvas.getContext('2d');
      g.fillStyle = '#16181D';
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.imageSmoothingQuality = 'high';
      g.drawImage(s.bmp, 40, 40, s.W * k, s.H * k);
      g.font = '700 15px "Segoe UI", system-ui, sans-serif';
      Object.entries(s.boxes).forEach(([key, b], i) => {
        const color = palette[i % palette.length];
        const [x, y, w, h] = [40 + b[0] * k, 40 + b[1] * k, b[2] * k, b[3] * k];
        g.strokeStyle = color;
        g.lineWidth = 2;
        g.strokeRect(x, y, w, h);
        const tw = g.measureText(key).width + 10;
        const ly = y >= 62 ? y - 22 : y + 2;
        g.fillStyle = color;
        g.fillRect(x, ly, tw, 20);
        g.fillStyle = '#0B0D12';
        g.fillText(key, x + 5, ly + 15);
      });
      g.fillStyle = '#D7DBE3';
      g.fillText(`${s.name}  ·  ${s.W}x${s.H} layout px at ${s.scale}x  ·  ${Object.keys(s.boxes).length} boxes`, 40, 26);
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.88 });
      const file = `proof-${s.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}.jpg`;
      await post(`/save/out/${file}`, blob);
      report.files.push(`film/out/${file}`);
    }
    report.steps.push(`saved ${report.files.length} box proofs`);
  },

  async render(film, params, report) {
    const from = Number(params.get('from') || 0);
    const to = Number(params.get('to') || film.duration);
    if (!(from >= 0 && to > from && to <= film.duration + 0.001)) throw new Error(`?from= and ?to= must satisfy 0 <= from < to <= ${film.duration.toFixed(2)}`);
    const name = nameOf(params, 'film');
    let saved = performance.now();
    const result = await film.renderVideo({
      from, to, name,
      onProgress: t => {
        report.progress = `${(t - from).toFixed(0)} of ${(to - from).toFixed(0)} s`;
        if (performance.now() - saved > 4000) {
          saved = performance.now();
          save(report).catch(() => {});
        }
      },
    });
    report.render = result;
    report.files.push(result.file, `film/out/${name}-soundtrack.wav`);
    if (!result.audio) report.warnings.push(`No AAC encoder here: ${result.file} has no sound; the soundtrack is film/out/${name}-soundtrack.wav`);
    report.steps.push(`rendered ${result.frames} frames, ${(result.bytes / 1048576).toFixed(1)} MB`);
  },
};
