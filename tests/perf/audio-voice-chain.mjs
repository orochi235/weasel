/**
 * What one `play()` costs in real Chromium, split into the node work under it.
 *
 * Node-level variants, each doing one voice's worth of Web Audio calls:
 *
 *   - `fresh`    — a new gain + stereo panner per play, disconnected at the end.
 *   - `pooled`   — one chain per slot, left wired to the bus while idle.
 *   - `detached` — one chain per slot, wired to the bus only while it sounds.
 *   - `source`   — the single-use `AudioBufferSourceNode` alone. The floor.
 *   - `engine`   — `createAudioEngine` from this tree: `play()`, the scheduler
 *                  pass that mints the source, and `stop()`.
 *   - `engine@base` — the same, built from `--base <git-ref>`.
 *
 * Realtime rows time the synchronous work of each frame's burst on a running
 * `AudioContext`. Offline rows render 20 s through an `OfflineAudioContext`,
 * driving the same churn from `suspend()` points, and subtract the main-thread
 * time spent inside them — what is left is the audio thread's share, including
 * idle chains that are wired to the bus with nothing playing.
 *
 * Run: node tests/perf/audio-voice-chain.mjs [--rounds 5] [--frames 60]
 *        [--modes fresh,engine] [--base main] [--out results.json]
 *
 * Writes one result file (see tests/perf/README.md). This reports; it does not gate.
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { metric, startRun } from './lib/result.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const require = createRequire(join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const esbuild = require('esbuild');

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const ROUNDS = Number(arg('rounds', 5));
const FRAMES = Number(arg('frames', 60));
const OUT = arg('out', null);
const BASE = arg('base', null);
const ALL_MODES = ['fresh', 'pooled', 'detached', 'source', 'engine', ...(BASE ? ['engine@base'] : [])];
const MODES = arg('modes', ALL_MODES.join(',')).split(',');

const baseSha = BASE ? execFileSync('git', ['-C', ROOT, 'rev-parse', BASE], { encoding: 'utf8' }).trim() : null;
const run = startRun('audio-voice-chain', {
  rounds: ROUNDS, frames: FRAMES, modes: MODES, base: BASE ? { ref: BASE, sha: baseSha } : null,
});

const bundleFrom = (srcDir, globalName) => esbuild.buildSync({
  entryPoints: [join(srcDir, 'index.ts')],
  bundle: true, write: false, format: 'iife', globalName, target: 'es2022',
}).outputFiles[0].text;

const bundles = [bundleFrom(join(ROOT, 'packages/audio/src'), 'WeaselAudio')];
if (BASE) {
  const dir = mkdtempSync(join(tmpdir(), 'audio-base-'));
  try {
    const tar = execFileSync('git', ['-C', ROOT, 'archive', BASE, 'packages/audio/src']);
    execFileSync('tar', ['-x', '-C', dir], { input: tar });
    bundles.push(bundleFrom(join(dir, 'packages/audio/src'), 'WeaselAudioBase'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const pageSetup = () => {
  const chainModes = {
    fresh: (ctx, bus, buf) => ({
      play() {
        const g = ctx.createGain();
        const p = ctx.createStereoPanner();
        g.gain.value = 0.5;
        p.pan.value = 0.2;
        p.connect(g);
        g.connect(bus);
        const s = ctx.createBufferSource();
        s.buffer = buf;
        s.playbackRate.value = 1;
        s.detune.value = 0;
        s.connect(p);
        s.onended = () => {};
        s.start();
        return { s, p, g };
      },
      end(v) {
        try { v.s.stop(); } catch { /* ended */ }
        v.s.disconnect();
        v.p.disconnect();
        v.g.disconnect();
      },
    }),
    pooled: (ctx, bus, buf, V) => slotChains(ctx, bus, buf, V, false),
    detached: (ctx, bus, buf, V) => slotChains(ctx, bus, buf, V, true),
    source: (ctx, bus, buf) => ({
      play() {
        const s = ctx.createBufferSource();
        s.buffer = buf;
        s.connect(bus);
        s.onended = () => {};
        s.start();
        return { s };
      },
      end(v) {
        try { v.s.stop(); } catch { /* ended */ }
        v.s.disconnect();
      },
    }),
    engine: (ctx, _bus, buf, V) => engineMode(window.WeaselAudio, ctx, buf, V),
    'engine@base': (ctx, _bus, buf, V) => engineMode(window.WeaselAudioBase, ctx, buf, V),
  };

  function slotChains(ctx, bus, buf, V, detach) {
    const chains = Array.from({ length: V }, () => {
      const g = ctx.createGain();
      const p = ctx.createStereoPanner();
      p.connect(g);
      if (!detach) g.connect(bus);
      return { g, p };
    });
    return {
      play(slot) {
        const c = chains[slot];
        const t = ctx.currentTime;
        c.g.gain.cancelScheduledValues(t);
        c.g.gain.setValueAtTime(0.5, t);
        c.p.pan.value = 0.2;
        if (detach) c.g.connect(bus);
        const s = ctx.createBufferSource();
        s.buffer = buf;
        s.playbackRate.value = 1;
        s.detune.value = 0;
        s.connect(c.p);
        s.onended = () => {};
        s.start();
        return { s, g: c.g };
      },
      end(v) {
        try { v.s.stop(); } catch { /* ended */ }
        v.s.disconnect();
        if (detach) v.g.disconnect();
      },
    };
  }

  function engineMode(lib, ctx, buf, V) {
    let pass = null;
    const engine = lib.createAudioEngine({
      context: ctx, voiceLimit: V, buses: ['sfx'],
      setTimer: (cb) => { pass = cb; return 1; }, clearTimer: () => {},
    });
    const sound = engine.register(buf);
    return {
      play() {
        const h = engine.play(sound, { gain: 0.5, pan: 0.2 });
        pass?.();
        return h;
      },
      end(h) { h.stop(); },
      dispose() { engine.dispose(); },
    };
  }

  const makeBuffer = (ctx) => {
    const buf = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.05), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const churn = (mode, live, state, B) => {
    for (let b = 0; b < B; b++) {
      const slot = state.k++ % live.length;
      if (live[slot]) mode.end(live[slot]);
      live[slot] = mode.play(slot);
    }
  };

  window.__realtime = async (modeName, V, B, frames) => {
    const ctx = new AudioContext();
    await ctx.resume();
    const bus = ctx.createGain();
    bus.connect(ctx.destination);
    const mode = chainModes[modeName](ctx, bus, makeBuffer(ctx), V);
    const live = new Array(V).fill(null);
    const state = { k: 0 };
    churn(mode, live, state, V * 4);   // fill every slot, and warm the JIT
    await sleep(50);
    gc();
    const heap0 = performance.memory.usedJSHeapSize;
    let busy = 0;
    let worst = 0;
    for (let f = 0; f < frames; f++) {
      const t0 = performance.now();
      churn(mode, live, state, B);
      const dt = performance.now() - t0;
      busy += dt;
      worst = Math.max(worst, dt);
      await sleep(16);
    }
    const heap1 = performance.memory.usedJSHeapSize;
    const g0 = performance.now();
    gc();
    const gcMs = performance.now() - g0;
    for (const v of live) if (v) mode.end(v);
    mode.dispose?.();
    await ctx.close();
    const plays = frames * B;
    return {
      usPerPlay: (busy * 1000) / plays,
      worstFrameMs: worst,
      heapBytesPerPlay: (heap1 - heap0) / plays,
      gcMs,
    };
  };

  window.__offline = async (modeName, V, B, seconds) => {
    const sr = 48000;
    const ctx = new OfflineAudioContext(2, sr * seconds, sr);
    const bus = ctx.createGain();
    bus.connect(ctx.destination);
    const mode = chainModes[modeName](ctx, bus, makeBuffer(ctx), V);
    const live = new Array(V).fill(null);
    const state = { k: 0 };
    let mainMs = 0;
    const frameSec = 1 / 60;
    for (let f = 1; f * frameSec < seconds - 0.05; f++) {
      ctx.suspend(f * frameSec).then(() => {
        const t0 = performance.now();
        churn(mode, live, state, B);
        mainMs += performance.now() - t0;
        ctx.resume();
      });
    }
    const t0 = performance.now();
    await ctx.startRendering();
    const wall = performance.now() - t0;
    mode.dispose?.();
    return { renderMs: wall - mainMs, mainMs };
  };
};

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const num = (x, width, digits) => x.toFixed(digits).padStart(width);
const int = (x, width) => String(x).padStart(width);

