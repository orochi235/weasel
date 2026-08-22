# `@weasel-js/audio` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone Web Audio engine — loading, voices, buses, 2D spatialization, and analysis — with no weasel dependencies.

**Architecture:** Everything follows from the audio clock being hardware-driven and unpausable, so playback is lookahead-scheduled on the engine's own `setInterval` rather than triggered from a frame. The interesting logic (spatialization, scheduling, voice stealing) is pure and tested without a browser; the Web Audio node wiring around it stays thin. `AudioContext`, timers, and `fetch` are all injectable, which is what makes that possible under jsdom.

**Tech Stack:** TypeScript, vitest (jsdom). No runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-08-22-audio-engine-design.md`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/audio/src/types.ts` | Public types: options, handles, taps |
| `packages/audio/src/spatialize.ts` | Pure: position + listener → `{ gain, pan }` |
| `packages/audio/src/scheduler.ts` | Lookahead scheduler over injectable clock + timers |
| `packages/audio/src/soundCache.ts` | Fetch + decode + cache by URL |
| `packages/audio/src/voicePool.ts` | Pure: slot allocation and steal policy |
| `packages/audio/src/buses.ts` | Bus graph: gain, mute, solo, routing to master |
| `packages/audio/src/analyser.ts` | Analyser taps, including `bands(n)` |
| `packages/audio/src/createAudioEngine.ts` | Assembly: context lifecycle, `play`, wiring |
| `packages/audio/src/index.ts` | Public barrel |
| `packages/audio/src/testing/fakeAudioContext.ts` | Minimal Web Audio double for tests |

jsdom implements no Web Audio at all, so **every test either avoids `AudioContext` entirely or injects the fake**. Tasks 2–4 need no fake; that is deliberate.

New `packages/*` workspaces are auto-discovered by `weaselAliases` (used by `vitest.config.ts` and `vite.config.ts`) and by `scripts/check-publish-manifests.mjs`, so **none of those need editing**. The root `tsconfig.json` and `package.json` do.

Tests land in the `weasel-ui` vitest project, whose include glob is `packages/**/*.test.{ts,tsx}` minus core and labkit. Run them with `npx vitest run --project=weasel-ui packages/audio/`.

---

### Task 1: Scaffold the package

**Files:**
- Create: `packages/audio/package.json`
- Create: `packages/audio/tsconfig.json`
- Create: `packages/audio/tsup.config.ts`
- Create: `packages/audio/README.md`
- Create: `packages/audio/src/index.ts`
- Create: `packages/audio/src/index.test.ts`
- Modify: `package.json` (root) — `build:leaves`
- Modify: `tsconfig.json` (root) — `paths` and `include`
- Modify: `.changeset/config.json` — `fixed` group

- [ ] **Step 1: Write the manifest**

Modeled on `packages/geom/package.json`. Version starts at the group's current
version — read it with `node -p "require('./packages/geom/package.json').version"`
and substitute below.

```json
{
  "name": "@weasel-js/audio",
  "version": "1.0.4",
  "description": "Web Audio engine for 2D scenes: voices, buses, lookahead scheduling, spatialization and analysis. No weasel dependencies.",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./package.json": "./package.json"
  },
  "scripts": {
    "test": "vitest run",
    "build": "tsup"
  },
  "author": "orochi235",
  "homepage": "https://orochi235.github.io/weasel/",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/orochi235/weasel.git",
    "directory": "packages/audio"
  },
  "bugs": {
    "url": "https://github.com/orochi235/weasel/issues"
  },
  "engines": {
    "node": ">=22"
  },
  "files": ["dist", "README.md", "LICENSE"],
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

- [ ] **Step 2: Write the build config**

`packages/audio/tsup.config.ts` — one entry, since this package ships no
subpaths:

```ts
import { defineConfig } from 'tsup';
import { packagePreset } from '../../scripts/tsup-preset';

export default defineConfig(
  packagePreset({
    entry: { index: 'src/index.ts' },
  }),
);
```

`packages/audio/tsconfig.json` — identical in shape to every other leaf:

```json
{
  "extends": "../../tsconfig.json",
  "include": ["src"],
  "compilerOptions": {
    "rootDir": "src",
    "noEmit": true
  }
}
```

- [ ] **Step 3: Write a placeholder barrel and a test that proves resolution**

```ts
// packages/audio/src/index.ts
/** Package version marker, used by the workspace-resolution test. */
export const AUDIO_PACKAGE = '@weasel-js/audio';
```

```ts
// packages/audio/src/index.test.ts
import { describe, expect, it } from 'vitest';
import { AUDIO_PACKAGE } from '@weasel-js/audio';

describe('@weasel-js/audio', () => {
  it('resolves through the workspace alias', () => {
    expect(AUDIO_PACKAGE).toBe('@weasel-js/audio');
  });
});
```

- [ ] **Step 4: Register the package in the three places that are not automatic**

In root `package.json`, add `-w @weasel-js/audio` to the end of `build:leaves`:

```json
"build:leaves": "npm run build -w @weasel-js/geom -w @weasel-js/gestures -w @weasel-js/history -w @weasel-js/modes -w @weasel-js/theme -w @weasel-js/font -w @weasel-js/audio",
```

In root `tsconfig.json`, add to `compilerOptions.paths`:

```json
    "@weasel-js/audio": ["./packages/audio/src/index.ts"],
```

and add `"packages/audio/src"` to the `include` array.

In `.changeset/config.json`, add `"@weasel-js/audio"` to the single `fixed`
group array. It becomes the fourteenth member; one bump still moves all of them.

- [ ] **Step 5: Install and run the test**

Run: `npm install && npx vitest run --project=weasel-ui packages/audio/`
Expected: PASS, 1 test. `npm install` is needed so npm links the new workspace.

- [ ] **Step 6: Write the README**

```markdown
# @weasel-js/audio

Web Audio engine for 2D scenes. No weasel dependencies — positional audio takes
plain `{ x, y }`.

Playback is lookahead-scheduled on the engine's own timer rather than triggered
from an animation frame: `AudioContext.currentTime` is driven by the audio
hardware, ticks independently of `requestAnimationFrame`, and cannot be paused
or time-scaled. Triggering a sound *on* a frame inherits frame jitter, which is
audible.

```ts
const engine = createAudioEngine();
const jump = await engine.load('/sfx/jump.wav');
engine.play(jump, { bus: 'sfx', position: { x: 40, y: 0 } });
```

Browsers start an `AudioContext` suspended until a user gesture. The engine
resumes on the first gesture automatically; `play()` before that drops the voice
with a dev warning rather than queueing it.
```

- [ ] **Step 7: Verify the build and manifest check**

Run: `npm run build -w @weasel-js/audio && node scripts/check-publish-manifests.mjs`
Expected: both exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/audio package.json tsconfig.json .changeset/config.json package-lock.json
git commit -m "scaffold the @weasel-js/audio package"
```

---

### Task 2: `spatialize`

