// Procedural soundtrack: a 120 BPM electronic bed with sound design cued to the film's events.
const BPM = 120;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const noteHz = n => 440 * Math.pow(2, (n - 69) / 12);

// D minor: Dm9, Bbmaj7, Fadd9, C6 — one chord per bar.
const CHORDS = [
  { root: 38, tones: [62, 65, 69, 76] },
  { root: 34, tones: [58, 62, 65, 69] },
  { root: 41, tones: [60, 65, 69, 67] },
  { root: 36, tones: [60, 64, 67, 69] },
];

function noiseBuffer(ctx, seconds) {
  const buf = ctx.createBuffer(2, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  let seed = 1234567;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = rand();
  }
  return buf;
}

function impulse(ctx, seconds, decay) {
  const len = Math.ceil(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  let seed = 42;
  const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296 * 2 - 1; };
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = rand() * Math.pow(1 - i / len, decay);
  }
  return buf;
}

// Energy per section: 0 silent .. 1 full. cues: { impacts, whooshes, risers, clicks, typing, blips }
// sections: { energy: [[t, level], ...], drums, hats, bass, arp: [[from, to], ...] }. Anything left out
// gets a default shaped to the film's length.
export async function renderSoundtrack(duration, cues, sampleRate = 48000, sections = {}) {
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
  const master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.18;
  master.connect(comp).connect(ctx.destination);

  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 3.2, 3.4);
  const reverbGain = ctx.createGain();
  reverbGain.gain.value = 0.32;
  reverb.connect(reverbGain).connect(master);

  const delay = ctx.createDelay(1);
  delay.delayTime.value = BEAT * 0.75;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.32;
  const delayTone = ctx.createBiquadFilter();
  delayTone.type = 'lowpass'; delayTone.frequency.value = 3200;
  delay.connect(delayTone).connect(feedback).connect(delay);
  const delayOut = ctx.createGain();
  delayOut.gain.value = 0.35;
  delayTone.connect(delayOut).connect(master);

  const noise = noiseBuffer(ctx, 2);
  const end = duration;
  const pts = sections.energy || [[0, 0.15], [3.8, 0.35], [4, 0.75], [Math.max(4.5, end - 6), 0.95], [Math.max(5, end - 4), 0.35], [end, 0]];
  const energy = t => {
    for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) {
      const [t0, v0] = pts[i - 1], [t1, v1] = pts[i];
      return v0 + (v1 - v0) * ((t - t0) / (t1 - t0));
    }
    return 0;
  };
  const within = spans => t => spans.some(([a, b]) => t >= a && t < b);
  const drumsOn = within(sections.drums || [[8, end - 5]]);
  const hatsOn = within(sections.hats || [[12, end - 5]]);
  const bassOn = within(sections.bass || [[4, end - 2]]);
  const arpSpans = sections.arp || [[16, end - 5]];

  // Sidechain-style pumping bus for pads and bass.
  const pump = ctx.createGain();
  pump.connect(master);
  pump.connect(reverb);
  for (let t = 0; t < duration; t += BEAT) {
    if (!drumsOn(t)) continue;
    pump.gain.setValueAtTime(0.45, t);
    pump.gain.linearRampToValueAtTime(1, t + BEAT * 0.8);
  }

  // Pads.
  for (let bar = 0; bar * BAR < duration; bar++) {
    const start = bar * BAR;
    const chord = CHORDS[bar % CHORDS.length];
    const level = 0.035 + 0.03 * energy(start);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(700 + 2400 * energy(start), start);
    filter.frequency.linearRampToValueAtTime(900 + 2800 * energy(start + BAR), start + BAR);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(level, start + 0.35);
    env.gain.setValueAtTime(level, start + BAR - 0.1);
    env.gain.linearRampToValueAtTime(0, start + BAR + 0.6);
    filter.connect(env).connect(pump);
    chord.tones.forEach((n, i) => {
      for (const detune of [-8, 7]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = noteHz(n);
        osc.detune.value = detune;
        const pan = ctx.createStereoPanner();
        pan.pan.value = (i / 3 - 0.5) * 0.8 * Math.sign(detune);
        osc.connect(pan).connect(filter);
        osc.start(start);
        osc.stop(start + BAR + 0.7);
      }
    });
  }

  // Bass: root in eighths when the groove plays, a long note otherwise.
  for (let bar = 0; bar * BAR < duration; bar++) {
    const start = bar * BAR;
    if (!bassOn(start)) continue;
    const root = CHORDS[bar % CHORDS.length].root;
    const steps = drumsOn(start) ? 8 : 1;
    for (let s = 0; s < steps; s++) {
      const t = start + s * (BAR / steps);
      const len = steps === 8 ? BAR / 8 * 0.9 : BAR;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = noteHz(root + (s % 4 === 3 ? 12 : 0));
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = noteHz(root - 12);
      const g = ctx.createGain();
      const lvl = steps === 8 ? 0.16 : 0.1;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(lvl, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + len);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      osc.connect(lp); sub.connect(lp);
      lp.connect(g).connect(pump);
      osc.start(t); sub.start(t);
      osc.stop(t + len + 0.05); sub.stop(t + len + 0.05);
    }
  }

  // Arpeggio of chord tones in sixteenths, through the delay.
  const sixteenth = BEAT / 4;
  for (const [from, to] of arpSpans) for (let t = Math.max(0, Math.ceil(from / sixteenth) * sixteenth); t < to; t += sixteenth) {
    const bar = Math.floor(t / BAR);
    const chord = CHORDS[bar % CHORDS.length].tones;
    const step = Math.round((t - bar * BAR) / (BEAT / 4));
    const n = chord[[0, 2, 1, 3, 2, 1, 3, 0][step % 8]] + 12;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = noteHz(n);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(600, t + 0.12);
    const g = ctx.createGain();
    const lvl = 0.018 * (0.6 + 0.6 * energy(t)) * (step % 4 === 0 ? 1.3 : 1);
    g.gain.setValueAtTime(lvl, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.16);
    const pan = ctx.createStereoPanner();
    pan.pan.value = step % 2 ? 0.35 : -0.35;
    osc.connect(lp).connect(g).connect(pan);
    pan.connect(master); pan.connect(delay);
    osc.start(t); osc.stop(t + 0.18);
  }

  const kick = t => {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    osc.connect(g).connect(master);
    osc.start(t); osc.stop(t + 0.45);
  };
  const noiseHit = (t, { type = 'highpass', freq = 7000, q = 0.8, len = 0.05, level = 0.1, pan = 0, send = 0 }) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + len);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(f).connect(g).connect(p).connect(master);
    if (send) { const s = ctx.createGain(); s.gain.value = send; p.connect(s).connect(reverb); }
    src.start(t, Math.random() * 1.5); src.stop(t + len + 0.02);
  };

  for (let t = 0; t < duration; t += BEAT) {
    if (drumsOn(t)) kick(t);
    const beatInBar = Math.round((t % BAR) / BEAT);
    if (drumsOn(t) && t >= 12 && (beatInBar === 1 || beatInBar === 3)) {
      noiseHit(t, { type: 'bandpass', freq: 1800, q: 0.9, len: 0.18, level: 0.16, send: 0.5 });
    }
  }
  for (let t = 0; t < duration; t += BEAT / 4) {
    if (!hatsOn(t)) continue;
    const step = Math.round((t % BEAT) / (BEAT / 4));
    const level = step === 2 ? 0.07 : 0.028;
    noiseHit(t, { freq: 8000, len: step === 2 ? 0.06 : 0.03, level, pan: step % 2 ? 0.25 : -0.2 });
  }

  // Sound design.
  const whoosh = (t, len = 0.7, up = true) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.1;
    f.frequency.setValueAtTime(up ? 300 : 5000, t);
    f.frequency.exponentialRampToValueAtTime(up ? 5000 : 300, t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0005, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + len * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0005, t + len);
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(-0.5, t); p.pan.linearRampToValueAtTime(0.5, t + len);
    src.connect(f).connect(g).connect(p);
    p.connect(master);
    const s = ctx.createGain(); s.gain.value = 0.4; p.connect(s).connect(reverb);
    src.start(t, 0.2); src.stop(t + len + 0.05);
  };
  const riser = (t, len) => {
    const src = ctx.createBufferSource();
    src.buffer = noise; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(6000, t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0005, t); g.gain.exponentialRampToValueAtTime(0.14, t + len * 0.95); g.gain.linearRampToValueAtTime(0, t + len);
    src.connect(f).connect(g).connect(master);
    const s = ctx.createGain(); s.gain.value = 0.5; g.connect(s).connect(reverb);
    src.start(t); src.stop(t + len);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(110, t); osc.frequency.exponentialRampToValueAtTime(880, t + len);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0005, t); og.gain.exponentialRampToValueAtTime(0.03, t + len * 0.95); og.gain.linearRampToValueAtTime(0, t + len);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    osc.connect(lp).connect(og).connect(master);
    osc.start(t); osc.stop(t + len);
  };
  const impact = t => {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 1.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.85, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    osc.connect(g).connect(master);
    osc.start(t); osc.stop(t + 1.7);
    noiseHit(t, { type: 'lowpass', freq: 900, q: 0.5, len: 0.9, level: 0.35, send: 0.9 });
    noiseHit(t, { type: 'highpass', freq: 4000, q: 0.5, len: 0.35, level: 0.08, send: 0.6 });
  };
  const click = (t, level = 0.22) => {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(2200, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.03);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.05);
    osc.connect(g).connect(master);
    osc.start(t); osc.stop(t + 0.06);
    noiseHit(t, { type: 'bandpass', freq: 3500, q: 2, len: 0.02, level: level * 0.6 });
  };
  const blip = (t, level = 0.07) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1320, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0005, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.35);
    osc.connect(g);
    g.connect(master);
    const s = ctx.createGain(); s.gain.value = 0.6; g.connect(s).connect(reverb);
    osc.start(t); osc.stop(t + 0.4);
  };
  (cues.impacts || []).forEach(impact);
  (cues.whooshes || []).forEach(([t, len, up]) => whoosh(t, len, up));
  (cues.risers || []).forEach(([t, len]) => riser(t, len));
  (cues.clicks || []).forEach(t => click(t));
  (cues.typing || []).forEach(t => noiseHit(t, { type: 'bandpass', freq: 3000 + Math.random() * 1500, q: 1.5, len: 0.025, level: 0.05 + Math.random() * 0.03, pan: (Math.random() - 0.5) * 0.3 }));
  (cues.blips || []).forEach(t => blip(t));

  // Fade the whole mix in and out.
  master.gain.setValueAtTime(0, 0);
  master.gain.linearRampToValueAtTime(0.9, 0.6);
  master.gain.setValueAtTime(0.9, duration - 2.2);
  master.gain.linearRampToValueAtTime(0, duration - 0.05);

  const rendered = await ctx.startRendering();
  // Normalise the peak to -1 dBFS.
  let peak = 0;
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    const d = rendered.getChannelData(c);
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  }
  const gain = peak > 0 ? 0.891 / peak : 1;
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    const d = rendered.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= gain;
  }
  return rendered;
}

