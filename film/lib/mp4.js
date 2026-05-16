// Minimal fast-start MP4 writer for one H.264 video track and one AAC audio track.
const enc = new TextEncoder();

function concat(parts) {
  const size = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
const u8 = v => Uint8Array.of(v & 255);
const u16 = v => Uint8Array.of((v >>> 8) & 255, v & 255);
const u24 = v => Uint8Array.of((v >>> 16) & 255, (v >>> 8) & 255, v & 255);
const u32 = v => Uint8Array.of((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
const i32 = v => u32(v >>> 0);
const str = s => enc.encode(s);
const zeros = n => new Uint8Array(n);

function box(type, ...parts) {
  const body = concat(parts.flat());
  return concat([u32(8 + body.length), str(type), body]);
}
const full = (type, version, flags, ...parts) => box(type, u8(version), u24(flags), ...parts);

const MATRIX = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].map(u32);

function mvhd(durationMs, nextTrack) {
  return full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(durationMs), u32(0x00010000), u16(0x0100), zeros(10), ...MATRIX, zeros(24), u32(nextTrack));
}

function tkhd(id, durationMs, width, height, audio) {
  return full('tkhd', 0, 3, u32(0), u32(0), u32(id), u32(0), u32(durationMs), zeros(8), u16(0), u16(audio ? 1 : 0), u16(audio ? 0x0100 : 0), u16(0), ...MATRIX, u32(width * 65536), u32(height * 65536));
}

function mdhd(timescale, duration) {
  return full('mdhd', 0, 0, u32(0), u32(0), u32(timescale), u32(duration), u16(0x55c4), u16(0));
}

function hdlr(type, name) {
  return full('hdlr', 0, 0, u32(0), str(type), zeros(12), str(name), u8(0));
}

const dinf = () => box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1)));

function runs(values) {
  const out = [];
  for (const v of values) {
    const last = out[out.length - 1];
    if (last && last[1] === v) last[0] += 1; else out.push([1, v]);
  }
  return out;
}