**Files:**
- Create: `packages/audio/src/spatialize.ts`
- Test: `packages/audio/src/spatialize.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { spatialize } from './spatialize';

const L = { x: 0, y: 0 };

describe('spatialize', () => {
  it('is full gain and centered at the listener', () => {
    expect(spatialize({ x: 0, y: 0 }, L)).toEqual({ gain: 1, pan: 0 });
  });

  it('holds full gain inside refDistance', () => {
    expect(spatialize({ x: 0, y: 5 }, L, { refDistance: 10 }).gain).toBe(1);
  });

  it('falls off with distance past refDistance', () => {
    const near = spatialize({ x: 0, y: 20 }, L, { refDistance: 10 }).gain;
    const far = spatialize({ x: 0, y: 40 }, L, { refDistance: 10 }).gain;
    expect(near).toBeLessThan(1);
    expect(far).toBeLessThan(near);
    expect(far).toBeGreaterThan(0);
  });

  it('pans right for a source to the right', () => {
    expect(spatialize({ x: 50, y: 0 }, L, { panWidth: 100 }).pan).toBeCloseTo(0.5, 6);
  });

  it('pans left for a source to the left', () => {
    expect(spatialize({ x: -50, y: 0 }, L, { panWidth: 100 }).pan).toBeCloseTo(-0.5, 6);
  });

  it('clamps pan to the -1..1 range', () => {
    expect(spatialize({ x: 9999, y: 0 }, L, { panWidth: 100 }).pan).toBe(1);
    expect(spatialize({ x: -9999, y: 0 }, L, { panWidth: 100 }).pan).toBe(-1);
  });

  it('pans relative to the listener, not the origin', () => {
    expect(spatialize({ x: 100, y: 0 }, { x: 150, y: 0 }, { panWidth: 100 }).pan)
      .toBeCloseTo(-0.5, 6);
  });

  it('reaches exactly zero gain at maxDistance under linear rolloff', () => {
    const out = spatialize({ x: 0, y: 100 }, L, {
      rolloff: 'linear', refDistance: 0, maxDistance: 100,
    });
    expect(out.gain).toBe(0);
  });

  it('never returns negative gain past maxDistance', () => {
    const out = spatialize({ x: 0, y: 500 }, L, {
      rolloff: 'linear', refDistance: 0, maxDistance: 100,
    });
    expect(out.gain).toBe(0);
  });

  it('ignores vertical offset for pan', () => {
    expect(spatialize({ x: 0, y: 500 }, L, { panWidth: 100 }).pan).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/audio/src/spatialize.test.ts`
Expected: FAIL — cannot resolve `./spatialize`.

- [ ] **Step 3: Write the implementation**

```ts
export interface Vec2 { x: number; y: number }

export interface SpatialOptions {
  /** Distance within which gain stays at 1. Default 1. */
  refDistance?: number;
  /** Distance at which linear rolloff reaches 0. Ignored by inverse. Default 10000. */
  maxDistance?: number;
  /** Default 'inverse' — the natural-sounding one. */
  rolloff?: 'inverse' | 'linear';
  /** How sharply gain falls. Default 1. */
  rolloffFactor?: number;
  /** Horizontal distance mapping to full left/right. Default 500. */
  panWidth?: number;
}

/**
 * Map a source position to a gain and a stereo pan, relative to the listener.
 *
 * Pure — no Web Audio, no state. This is the whole spatial model, which is why
 * it lives on its own: the node wiring that consumes it has nothing left worth
 * testing.
 */
export function spatialize(
  source: Vec2,
  listener: Vec2,
  opts: SpatialOptions = {},
): { gain: number; pan: number } {
  const refDistance = opts.refDistance ?? 1;
  const maxDistance = opts.maxDistance ?? 10000;
  const rolloffFactor = opts.rolloffFactor ?? 1;
  const panWidth = opts.panWidth ?? 500;

  const dx = source.x - listener.x;
  const dy = source.y - listener.y;
  const distance = Math.hypot(dx, dy);

  let gain: number;
  if (distance <= refDistance) {
    gain = 1;
  } else if ((opts.rolloff ?? 'inverse') === 'linear') {
    const span = maxDistance - refDistance;
    gain = span <= 0 ? 0 : 1 - rolloffFactor * ((distance - refDistance) / span);
  } else {
    gain = refDistance / (refDistance + rolloffFactor * (distance - refDistance));
  }
  gain = Math.min(1, Math.max(0, gain));

  const pan = panWidth <= 0 ? 0 : Math.min(1, Math.max(-1, dx / panWidth));

  return { gain, pan };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/audio/src/spatialize.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/audio/src/spatialize.ts packages/audio/src/spatialize.test.ts
git commit -m "map a 2D position to gain and pan as a pure function"
```

---

### Task 3: Lookahead scheduler

**Files:**
- Create: `packages/audio/src/scheduler.ts`
- Test: `packages/audio/src/scheduler.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createScheduler } from './scheduler';

/** Deterministic clock + timer pair. `tick()` runs one scheduler pass. */
function harness(startMs = 0) {
  let nowMs = startMs;
  let pass: (() => void) | null = null;
  const scheduler = createScheduler({
    now: () => nowMs,
    setTimer: (cb) => { pass = cb; return 1; },
    clearTimer: () => { pass = null; },
    lookahead: 100,
    interval: 25,
  });
  return {
    scheduler,
    advanceTo: (t: number) => { nowMs = t; },
    tick: () => pass?.(),
    isStopped: () => pass === null,
  };
}

describe('createScheduler', () => {
  it('fires an event already due on the next pass', () => {
    const h = harness();
    const fire = vi.fn();
    h.scheduler.start();
    h.scheduler.schedule(0, fire);
    h.tick();
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('fires an event inside the lookahead window early, with its true time', () => {
    const h = harness();
    const fire = vi.fn();
    h.scheduler.start();
    h.scheduler.schedule(80, fire);   // now=0, lookahead=100 → due
    h.tick();
    expect(fire).toHaveBeenCalledWith(80);
  });

  it('does not fire an event beyond the lookahead window', () => {
    const h = harness();
    const fire = vi.fn();
    h.scheduler.start();
    h.scheduler.schedule(500, fire);
    h.tick();
    expect(fire).not.toHaveBeenCalled();
  });

  it('fires it on a later pass once the window reaches it', () => {
    const h = harness();
    const fire = vi.fn();
    h.scheduler.start();
    h.scheduler.schedule(500, fire);
    h.tick();
    h.advanceTo(450);
    h.tick();
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('never fires the same event twice', () => {
    const h = harness();
    const fire = vi.fn();
    h.scheduler.start();
    h.scheduler.schedule(10, fire);
    h.tick();
    h.advanceTo(200);
    h.tick();
    h.tick();
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('fires due events in time order regardless of scheduling order', () => {
    const h = harness();
    const order: number[] = [];
    h.scheduler.start();
    h.scheduler.schedule(50, () => order.push(50));
    h.scheduler.schedule(10, () => order.push(10));
    h.scheduler.schedule(30, () => order.push(30));
    h.tick();
    expect(order).toEqual([10, 30, 50]);
  });

  it('cancels pending events by key without touching others', () => {
    const h = harness();
    const kept = vi.fn();
    const dropped = vi.fn();
    h.scheduler.start();
    h.scheduler.schedule(10, kept, 'keep');
    h.scheduler.schedule(10, dropped, 'drop');
    h.scheduler.cancelKey('drop');
    h.tick();
    expect(kept).toHaveBeenCalledTimes(1);
    expect(dropped).not.toHaveBeenCalled();
  });

  it('stops the timer on stop()', () => {
    const h = harness();
    h.scheduler.start();
    h.scheduler.stop();
    expect(h.isStopped()).toBe(true);
  });

  it('keeps running when one callback throws', () => {
    const h = harness();
    const after = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    h.scheduler.start();
    h.scheduler.schedule(10, () => { throw new Error('boom'); });
    h.scheduler.schedule(20, after);
    h.tick();
    expect(after).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/audio/src/scheduler.test.ts`
Expected: FAIL — cannot resolve `./scheduler`.

- [ ] **Step 3: Write the implementation**