export async function encodeAac(buffer, bitrate = 192000) {
  const chunks = [];
  let asc = null;
  const encoder = new AudioEncoder({
    output(chunk, meta) {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      chunks.push({ data, timestamp: chunk.timestamp, duration: chunk.duration });
      if (meta && meta.decoderConfig && meta.decoderConfig.description && !asc) {
        const d = meta.decoderConfig.description;
        asc = new Uint8Array(d instanceof ArrayBuffer ? d : d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength));
      }
    },
    error(e) { throw e; },
  });
  encoder.configure({ codec: 'mp4a.40.2', sampleRate: buffer.sampleRate, numberOfChannels: 2, bitrate });
  const frame = 1024;
  const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
  for (let i = 0; i < buffer.length; i += frame) {
    const n = Math.min(frame, buffer.length - i);
    const planar = new Float32Array(n * 2);
    planar.set(left.subarray(i, i + n), 0);
    planar.set(right.subarray(i, i + n), n);
    const data = new AudioData({ format: 'f32-planar', sampleRate: buffer.sampleRate, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i / buffer.sampleRate * 1e6), data: planar });
    encoder.encode(data);
    data.close();
  }
  await encoder.flush();
  encoder.close();
  if (!asc) asc = Uint8Array.of(0x11, 0x90);
  return { chunks, asc, sampleRate: buffer.sampleRate, channels: 2, bitrate };
}

export function wavBlob(buffer) {
  const channels = buffer.numberOfChannels, rate = buffer.sampleRate, n = buffer.length;
  const out = new DataView(new ArrayBuffer(44 + n * channels * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + n * channels * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, channels, true);
  out.setUint32(24, rate, true); out.setUint32(28, rate * channels * 2, true); out.setUint16(32, channels * 2, true); out.setUint16(34, 16, true);
  w(36, 'data'); out.setUint32(40, n * channels * 2, true);
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < channels; c++) { out.setInt16(o, Math.max(-1, Math.min(1, data[c][i])) * 32767, true); o += 2; }
  return new Blob([out.buffer], { type: 'audio/wav' });
}