const browser = await chromium.launch({
  headless: true,
  args: [
    // Fixed, large semi-spaces keep scavenges out of a run, so the heap delta is the allocation.
    '--js-flags=--expose-gc --min-semi-space-size=64 --max-semi-space-size=64',
    '--enable-precise-memory-info',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const results = [];
try {
  const page = await browser.newPage();
  // Served as a cross-origin-isolated secure context, which lifts the
  // performance.now() clamp from 100 us to 5 us.
  await page.route('http://localhost:9/', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    body: '<!doctype html><title>audio-voice-chain</title>',
  }));
  await page.goto('http://localhost:9/');
  for (const content of bundles) await page.addScriptTag({ content });
  await page.evaluate(`(${pageSetup.toString()})()`);
  run.machine({ browser: `chromium ${browser.version()}` });
  console.log(`chromium ${browser.version()}, crossOriginIsolated=${await page.evaluate('crossOriginIsolated')}`);

  const realtime = [];
  for (const V of [32, 128]) for (const B of [8, 32]) for (const m of MODES) realtime.push({ m, V, B });
  // The engine drops plays offline: an OfflineAudioContext reads 'suspended' inside suspend().
  const chainOnly = MODES.filter((m) => !m.startsWith('engine'));
  const offline = [
    ...chainOnly.filter((m) => m !== 'source').map((m) => ({ m, V: 96, B: 0 })),
    ...chainOnly.map((m) => ({ m, V: 32, B: 32 })),
  ];
  const total = (realtime.length + offline.length) * ROUNDS;
  let n = 0;
  // Rounds interleave the modes, so load on a shared box drifts across all of them alike.
  for (let r = 0; r < ROUNDS; r++) {
    for (const c of realtime) {
      const res = await page.evaluate(([m, V, B, F]) => window.__realtime(m, V, B, F), [c.m, c.V, c.B, FRAMES]);
      results.push({ kind: 'realtime', round: r, ...c, ...res });
      console.log(
        `${int(++n, 3)}/${total} realtime ${c.m.padEnd(11)} V=${int(c.V, 3)} B=${int(c.B, 2)}  ` +
        `${num(res.usPerPlay, 6, 2)} us/play  worst ${num(res.worstFrameMs, 5, 2)} ms  ` +
        `heap ${num(res.heapBytesPerPlay, 5, 0)} B/play  gc ${num(res.gcMs, 5, 2)} ms`,
      );
    }
    for (const c of offline) {
      const res = await page.evaluate(([m, V, B]) => window.__offline(m, V, B, 20), [c.m, c.V, c.B]);
      results.push({ kind: 'offline', round: r, ...c, ...res });
      console.log(
        `${int(++n, 3)}/${total} offline  ${c.m.padEnd(11)} V=${int(c.V, 3)} B=${int(c.B, 2)}  ` +
        `render ${num(res.renderMs, 6, 1)} ms  main ${num(res.mainMs, 6, 1)} ms`,
      );
    }
  }
} finally {
  await browser.close();
}

const groups = new Map();
for (const x of results) {
  const key = `${x.kind}|${x.m}|${x.V}|${x.B}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(x);
}
const pick = (kind) => [...groups.values()].filter((xs) => xs[0].kind === kind);
console.log(`\nmedians of ${ROUNDS}, realtime: main-thread time per play, bursts of B plays per 16 ms frame, V voices`);
console.log('mode           V   B  us/play  worst-frame-ms  heap-B/play  gc-ms');
for (const xs of pick('realtime')) {
  const { m, V, B } = xs[0];
  console.log(
    `${m.padEnd(11)}  ${int(V, 3)}  ${int(B, 2)}  ${num(median(xs.map((x) => x.usPerPlay)), 7, 2)}  ` +
    `${num(median(xs.map((x) => x.worstFrameMs)), 14, 2)}  ` +
    `${num(median(xs.map((x) => x.heapBytesPerPlay)), 11, 0)}  ${num(median(xs.map((x) => x.gcMs)), 5, 2)}`,
  );
}
console.log(`\nmedians of ${ROUNDS}, offline: audio-thread ms to render 20 s, B plays per 1/60 s (B=0: V idle chains)`);
console.log('mode           V   B  render-ms  main-ms');
for (const xs of pick('offline')) {
  const { m, V, B } = xs[0];
  console.log(
    `${m.padEnd(11)}  ${int(V, 3)}  ${int(B, 2)}  ${num(median(xs.map((x) => x.renderMs)), 9, 1)}  ` +
    `${num(median(xs.map((x) => x.mainMs)), 7, 1)}`,
  );
}
const stat = (what) => `median of ${ROUNDS} rounds${what}`;
for (const xs of pick('realtime')) {
  const { m, V, B } = xs[0];
  const col = (k) => xs.map((x) => x[k]);
  const over = `, each over ${FRAMES} frames`;
  run.item(`realtime ${m} V=${V} B=${B}`, {
    perPlay: metric(median(col('usPerPlay')), 'us', stat(over), col('usPerPlay')),
    worstFrame: metric(median(col('worstFrameMs')), 'ms', stat(`, each the worst of ${FRAMES} frames`), col('worstFrameMs')),
    heapPerPlay: metric(median(col('heapBytesPerPlay')), 'bytes', stat(over), col('heapBytesPerPlay')),
    gc: metric(median(col('gcMs')), 'ms', stat(over), col('gcMs')),
  }, { kind: 'realtime', mode: m, voices: V, playsPerFrame: B });
}
for (const xs of pick('offline')) {
  const { m, V, B } = xs[0];
  const col = (k) => xs.map((x) => x[k]);
  run.item(`offline ${m} V=${V} B=${B}`, {
    render: metric(median(col('renderMs')), 'ms', stat(', each rendering 20 s'), col('renderMs')),
    main: metric(median(col('mainMs')), 'ms', stat(', each rendering 20 s'), col('mainMs')),
  }, { kind: 'offline', mode: m, voices: V, playsPerFrame: B });
}
run.write({ out: OUT ?? undefined });