```ts
export interface SchedulerOptions {
  /** Engine time in ms. Backed by `AudioContext.currentTime * 1000` in production. */
  now: () => number;
  setTimer: (cb: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  /** How far ahead to book events, in ms. Default 100. */
  lookahead?: number;
  /** Time between passes, in ms. Default 25. */
  interval?: number;
}

interface Entry {
  when: number;
  fire: (when: number) => void;
  key?: string;
}

export interface Scheduler {
  start(): void;
  stop(): void;
  /** Book `fire` for engine time `when`. It runs on the first pass whose
   *  lookahead window reaches it, receiving `when` so it can hand the true
   *  time to `source.start()` rather than "now". */
  schedule(when: number, fire: (when: number) => void, key?: string): void;
  cancelKey(key: string): void;
  pending(): number;
}

/**
 * Lookahead scheduler. Each pass fires everything due within `lookahead` ms,
 * in time order, handing each callback its own scheduled time.
 *
 * It runs on its own timer rather than on an animation frame: rAF throttles to
 * roughly 1 Hz in a backgrounded tab and stops when nothing is animating, both
 * of which stall audio exactly when nothing is on screen.
 */
export function createScheduler(opts: SchedulerOptions): Scheduler {
  const lookahead = opts.lookahead ?? 100;
  const interval = opts.interval ?? 25;
  let queue: Entry[] = [];
  let handle: unknown = null;

  const pass = (): void => {
    const horizon = opts.now() + lookahead;
    const due = queue.filter((e) => e.when <= horizon).sort((a, b) => a.when - b.when);
    if (due.length > 0) {
      const dueSet = new Set(due);
      queue = queue.filter((e) => !dueSet.has(e));
    }
    for (const entry of due) {
      try {
        entry.fire(entry.when);
      } catch (err) {
        console.error('@weasel-js/audio scheduler: callback threw', err);
      }
    }
    if (handle !== null) handle = opts.setTimer(pass, interval);
  };

  return {
    start() {
      if (handle !== null) return;
      // Non-null before the first setTimer so `pass` knows it is running.
      handle = true;
      handle = opts.setTimer(pass, interval);
    },
    stop() {
      if (handle === null) return;
      opts.clearTimer(handle);
      handle = null;
    },
    schedule(when, fire, key) {
      queue.push({ when, fire, key });
    },
    cancelKey(key) {
      queue = queue.filter((e) => e.key !== key);
    },
    pending: () => queue.length,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/audio/src/scheduler.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/audio/src/scheduler.ts packages/audio/src/scheduler.test.ts
git commit -m "book audio events on a lookahead scheduler with its own timer"
```

---

### Task 4: Voice slot allocation and stealing

**Files:**
- Create: `packages/audio/src/voicePool.ts`
- Test: `packages/audio/src/voicePool.test.ts`

Pure bookkeeping: which slot a new voice takes, and which one to evict when
full. No Web Audio.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { createVoicePool } from './voicePool';