function sampleTables(entry, track, offsets) {
  const n = track.samples.length;
  const stts = runs(track.samples.map(s => s.duration));
  const parts = [
    full('stsd', 0, 0, u32(1), entry),
    full('stts', 0, 0, u32(stts.length), ...stts.flatMap(([count, delta]) => [u32(count), u32(delta)])),
  ];
  if (track.samples.some(s => s.offset)) {
    const ctts = runs(track.samples.map(s => s.offset || 0));
    parts.push(full('ctts', 0, 0, u32(ctts.length), ...ctts.flatMap(([count, off]) => [u32(count), i32(off)])));
  }
  if (track.samples.some(s => !s.key)) {
    const keys = track.samples.map((s, i) => (s.key ? i + 1 : 0)).filter(Boolean);
    parts.push(full('stss', 0, 0, u32(keys.length), ...keys.map(u32)));
  }
  parts.push(
    full('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1)),
    full('stsz', 0, 0, u32(0), u32(n), ...track.samples.map(s => u32(s.data.length))),
    full('stco', 0, 0, u32(n), ...offsets.map(u32)),
  );
  return box('stbl', ...parts);
}

const COLOR = {
  primaries: { bt709: 1, bt470bg: 5, smpte170m: 6, bt2020: 9, smpte432: 12 },
  transfer: { bt709: 1, smpte170m: 6, 'iec61966-2-1': 13, linear: 8, pq: 16, hlg: 18 },
  matrix: { rgb: 0, bt709: 1, bt470bg: 5, smpte170m: 6, 'bt2020-ncl': 9 },
};

function avc1(video) {
  const extra = [box('avcC', video.avcC)];
  const cs = video.colorSpace;
  if (cs && cs.primaries && cs.transfer && cs.matrix) {
    extra.push(box('colr', str('nclx'), u16(COLOR.primaries[cs.primaries] ?? 2), u16(COLOR.transfer[cs.transfer] ?? 2), u16(COLOR.matrix[cs.matrix] ?? 2), u8(cs.fullRange ? 0x80 : 0)));
  }
  const name = zeros(32);
  const label = str('WebCodecs H.264');
  name.set(label, 1);
  name[0] = label.length;
  return box('avc1', zeros(6), u16(1), u16(0), u16(0), zeros(12), u16(video.width), u16(video.height), u32(0x00480000), u32(0x00480000), u32(0), u16(1), name, u16(0x18), u16(0xffff), ...extra);
}

function descriptor(tag, body) {
  return concat([u8(tag), u8(0x80), u8(0x80), u8(0x80), u8(body.length), body]);
}

function mp4a(audio) {
  const decoderSpecific = descriptor(0x05, audio.asc);
  const decoderConfig = descriptor(0x04, concat([u8(0x40), u8(0x15), u24(0), u32(audio.bitrate), u32(audio.bitrate), decoderSpecific]));
  const es = descriptor(0x03, concat([u16(2), u8(0), decoderConfig, descriptor(0x06, u8(0x02))]));
  const esds = full('esds', 0, 0, es);
  return box('mp4a', zeros(6), u16(1), zeros(8), u16(audio.channels), u16(16), u16(0), u16(0), u32(audio.sampleRate * 65536), esds);
}

function trak(id, track, entry, offsets, audio) {
  const mediaDuration = track.samples.reduce((n, s) => n + s.duration, 0);
  const ms = Math.round((mediaDuration / track.timescale) * 1000);
  const minf = audio
    ? box('minf', full('smhd', 0, 0, u16(0), u16(0)), dinf(), sampleTables(entry, track, offsets))
    : box('minf', full('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)), dinf(), sampleTables(entry, track, offsets));
  return box('trak',
    tkhd(id, ms, audio ? 0 : track.width, audio ? 0 : track.height, audio),
    box('mdia', mdhd(track.timescale, mediaDuration), hdlr(audio ? 'soun' : 'vide', audio ? 'SoundHandler' : 'VideoHandler'), minf),
  );
}

// video: { width, height, timescale, avcC, colorSpace, samples: [{ data, duration, offset, key }] }
// audio: { sampleRate, channels, bitrate, asc, timescale, samples: [{ data, duration, key: true }] }
export function writeMp4(video, audio) {
  const tracks = [video, audio].filter(Boolean);
  // Interleave samples by decode time so players read the file front to back.
  const order = [];
  tracks.forEach((track, t) => {
    let time = 0;
    track.samples.forEach((s, i) => { order.push({ t, i, time: time / track.timescale }); time += s.duration; });
  });
  order.sort((a, b) => a.time - b.time || a.t - b.t);
  const ftyp = box('ftyp', str('isom'), u32(0x200), str('isom'), str('iso2'), str('avc1'), str('mp41'));
  const durationMs = Math.max(...tracks.map(tr => Math.round((tr.samples.reduce((n, s) => n + s.duration, 0) / tr.timescale) * 1000)));
  const build = offsets => box('moov', mvhd(durationMs, tracks.length + 1),
    trak(1, video, avc1(video), offsets[0], false),
    ...(audio ? [trak(2, audio, mp4a(audio), offsets[1], true)] : []));
  const placeholder = tracks.map(tr => tr.samples.map(() => 0));
  const moovSize = build(placeholder).length;
  const offsets = tracks.map(tr => new Array(tr.samples.length));
  let at = ftyp.length + moovSize + 8;
  for (const { t, i } of order) { offsets[t][i] = at; at += tracks[t].samples[i].data.length; }
  const moov = build(offsets);
  if (moov.length !== moovSize) throw new Error('moov size changed while writing offsets');
  const mdatSize = at - ftyp.length - moovSize;
  const parts = [ftyp, moov, u32(mdatSize), str('mdat')];
  for (const { t, i } of order) parts.push(tracks[t].samples[i].data);
  return new Blob(parts, { type: 'video/mp4' });
}