describe('createVoicePool', () => {
  it('allocates distinct slots while under the limit', () => {
    const pool = createVoicePool({ limit: 3 });
    const a = pool.acquire({ startedAt: 0, gain: 1 });
    const b = pool.acquire({ startedAt: 1, gain: 1 });
    expect(a.slot).not.toBe(b.slot);
    expect(a.stolen).toBe(null);
    expect(b.stolen).toBe(null);
  });

  it('reuses a released slot instead of growing', () => {
    const pool = createVoicePool({ limit: 2 });
    const a = pool.acquire({ startedAt: 0, gain: 1 });
    pool.release(a.slot);
    const b = pool.acquire({ startedAt: 1, gain: 1 });
    expect(b.slot).toBe(a.slot);
    expect(b.stolen).toBe(null);
  });

  it('steals the oldest voice when full', () => {
    const pool = createVoicePool({ limit: 2, steal: 'oldest' });
    const a = pool.acquire({ startedAt: 10, gain: 1 });
    pool.acquire({ startedAt: 20, gain: 1 });
    const c = pool.acquire({ startedAt: 30, gain: 1 });
    expect(c.stolen).toBe(a.slot);
    expect(c.slot).toBe(a.slot);
  });

  it('steals the quietest voice under the quietest policy', () => {
    const pool = createVoicePool({ limit: 2, steal: 'quietest' });
    pool.acquire({ startedAt: 10, gain: 0.9 });
    const b = pool.acquire({ startedAt: 20, gain: 0.1 });
    const c = pool.acquire({ startedAt: 30, gain: 1 });
    expect(c.stolen).toBe(b.slot);
  });

  it('reports how many voices are live', () => {
    const pool = createVoicePool({ limit: 4 });
    pool.acquire({ startedAt: 0, gain: 1 });
    pool.acquire({ startedAt: 1, gain: 1 });
    expect(pool.active()).toBe(2);
  });

  it('drops the count when a voice is released', () => {
    const pool = createVoicePool({ limit: 4 });
    const a = pool.acquire({ startedAt: 0, gain: 1 });
    pool.release(a.slot);
    expect(pool.active()).toBe(0);
  });

  it('ignores a release for a slot that is not live', () => {
    const pool = createVoicePool({ limit: 2 });
    expect(() => pool.release(99)).not.toThrow();
    expect(pool.active()).toBe(0);
  });

  it('tracks a gain change so stealing sees the current value', () => {
    const pool = createVoicePool({ limit: 2, steal: 'quietest' });
    const a = pool.acquire({ startedAt: 10, gain: 1 });
    pool.acquire({ startedAt: 20, gain: 0.5 });
    pool.setGain(a.slot, 0.01);
    const c = pool.acquire({ startedAt: 30, gain: 1 });
    expect(c.stolen).toBe(a.slot);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/audio/src/voicePool.test.ts`
Expected: FAIL — cannot resolve `./voicePool`.

- [ ] **Step 3: Write the implementation**

```ts
export type StealPolicy = 'oldest' | 'quietest';

export interface VoicePoolOptions {
  /** Maximum concurrent voices. Beyond this, `acquire` steals. */
  limit: number;
  /** Default 'oldest'. */
  steal?: StealPolicy;
}

export interface VoiceRecord {
  /** Engine time the voice started, in ms. */
  startedAt: number;
  /** Current gain, consulted by the 'quietest' steal policy. */
  gain: number;
}

export interface Acquisition {
  slot: number;
  /** Slot whose voice was evicted to make room, or null. The caller is
   *  responsible for actually stopping that voice's nodes. */
  stolen: number | null;
}

export interface VoicePool {
  acquire(record: VoiceRecord): Acquisition;
  release(slot: number): void;
  setGain(slot: number, gain: number): void;
  active(): number;
}

/**
 * Slot bookkeeping for concurrent voices, with a steal policy for when the
 * limit is reached.
 *
 * This is pure accounting — it owns no audio nodes. The caller pools the
 * `GainNode`/`StereoPannerNode` chain per slot and mints a fresh
 * `AudioBufferSourceNode` per play, because a source node is single-use by
 * specification and cannot be restarted once stopped.
 */
export function createVoicePool(opts: VoicePoolOptions): VoicePool {
  const steal = opts.steal ?? 'oldest';
  const live = new Map<number, VoiceRecord>();
  const free: number[] = [];
  let nextSlot = 0;

  const victim = (): number => {
    let worst = -1;
    let worstScore = Infinity;
    for (const [slot, rec] of live) {
      const score = steal === 'quietest' ? rec.gain : rec.startedAt;
      if (score < worstScore) { worstScore = score; worst = slot; }
    }
    return worst;
  };

  return {
    acquire(record) {
      if (live.size < opts.limit) {
        const slot = free.length > 0 ? free.pop()! : nextSlot++;
        live.set(slot, { ...record });
        return { slot, stolen: null };
      }
      const slot = victim();
      live.set(slot, { ...record });
      return { slot, stolen: slot };
    },
    release(slot) {
      if (!live.delete(slot)) return;
      free.push(slot);
    },
    setGain(slot, gain) {
      const rec = live.get(slot);
      if (rec) rec.gain = gain;
    },
    active: () => live.size,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/audio/src/voicePool.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/audio/src/voicePool.ts packages/audio/src/voicePool.test.ts
git commit -m "allocate and steal voice slots as pure bookkeeping"
```

---

### Task 5: The Web Audio test double

**Files:**
- Create: `packages/audio/src/testing/fakeAudioContext.ts`
- Test: `packages/audio/src/testing/fakeAudioContext.test.ts`

jsdom implements none of Web Audio, so everything from here needs this.

- [ ] **Step 1: Write the fake**

```ts
/** Minimal Web Audio double. Records connections and calls so tests can assert
 *  graph shape and scheduling without a browser. Not a spec implementation —
 *  it covers exactly the surface `createAudioEngine` touches. */

export interface FakeParam { value: number; ramps: { value: number; at: number }[] }

const param = (value: number): FakeParam => ({
  value,
  ramps: [],
});

export interface FakeNode {
  kind: string;
  connectedTo: FakeNode[];
  disconnected: boolean;
  connect(target: FakeNode): FakeNode;
  disconnect(): void;
}

function node(kind: string, extra: Record<string, unknown> = {}): FakeNode & Record<string, unknown> {
  const n = {
    kind,
    connectedTo: [] as FakeNode[],
    disconnected: false,
    connect(target: FakeNode) { n.connectedTo.push(target); return target; },
    disconnect() { n.disconnected = true; },
    ...extra,
  } as FakeNode & Record<string, unknown>;
  return n;
}

export interface FakeAudioContext {
  state: 'suspended' | 'running' | 'closed';
  currentTime: number;
  destination: FakeNode;
  resume(): Promise<void>;
  createGain(): FakeNode & { gain: FakeParam };
  createStereoPanner(): FakeNode & { pan: FakeParam };
  createAnalyser(): FakeNode & { fftSize: number; frequencyBinCount: number;
    getByteFrequencyData(a: Uint8Array): void; getByteTimeDomainData(a: Uint8Array): void };
  createBufferSource(): FakeNode & { buffer: unknown; loop: boolean;
    playbackRate: FakeParam; detune: FakeParam;
    started: number[]; stopped: number[];
    start(when?: number): void; stop(when?: number): void;
    onended: (() => void) | null };
  decodeAudioData(bytes: ArrayBuffer): Promise<unknown>;
  /** Test hook: advance the audio clock. */
  _advance(ms: number): void;
  /** Test hook: every source node created, in order. */
  _sources: (FakeNode & { started: number[] })[];
  /** Test hook: canned analyser output. */
  _analyserBytes: number;
}

export function createFakeAudioContext(): FakeAudioContext {
  const sources: (FakeNode & { started: number[] })[] = [];
  const ctx: FakeAudioContext = {
    state: 'suspended',
    currentTime: 0,
    destination: node('destination'),
    async resume() { ctx.state = 'running'; },
    createGain: () => node('gain', { gain: param(1) }) as FakeNode & { gain: FakeParam },
    createStereoPanner: () => node('panner', { pan: param(0) }) as FakeNode & { pan: FakeParam },
    createAnalyser: () => node('analyser', {
      fftSize: 2048,
      frequencyBinCount: 1024,
      getByteFrequencyData(a: Uint8Array) { a.fill(ctx._analyserBytes); },
      getByteTimeDomainData(a: Uint8Array) { a.fill(ctx._analyserBytes); },
    }) as never,
    createBufferSource() {
      const s = node('source', {
        buffer: null,
        loop: false,
        playbackRate: param(1),
        detune: param(0),
        started: [] as number[],
        stopped: [] as number[],
        onended: null,
        start(when = 0) { (s as never as { started: number[] }).started.push(when); },
        stop(when = 0) { (s as never as { stopped: number[] }).stopped.push(when); },
      }) as never as FakeNode & { started: number[] };
      sources.push(s);
      return s as never;
    },
    async decodeAudioData() { return { duration: 1 }; },
    _advance(ms) { ctx.currentTime += ms / 1000; },
    _sources: sources,
    _analyserBytes: 128,
  };
  return ctx;
}
```

- [ ] **Step 2: Write a test proving the double behaves**

```ts
import { describe, expect, it } from 'vitest';
import { createFakeAudioContext } from './fakeAudioContext';

describe('createFakeAudioContext', () => {
  it('starts suspended and resumes', async () => {
    const ctx = createFakeAudioContext();
    expect(ctx.state).toBe('suspended');
    await ctx.resume();
    expect(ctx.state).toBe('running');
  });

  it('advances the clock in seconds when told milliseconds', () => {
    const ctx = createFakeAudioContext();
    ctx._advance(500);
    expect(ctx.currentTime).toBe(0.5);
  });

  it('records connections', () => {
    const ctx = createFakeAudioContext();
    const g = ctx.createGain();
    g.connect(ctx.destination);
    expect(g.connectedTo).toEqual([ctx.destination]);
  });

  it('records source start times and collects every source', () => {
    const ctx = createFakeAudioContext();
    const s = ctx.createBufferSource();
    s.start(1.25);
    expect(s.started).toEqual([1.25]);
    expect(ctx._sources).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run --project=weasel-ui packages/audio/src/testing/fakeAudioContext.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 4: Commit**

```bash
git add packages/audio/src/testing/
git commit -m "add a Web Audio test double covering the surface the engine uses"
```

---

### Task 6: Sound loading and caching

**Files:**
- Create: `packages/audio/src/soundCache.ts`
- Test: `packages/audio/src/soundCache.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createSoundCache } from './soundCache';
import { createFakeAudioContext } from './testing/fakeAudioContext';

const okFetch = () => vi.fn(async () => ({
  ok: true,
  arrayBuffer: async () => new ArrayBuffer(8),
})) as never;

describe('createSoundCache', () => {
  it('loads a url and returns an opaque handle', async () => {
    const ctx = createFakeAudioContext();
    const cache = createSoundCache(ctx as never, okFetch());
    const h = await cache.load('/a.wav');
    expect(typeof h.id).toBe('string');
  });

  it('returns the same handle for a repeat load', async () => {
    const ctx = createFakeAudioContext();
    const fetchFn = okFetch();
    const cache = createSoundCache(ctx as never, fetchFn);
    const a = await cache.load('/a.wav');
    const b = await cache.load('/a.wav');
    expect(b.id).toBe(a.id);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent loads of the same url', async () => {
    const ctx = createFakeAudioContext();
    const fetchFn = okFetch();
    const cache = createSoundCache(ctx as never, fetchFn);
    const [a, b] = await Promise.all([cache.load('/a.wav'), cache.load('/a.wav')]);
    expect(a.id).toBe(b.id);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('gives different urls different handles', async () => {
    const ctx = createFakeAudioContext();
    const cache = createSoundCache(ctx as never, okFetch());
    const a = await cache.load('/a.wav');
    const b = await cache.load('/b.wav');
    expect(a.id).not.toBe(b.id);
  });

  it('resolves a handle back to its decoded buffer', async () => {
    const ctx = createFakeAudioContext();
    const cache = createSoundCache(ctx as never, okFetch());
    const h = await cache.load('/a.wav');
    expect(cache.buffer(h)).toEqual({ duration: 1 });
  });

  it('throws with the url and status on a failed fetch', async () => {
    const ctx = createFakeAudioContext();
    const fetchFn = vi.fn(async () => ({ ok: false, status: 404 })) as never;
    const cache = createSoundCache(ctx as never, fetchFn);
    await expect(cache.load('/missing.wav')).rejects.toThrow(/missing\.wav.*404/);
  });

  it('does not cache a failed load, so a retry refetches', async () => {
    const ctx = createFakeAudioContext();
    let calls = 0;
    const fetchFn = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return { ok: false, status: 500 };
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
    }) as never;
    const cache = createSoundCache(ctx as never, fetchFn);
    await expect(cache.load('/x.wav')).rejects.toThrow();
    await expect(cache.load('/x.wav')).resolves.toBeDefined();
    expect(calls).toBe(2);
  });

  it('decodes raw bytes without a url', async () => {
    const ctx = createFakeAudioContext();
    const cache = createSoundCache(ctx as never, okFetch());
    const h = await cache.decode(new ArrayBuffer(8));
    expect(cache.buffer(h)).toEqual({ duration: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/audio/src/soundCache.test.ts`
Expected: FAIL — cannot resolve `./soundCache`.

- [ ] **Step 3: Write the implementation**

```ts
/** Opaque reference to a decoded sound. Mirrors `TextureHandle` in core. */
export interface SoundHandle { readonly id: string }

export interface SoundCache {
  load(url: string): Promise<SoundHandle>;
  loadAll(urls: Record<string, string>): Promise<Record<string, SoundHandle>>;
  decode(bytes: ArrayBuffer): Promise<SoundHandle>;
  buffer(handle: SoundHandle): AudioBuffer | null;
}

export function createSoundCache(
  ctx: AudioContext,
  fetchFn: typeof fetch = fetch,
): SoundCache {
  let counter = 0;
  const buffers = new Map<string, AudioBuffer>();
  const byUrl = new Map<string, SoundHandle>();
  // In-flight loads, so two concurrent `load` calls for one url share a fetch.
  const inflight = new Map<string, Promise<SoundHandle>>();

  const store = (buffer: AudioBuffer): SoundHandle => {
    const id = `snd_${++counter}`;
    buffers.set(id, buffer);
    return { id };
  };

  const cache: SoundCache = {
    async load(url) {
      const existing = byUrl.get(url);
      if (existing) return existing;
      const pending = inflight.get(url);
      if (pending) return pending;

      const task = (async () => {
        const res = await fetchFn(url);
        if (!res.ok) throw new Error(`@weasel-js/audio: failed to load ${url} (${res.status})`);
        const bytes = await res.arrayBuffer();
        const buffer = await ctx.decodeAudioData(bytes);
        const handle = store(buffer);
        byUrl.set(url, handle);
        return handle;
      })();

      inflight.set(url, task);
      try {
        return await task;
      } finally {
        // Always clear: a failed load must not be cached, or a retry can never
        // succeed for the lifetime of the page.
        inflight.delete(url);
      }
    },
    async loadAll(urls) {
      const names = Object.keys(urls);
      const handles = await Promise.all(names.map((n) => cache.load(urls[n])));
      return Object.fromEntries(names.map((n, i) => [n, handles[i]]));
    },
    async decode(bytes) {
      return store(await ctx.decodeAudioData(bytes));
    },
    buffer: (handle) => buffers.get(handle.id) ?? null,
  };
  return cache;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/audio/src/soundCache.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/audio/src/soundCache.ts packages/audio/src/soundCache.test.ts
git commit -m "cache decoded sounds by url and dedupe concurrent loads"
```

---

### Task 7: Bus graph

**Files:**
- Create: `packages/audio/src/buses.ts`
- Test: `packages/audio/src/buses.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { createBusGraph } from './buses';
import { createFakeAudioContext } from './testing/fakeAudioContext';

describe('createBusGraph', () => {
  it('routes every named bus to master and master to the destination', () => {
    const ctx = createFakeAudioContext();
    const graph = createBusGraph(ctx as never, ['sfx', 'music']);
    expect(graph.node('sfx').connectedTo).toContain(graph.master);
    expect(graph.node('music').connectedTo).toContain(graph.master);
    expect(graph.master.connectedTo).toContain(ctx.destination);
  });

  it('sets a bus gain', () => {
    const ctx = createFakeAudioContext();
    const graph = createBusGraph(ctx as never, ['sfx']);
    graph.bus('sfx').setGain(0.25);
    expect((graph.node('sfx') as never as { gain: { value: number } }).gain.value).toBe(0.25);
  });

  it('mutes a bus to zero and restores the prior gain on unmute', () => {
    const ctx = createFakeAudioContext();
    const graph = createBusGraph(ctx as never, ['sfx']);
    const gain = () => (graph.node('sfx') as never as { gain: { value: number } }).gain.value;
    graph.bus('sfx').setGain(0.4);
    graph.bus('sfx').mute(true);
    expect(gain()).toBe(0);
    graph.bus('sfx').mute(false);
    expect(gain()).toBe(0.4);
  });

  it('soloing one bus silences the others', () => {
    const ctx = createFakeAudioContext();
    const graph = createBusGraph(ctx as never, ['sfx', 'music']);
    const gain = (n: string) => (graph.node(n) as never as { gain: { value: number } }).gain.value;
    graph.bus('sfx').solo(true);
    expect(gain('sfx')).toBe(1);
    expect(gain('music')).toBe(0);
  });

  it('clearing the last solo restores every bus', () => {
    const ctx = createFakeAudioContext();
    const graph = createBusGraph(ctx as never, ['sfx', 'music']);
    const gain = (n: string) => (graph.node(n) as never as { gain: { value: number } }).gain.value;
    graph.bus('sfx').solo(true);
    graph.bus('sfx').solo(false);
    expect(gain('music')).toBe(1);
  });

  it('keeps a muted bus silent when it is also soloed', () => {
    const ctx = createFakeAudioContext();
    const graph = createBusGraph(ctx as never, ['sfx']);
    const gain = () => (graph.node('sfx') as never as { gain: { value: number } }).gain.value;
    graph.bus('sfx').mute(true);
    graph.bus('sfx').solo(true);
    expect(gain()).toBe(0);
  });

  it('throws for an unknown bus name', () => {
    const ctx = createFakeAudioContext();
    const graph = createBusGraph(ctx as never, ['sfx']);
    expect(() => graph.bus('nope')).toThrow(/nope/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/audio/src/buses.test.ts`
Expected: FAIL — cannot resolve `./buses`.

- [ ] **Step 3: Write the implementation**

```ts
export interface BusHandle {
  setGain(value: number, rampMs?: number): void;
  mute(on: boolean): void;
  solo(on: boolean): void;
}

export interface BusGraph {
  master: GainNode;
  node(name: string): GainNode;
  bus(name: string): BusHandle;
  names(): string[];
}

interface BusState { node: GainNode; gain: number; muted: boolean; soloed: boolean }

/**
 * The mix graph: one `GainNode` per named bus, all routed to a master that
 * routes to the destination.
 *
 * Gain, mute and solo are three inputs to one output value rather than three
 * things that write the node directly — otherwise unmuting restores the wrong
 * value whenever a solo changed it in between.
 */
export function createBusGraph(ctx: AudioContext, names: string[]): BusGraph {
  const master = ctx.createGain();
  master.connect(ctx.destination);

  const states = new Map<string, BusState>();
  for (const name of names) {
    const node = ctx.createGain();
    node.connect(master);
    states.set(name, { node, gain: 1, muted: false, soloed: false });
  }

  const anySoloed = (): boolean => {
    for (const s of states.values()) if (s.soloed) return true;
    return false;
  };

  const apply = (): void => {
    const soloing = anySoloed();
    for (const s of states.values()) {
      const audible = !s.muted && (!soloing || s.soloed);
      s.node.gain.value = audible ? s.gain : 0;
    }
  };

  const get = (name: string): BusState => {
    const s = states.get(name);
    if (!s) throw new Error(`@weasel-js/audio: unknown bus "${name}"`);
    return s;
  };

  return {
    master,
    node: (name) => get(name).node,
    names: () => [...states.keys()],
    bus(name) {
      const s = get(name);
      return {
        setGain(value, rampMs) {
          s.gain = value;
          if (rampMs && rampMs > 0) {
            s.node.gain.linearRampToValueAtTime?.(value, ctx.currentTime + rampMs / 1000);
          }
          apply();
        },
        mute(on) { s.muted = on; apply(); },
        solo(on) { s.soloed = on; apply(); },
      };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/audio/src/buses.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/audio/src/buses.ts packages/audio/src/buses.test.ts
git commit -m "derive bus gain from gain, mute and solo together"
```

---

### Task 8: Analyser taps

**Files:**
- Create: `packages/audio/src/analyser.ts`
- Test: `packages/audio/src/analyser.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { createAnalyserTap } from './analyser';
import { createFakeAudioContext } from './testing/fakeAudioContext';

describe('createAnalyserTap', () => {
  it('connects the analyser to the tapped node', () => {
    const ctx = createFakeAudioContext();
    const source = ctx.createGain();
    createAnalyserTap(ctx as never, source as never);
    expect(source.connectedTo.some((n) => n.kind === 'analyser')).toBe(true);
  });

  it('returns frequency data sized to the bin count', () => {
    const ctx = createFakeAudioContext();
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    expect(tap.frequencies()).toHaveLength(1024);
  });

  it('returns waveform data', () => {
    const ctx = createFakeAudioContext();
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    expect(tap.waveform()).toHaveLength(1024);
  });

  it('reuses a caller-supplied array instead of allocating', () => {
    const ctx = createFakeAudioContext();
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    const out = new Uint8Array(1024);
    expect(tap.frequencies(out)).toBe(out);
  });

  it('collapses bins into n bands', () => {
    const ctx = createFakeAudioContext();
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    expect(tap.bands(8)).toHaveLength(8);
  });

  it('normalizes bands to 0..1', () => {
    const ctx = createFakeAudioContext();
    ctx._analyserBytes = 255;
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    const bands = tap.bands(4);
    for (const b of bands) expect(b).toBeCloseTo(1, 6);
  });

  it('reports silence as zero level', () => {
    const ctx = createFakeAudioContext();
    ctx._analyserBytes = 128;   // 128 is the zero point for time-domain bytes
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    expect(tap.level()).toBeCloseTo(0, 3);
  });

  it('disconnects on dispose', () => {
    const ctx = createFakeAudioContext();
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    tap.dispose();
    expect(tap.node.disconnected).toBe(true);
  });

  it('throws for a band count below 1', () => {
    const ctx = createFakeAudioContext();
    const tap = createAnalyserTap(ctx as never, ctx.createGain() as never);
    expect(() => tap.bands(0)).toThrow(/bands/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/audio/src/analyser.test.ts`
Expected: FAIL — cannot resolve `./analyser`.

- [ ] **Step 3: Write the implementation**

```ts
export interface AnalyserTapOptions {
  /** Power of two, 32..32768. Default 2048. */
  fftSize?: number;
}

export interface AnalyserTap {
  /** The underlying node, exposed for disposal assertions and advanced wiring. */
  node: AnalyserNode;
  frequencies(out?: Uint8Array): Uint8Array;
  waveform(out?: Uint8Array): Uint8Array;
  /** RMS amplitude, 0..1. */
  level(): number;
  /** `n` averaged frequency bands normalized to 0..1 — the ergonomic form for
   *  driving a shader uniform, a vertex color, or a pose. */
  bands(n: number): Float32Array;
  dispose(): void;
}

export function createAnalyserTap(
  ctx: AudioContext,
  source: AudioNode,
  opts: AnalyserTapOptions = {},
): AnalyserTap {
  const node = ctx.createAnalyser();
  node.fftSize = opts.fftSize ?? 2048;
  source.connect(node);

  const freqScratch = new Uint8Array(node.frequencyBinCount);
  const timeScratch = new Uint8Array(node.frequencyBinCount);

  return {
    node,
    frequencies(out) {
      const target = out ?? new Uint8Array(node.frequencyBinCount);
      node.getByteFrequencyData(target);
      return target;
    },
    waveform(out) {
      const target = out ?? new Uint8Array(node.frequencyBinCount);
      node.getByteTimeDomainData(target);
      return target;
    },
    level() {
      node.getByteTimeDomainData(timeScratch);
      let sum = 0;
      for (let i = 0; i < timeScratch.length; i += 1) {
        // Time-domain bytes center on 128; subtract to get a signed sample.
        const v = (timeScratch[i] - 128) / 128;
        sum += v * v;
      }
      return Math.sqrt(sum / timeScratch.length);
    },
    bands(n) {
      if (!Number.isInteger(n) || n < 1) {
        throw new Error('@weasel-js/audio: bands(n) requires a positive integer');
      }
      node.getByteFrequencyData(freqScratch);
      const out = new Float32Array(n);
      const per = freqScratch.length / n;
      for (let b = 0; b < n; b += 1) {
        const lo = Math.floor(b * per);
        const hi = Math.max(lo + 1, Math.floor((b + 1) * per));
        let sum = 0;
        for (let i = lo; i < hi; i += 1) sum += freqScratch[i];
        out[b] = sum / (hi - lo) / 255;
      }
      return out;
    },
    dispose() { node.disconnect(); },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/audio/src/analyser.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/audio/src/analyser.ts packages/audio/src/analyser.test.ts
git commit -m "tap a node for frequency, waveform, level and n bands"
```

---

### Task 9: Engine assembly — context lifecycle and `play`

**Files:**
- Create: `packages/audio/src/types.ts`
- Create: `packages/audio/src/createAudioEngine.ts`
- Test: `packages/audio/src/createAudioEngine.test.ts`

- [ ] **Step 1: Write the public types**

```ts
// packages/audio/src/types.ts
import type { Vec2 } from './spatialize';
import type { SoundHandle } from './soundCache';
import type { StealPolicy } from './voicePool';

export interface PlayOptions {
  /** Default 'sfx'. */
  bus?: string;
  /** 0..1, default 1. Multiplied by any spatialized gain. */
  gain?: number;
  /** Playback rate, default 1. */
  rate?: number;
  /** Detune in cents, default 0. */
  detune?: number;
  loop?: boolean;
  /** Explicit stereo pan, -1..1. Ignored when `position` is given. */
  pan?: number;
  /** World position; spatialized against the engine listener. */
  position?: Vec2;
  /** Engine time in ms (see `engine.now()`). Default: as soon as possible. */
  when?: number;
  /** `stopKey(key)` stops every voice sharing this key. */
  cancelKey?: string;
  onDone?: () => void;
}

export interface VoiceHandle {
  id: number;
  stop(fadeMs?: number): void;
  setGain(value: number, rampMs?: number): void;
  setRate(value: number): void;
  setPan(value: number): void;
  setPosition(p: Vec2): void;
  isPlaying(): boolean;
}

export interface AudioEngineOptions {
  /** Injectable for tests and for consumers that own the context. */
  context?: AudioContext;
  /** Scheduling window in ms. Default 100. */
  lookahead?: number;
  /** Scheduler pass interval in ms. Default 25. */
  tickInterval?: number;
  /** Default ['sfx', 'music', 'ui']. */
  buses?: string[];
  /** Max concurrent voices PER BUS before stealing. Default 32. */
  voiceLimit?: number;
  /** Default 'oldest'. */
  steal?: StealPolicy;
  fetchFn?: typeof fetch;
  setTimer?: (cb: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export type { SoundHandle, Vec2, StealPolicy };
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createAudioEngine } from './createAudioEngine';
import { createFakeAudioContext } from './testing/fakeAudioContext';

function engineHarness(over: Record<string, unknown> = {}) {
  const ctx = createFakeAudioContext();
  let pass: (() => void) | null = null;
  const engine = createAudioEngine({
    context: ctx as never,
    setTimer: (cb) => { pass = cb; return 1; },
    clearTimer: () => { pass = null; },
    fetchFn: (async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })) as never,
    ...over,
  });
  return { ctx, engine, tick: () => pass?.() };
}

describe('createAudioEngine', () => {
  it('reports the suspended state before unlock', () => {
    const { engine } = engineHarness();
    expect(engine.state()).toBe('suspended');
  });

  it('resumes the context on unlock', async () => {
    const { ctx, engine } = engineHarness();
    await engine.unlock();
    expect(ctx.state).toBe('running');
    expect(engine.state()).toBe('running');
  });

  it('drops a play before unlock and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctx, engine } = engineHarness();
    const sound = await engine.load('/a.wav');
    const voice = engine.play(sound);
    expect(voice.isPlaying()).toBe(false);
    expect(ctx._sources).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
  });

  it('starts a source once unlocked and the scheduler passes', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound);
    tick();
    expect(ctx._sources).toHaveLength(1);
  });

  it('starts the source at the requested engine time, not at now', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound, { when: 50 });
    tick();
    // Engine ms → Web Audio seconds.
    expect(ctx._sources[0].started[0]).toBeCloseTo(0.05, 6);
  });

  it('reports engine time in ms from the audio clock in seconds', async () => {
    const { ctx, engine } = engineHarness();
    ctx._advance(250);
    expect(engine.now()).toBeCloseTo(250, 6);
  });

  it('routes a voice through its bus', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound, { bus: 'music' });
    tick();
    const source = ctx._sources[0] as never as { connectedTo: { kind: string }[] };
    expect(source.connectedTo[0].kind).toBe('panner');
  });

  it('stops every voice sharing a cancel key', async () => {
    const { engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const a = engine.play(sound, { cancelKey: 'steps' });
    const b = engine.play(sound, { cancelKey: 'steps' });
    tick();
    engine.stopKey('steps');
    expect(a.isPlaying()).toBe(false);
    expect(b.isPlaying()).toBe(false);
  });

  it('cancels a voice scheduled but not yet started', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound, { when: 10_000, cancelKey: 'late' });
    engine.stopKey('late');
    tick();
    expect(ctx._sources).toHaveLength(0);
  });

  it('applies spatialized pan from a position and the listener', async () => {
    const { ctx, engine, tick } = engineHarness();
    await engine.unlock();
    engine.setListener({ x: 0, y: 0 });
    const sound = await engine.load('/a.wav');
    engine.play(sound, { position: { x: 250, y: 0 } });
    tick();
    const panner = ctx._sources[0].connectedTo[0] as never as { pan: { value: number } };
    expect(panner.pan.value).toBeCloseTo(0.5, 6);
  });

  it('steals the oldest voice past the limit', async () => {
    const { engine, tick } = engineHarness({ voiceLimit: 2 });
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const a = engine.play(sound, { loop: true });
    engine.play(sound, { loop: true });
    tick();
    engine.play(sound, { loop: true });
    tick();
    expect(a.isPlaying()).toBe(false);
  });

  it('does not hand the same slot to two live voices after a steal', async () => {
    const { engine, tick } = engineHarness({ voiceLimit: 2 });
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    engine.play(sound, { loop: true });
    engine.play(sound, { loop: true });
    tick();
    const c = engine.play(sound, { loop: true });   // steals
    const d = engine.play(sound, { loop: true });   // steals again
    tick();
    expect(c.isPlaying()).toBe(true);
    expect(d.isPlaying()).toBe(true);
  });

  it('limits per bus, so one bus cannot starve another', async () => {
    const { engine, tick } = engineHarness({ voiceLimit: 1 });
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const music = engine.play(sound, { bus: 'music', loop: true });
    tick();
    engine.play(sound, { bus: 'sfx', loop: true });
    engine.play(sound, { bus: 'sfx', loop: true });   // steals within sfx only
    tick();
    expect(music.isPlaying()).toBe(true);
  });

  it('stops everything on stopAll', async () => {
    const { engine, tick } = engineHarness();
    await engine.unlock();
    const sound = await engine.load('/a.wav');
    const a = engine.play(sound, { loop: true });
    tick();
    engine.stopAll();
    expect(a.isPlaying()).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/audio/src/createAudioEngine.test.ts`
Expected: FAIL — cannot resolve `./createAudioEngine`.

- [ ] **Step 4: Write the implementation**

```ts
import { createAnalyserTap, type AnalyserTap, type AnalyserTapOptions } from './analyser';
import { createBusGraph, type BusHandle } from './buses';
import { createScheduler } from './scheduler';
import { createSoundCache, type SoundHandle } from './soundCache';
import { spatialize, type SpatialOptions, type Vec2 } from './spatialize';
import type { AudioEngineOptions, PlayOptions, VoiceHandle } from './types';
import { createVoicePool } from './voicePool';

export interface AudioEngine {
  state(): AudioContextState;
  unlock(): Promise<void>;
  /** Engine time in ms. */
  now(): number;
  load(url: string): Promise<SoundHandle>;
  loadAll(urls: Record<string, string>): Promise<Record<string, SoundHandle>>;
  decode(bytes: ArrayBuffer): Promise<SoundHandle>;
  play(sound: SoundHandle, opts?: PlayOptions): VoiceHandle;
  stopKey(key: string): void;
  stopAll(): void;
  bus(name: string): BusHandle;
  analyser(busName?: string, opts?: AnalyserTapOptions): AnalyserTap;
  setListener(p: Vec2, opts?: SpatialOptions): void;
  dispose(): void;
}

interface LiveVoice {
  id: number;
  slot: number;
  /** Slots are per-bus, so a voice must remember which pool owns its slot. */
  bus: string;
  key?: string;
  source: AudioBufferSourceNode | null;
  gainNode: GainNode;
  panNode: StereoPannerNode;
  baseGain: number;
  playing: boolean;
  cancelled: boolean;
}

export function createAudioEngine(opts: AudioEngineOptions = {}): AudioEngine {
  const ctx = opts.context ?? new AudioContext();
  const busNames = opts.buses ?? ['sfx', 'music', 'ui'];
  const graph = createBusGraph(ctx, busNames);
  const sounds = createSoundCache(ctx, opts.fetchFn);
  // One pool PER BUS, not one global pool: the spec's limit is per-bus, and a
  // shared pool lets a burst of one-shots on `sfx` steal the music bed.
  const pools = new Map<string, VoicePool>();
  for (const name of busNames) {
    pools.set(name, createVoicePool({ limit: opts.voiceLimit ?? 32, steal: opts.steal }));
  }
  const poolFor = (bus: string): VoicePool => {
    const p = pools.get(bus);
    if (!p) throw new Error(`@weasel-js/audio: unknown bus "${bus}"`);
    return p;
  };

  const now = (): number => ctx.currentTime * 1000;
  const scheduler = createScheduler({
    now,
    setTimer: opts.setTimer ?? ((cb, ms) => setInterval(cb, ms)),
    clearTimer: opts.clearTimer ?? ((h) => clearInterval(h as ReturnType<typeof setInterval>)),
    lookahead: opts.lookahead,
    interval: opts.tickInterval,
  });
  scheduler.start();

  let listener: Vec2 = { x: 0, y: 0 };
  let spatialOpts: SpatialOptions = {};
  let nextVoiceId = 1;
  const live = new Map<number, LiveVoice>();
  // Keyed `bus:slot` — slot numbers restart at 0 in every pool, so a bare slot
  // number collides across buses and tears down the wrong voice.
  const bySlot = new Map<string, LiveVoice>();
  const slotKey = (bus: string, slot: number): string => `${bus}:${slot}`;

  let warnedLocked = false;
  const warnLocked = (): void => {
    if (warnedLocked) return;
    warnedLocked = true;
    console.warn(
      '@weasel-js/audio: play() before the AudioContext was unlocked — the voice was dropped. ' +
      'Browsers require a user gesture; call engine.unlock() from one, or wait for the ' +
      'automatic gesture listener.',
    );
  };

  // Resume on the first user gesture, then stop listening.
  const gestures = ['pointerdown', 'keydown', 'touchstart'] as const;
  const onGesture = (): void => { void engine.unlock(); };
  if (typeof window !== 'undefined') {
    for (const g of gestures) window.addEventListener(g, onGesture, { once: true, passive: true });
  }

  /**
   * Stop a voice and drop its bookkeeping.
   *
   * `releaseSlot` is false on the steal path: `pool.acquire` has ALREADY handed
   * that slot to the incoming voice, so releasing it here would free the new
   * voice's own slot and hand it out twice on the next play.
   */
  const teardown = (voice: LiveVoice, releaseSlot = true): void => {
    if (!voice.playing && voice.source === null) return;
    voice.playing = false;
    try { voice.source?.stop(); } catch { /* already stopped */ }
    voice.source = null;
    live.delete(voice.id);
    const key = slotKey(voice.bus, voice.slot);
    if (bySlot.get(key) === voice) bySlot.delete(key);
    if (releaseSlot) poolFor(voice.bus).release(voice.slot);
  };

  const engine: AudioEngine = {
    state: () => ctx.state,
    async unlock() {
      if (ctx.state !== 'running') await ctx.resume();
    },
    now,
    load: sounds.load,
    loadAll: sounds.loadAll,
    decode: sounds.decode,

    play(sound, playOpts = {}) {
      const id = nextVoiceId++;

      if (ctx.state !== 'running') {
        warnLocked();
        return {
          id,
          stop: () => {}, setGain: () => {}, setRate: () => {},
          setPan: () => {}, setPosition: () => {}, isPlaying: () => false,
        };
      }

      const busName = playOpts.bus ?? busNames[0];
      const when = playOpts.when ?? now();
      const explicitGain = playOpts.gain ?? 1;

      const spatial = playOpts.position
        ? spatialize(playOpts.position, listener, spatialOpts)
        : { gain: 1, pan: playOpts.pan ?? 0 };

      const pool = poolFor(busName);
      const acquired = pool.acquire({ startedAt: when, gain: explicitGain * spatial.gain });
      if (acquired.stolen !== null) {
        const victim = bySlot.get(slotKey(busName, acquired.stolen));
        if (victim) teardown(victim, false);
      }

      const gainNode = ctx.createGain();
      const panNode = ctx.createStereoPanner();
      gainNode.gain.value = explicitGain * spatial.gain;
      panNode.pan.value = spatial.pan;
      panNode.connect(gainNode);
      gainNode.connect(graph.node(busName));

      const voice: LiveVoice = {
        id, slot: acquired.slot, bus: busName, key: playOpts.cancelKey,
        source: null, gainNode, panNode,
        baseGain: explicitGain, playing: true, cancelled: false,
      };
      live.set(id, voice);
      bySlot.set(slotKey(busName, voice.slot), voice);

      scheduler.schedule(when, (scheduledWhen) => {
        if (voice.cancelled) return;
        // A fresh source per play: AudioBufferSourceNode is single-use by
        // specification and cannot be restarted once stopped.
        const source = ctx.createBufferSource();
        source.buffer = sounds.buffer(sound);
        source.loop = playOpts.loop ?? false;
        source.playbackRate.value = playOpts.rate ?? 1;
        source.detune.value = playOpts.detune ?? 0;
        source.connect(panNode);
        source.onended = () => { teardown(voice); playOpts.onDone?.(); };
        voice.source = source;
        source.start(scheduledWhen / 1000);
      }, playOpts.cancelKey);

      return {
        id,
        stop(fadeMs) {
          voice.cancelled = true;
          if (fadeMs && fadeMs > 0) {
            gainNode.gain.linearRampToValueAtTime?.(0, ctx.currentTime + fadeMs / 1000);
          }
          teardown(voice);
        },
        setGain(value, rampMs) {
          voice.baseGain = value;
          if (rampMs && rampMs > 0) {
            gainNode.gain.linearRampToValueAtTime?.(value, ctx.currentTime + rampMs / 1000);
          } else {
            gainNode.gain.value = value;
          }
          poolFor(voice.bus).setGain(voice.slot, value);
        },
        setRate(value) { if (voice.source) voice.source.playbackRate.value = value; },
        setPan(value) { panNode.pan.value = value; },
        setPosition(p) {
          const s = spatialize(p, listener, spatialOpts);
          panNode.pan.value = s.pan;
          gainNode.gain.value = voice.baseGain * s.gain;
          poolFor(voice.bus).setGain(voice.slot, voice.baseGain * s.gain);
        },
        isPlaying: () => voice.playing,
      };
    },

    stopKey(key) {
      scheduler.cancelKey(key);
      for (const voice of [...live.values()]) {
        if (voice.key === key) { voice.cancelled = true; teardown(voice); }
      }
    },
    stopAll() {
      for (const voice of [...live.values()]) { voice.cancelled = true; teardown(voice); }
    },
    bus: graph.bus,
    analyser: (busName, tapOpts) =>
      createAnalyserTap(ctx, busName ? graph.node(busName) : graph.master, tapOpts),
    setListener(p, o) {
      listener = p;
      if (o) spatialOpts = o;
    },
    dispose() {
      engine.stopAll();
      scheduler.stop();
      if (typeof window !== 'undefined') {
        for (const g of gestures) window.removeEventListener(g, onGesture);
      }
    },
  };

  return engine;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/audio/src/createAudioEngine.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/audio/src/types.ts packages/audio/src/createAudioEngine.ts packages/audio/src/createAudioEngine.test.ts
git commit -m "assemble the engine: unlock, scheduled voices, buses, spatial pan"
```

---

### Task 10: Public barrel and changeset

**Files:**
- Modify: `packages/audio/src/index.ts`
- Modify: `packages/audio/src/index.test.ts`
- Create: `.changeset/audio-engine.md`

- [ ] **Step 1: Write the barrel**

```ts
export { createAudioEngine, type AudioEngine } from './createAudioEngine';
export { createAnalyserTap, type AnalyserTap, type AnalyserTapOptions } from './analyser';
export { createBusGraph, type BusGraph, type BusHandle } from './buses';
export { createScheduler, type Scheduler, type SchedulerOptions } from './scheduler';
export { createSoundCache, type SoundCache, type SoundHandle } from './soundCache';
export { createVoicePool, type VoicePool, type StealPolicy } from './voicePool';
export { spatialize, type SpatialOptions, type Vec2 } from './spatialize';
export type { AudioEngineOptions, PlayOptions, VoiceHandle } from './types';
```

`testing/fakeAudioContext` is deliberately NOT exported — it is a test fixture,
not public API.

- [ ] **Step 2: Replace the scaffolding test with a real surface test**

```ts
// packages/audio/src/index.test.ts
import { describe, expect, it } from 'vitest';
import * as audio from '@weasel-js/audio';

describe('@weasel-js/audio public surface', () => {
  it('exports the engine factory', () => {
    expect(typeof audio.createAudioEngine).toBe('function');
  });

  it('exports the pure helpers so they are usable without an engine', () => {
    expect(typeof audio.spatialize).toBe('function');
    expect(typeof audio.createVoicePool).toBe('function');
    expect(typeof audio.createScheduler).toBe('function');
  });

  it('does not export the test double', () => {
    expect('createFakeAudioContext' in audio).toBe(false);
  });
});
```

Delete the `AUDIO_PACKAGE` export added in Task 1.

- [ ] **Step 3: Write the changeset**

```markdown
---
'@weasel-js/audio': patch
---

New package: a Web Audio engine for 2D scenes, with no weasel dependencies.

Loading and decoding with a url cache, voices with handles and `cancelKey`,
buses with gain/mute/solo, 2D spatialization, and analyser taps including
`bands(n)` for audio-reactive rendering.

Playback is lookahead-scheduled on the engine's own timer rather than triggered
from an animation frame, because `AudioContext.currentTime` is hardware-driven,
cannot be paused, and `requestAnimationFrame` throttles when backgrounded.

This is new API surface. The bump level is deliberate; see CLAUDE.md.
```

- [ ] **Step 4: Full gate**

Run:
```bash
npx vitest run --project=weasel-ui packages/audio/ \
  && npx tsc --noEmit \
  && npm run build -w @weasel-js/audio \
  && node scripts/check-publish-manifests.mjs \
  && node scripts/check-changeset-bumps.mjs \
  && npx eslint packages/audio
```
Expected: every command exits 0.

- [ ] **Step 5: Commit**

```bash
git add packages/audio .changeset/audio-engine.md
git commit -m "export the audio public surface and add a changeset"
```

---

## Out of scope for this plan

- The timeline bridge (an `EventTrack` calling `engine.play` with
  `when: engine.now() + (event.t - playhead)`) — it needs both arcs landed
- The audio-reactive demo (arc 3 phase 6)
- AudioWorklet scheduling, insert effects, streaming sources — see the spec's
  out-of-scope section
