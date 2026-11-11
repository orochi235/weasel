/**
 * Stateful property test of a canvas source against a model of its readers and frames: readers retained and
 * released (twice, too), captures, canvas resizes to any size, zero included, and reads, on a canvas, a context that
 * keeps its buffer, and one that does not. After every step the frame a reader gets, the redraws asked for, the frame
 * subscribers told, and the one warning about a missing `capture()` are the model's.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { createCanvasSource, type CanvasSource } from './canvasSource';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 200;

class FakeOffscreen {
  ctx = { globalCompositeOperation: 'source-over', drawImage: () => undefined, getImageData: () => ({ data: Uint8ClampedArray.from([1, 2, 3, 255]) }) };
  constructor(public width: number, public height: number) {}
  getContext() { return this.ctx; }
}

beforeEach(() => { vi.stubGlobal('OffscreenCanvas', FakeOffscreen); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

type Kind = 'canvas' | 'kept' | 'cleared';
interface Model { captured: boolean; readers: number; current: boolean; snapshot: { width: number; height: number } | null; missed: number; warned: boolean; redraws: number; frames: number }
interface Real {
  source: CanvasSource; canvas: { width: number; height: number };
  releases: (() => void)[]; redraws: number; frames: number; warns: number;
}

const seen = tally();

function check(m: Model, r: Real): void {
  expect(r.source.captured).toBe(m.captured);
  expect([r.redraws, r.frames, r.warns]).toEqual([m.redraws, m.frames, m.warned ? 1 : 0]);
}

/** What `frame()` answers, read as a reader would, the model stepping its missed count alongside. */
function read(m: Model, r: Real): void {
  const got = r.source.frame();
  if (!m.captured) {
    expect(got).toBe(r.canvas.width > 0 && r.canvas.height > 0 ? r.canvas : null);
    seen.count(got ? 'read the canvas' : 'empty canvas');
  } else if (m.current && m.snapshot) {
    expect(got).toBeInstanceOf(FakeOffscreen);
    seen.count('read a capture');
  } else {
    expect(got).toBeNull();
    if (!m.warned && ++m.missed >= 120) { m.warned = true; seen.count('warned'); }
  }
}

const cmd = (label: string, run: (m: Model, r: Real) => void, ...args: unknown[]): fc.Command<Model, Real> => ({
  check: () => true,
  run(m, r) { run(m, r); seen.count(label); check(m, r); },
  toString: () => `${label}(${args.map((a) => JSON.stringify(a)).join(', ')})`,
});

const commands = [
  fc.constant(cmd('retain', (m, r) => {
    r.releases.push(r.source.retain());
    m.readers++;
    if (m.readers === 1 && m.captured) { m.current = false; m.redraws++; }
  })),
  fc.tuple(fc.nat(), fc.boolean()).map(([n, twice]) => cmd('release', (m, r) => {
    if (r.releases.length === 0) return;
    const release = r.releases.splice(n % r.releases.length, 1)[0]!;
    release();
    if (twice) { release(); seen.count('released twice'); }
    m.readers--;
  }, n, twice)),
  fc.constant(cmd('capture', (m, r) => {
    r.source.capture();
    m.captured = true;
    const { width, height } = r.canvas;
    if (m.readers === 0 || width === 0 || height === 0) return;
    m.snapshot = { width, height };
    m.current = true;
    m.missed = 0;
    m.frames++;
  })),
  fc.record({ width: fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 64 })), height: fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 64 })) })
    .map((size) => cmd('resize', (_m, r) => { Object.assign(r.canvas, size); }, size)),
  fc.integer({ min: 1, max: 130 }).map((n) => cmd('read', (m, r) => { for (let i = 0; i < n; i++) read(m, r); }, n)),
  fc.record({ x: fc.oneof({ weight: 4, arbitrary: fc.integer({ min: -2, max: 20 }) }, fc.constantFrom(NaN, Infinity, -0.5, 63.999)), y: fc.integer({ min: -2, max: 12 }) }).map((p) => cmd('pixel', (m, r) => {
    const frameSize = !m.captured ? r.canvas : m.current ? m.snapshot : null;
    const got = r.source.pixel(p);
    if (m.captured && !(m.current && m.snapshot) && !m.warned && ++m.missed >= 120) m.warned = true;
    const on = frameSize !== null && frameSize.width > 0 && frameSize.height > 0
      && Math.floor(p.x) >= 0 && Math.floor(p.y) >= 0 && Math.floor(p.x) < frameSize.width && Math.floor(p.y) < frameSize.height;
    seen.count(on ? 'pixel on the frame' : 'pixel off it');
    expect(got === null ? null : [...got]).toEqual(on ? [1, 2, 3, 255] : null);
  }, p)),
];

function setup(kind: Kind): () => { model: Model; real: Real } {
  return () => {
    const canvas = { width: 32, height: 16, getContext: () => null };
    const target = kind === 'canvas' ? canvas : {
      canvas, drawArrays: () => undefined, getContextAttributes: () => ({ preserveDrawingBuffer: kind === 'kept' }),
    };
    const real = { canvas, releases: [], redraws: 0, frames: 0, warns: 0 } as unknown as Real;
    vi.spyOn(console, 'warn').mockImplementation(() => { real.warns++; });
    real.source = createCanvasSource(target as never, { requestRedraw: () => { real.redraws++; } });
    real.source.subscribeFrame(() => { real.frames++; });
    const model: Model = { captured: kind === 'cleared', readers: 0, current: false, snapshot: null, missed: 0, warned: false, redraws: 0, frames: 0 };
    return { model, real };
  };
}

describe('createCanvasSource', () => {
  it('hands readers the model\'s frame through any run of retains, releases, captures, resizes, and reads', () => {
    fc.assert(fc.property(fc.constantFrom<Kind>('canvas', 'kept', 'cleared'), fc.commands(commands, { maxCommands: 40, size: 'large' }), (kind, cmds) => {
      vi.restoreAllMocks();
      fc.modelRun(setup(kind), cmds);
    }), runs(RUNS));
    for (const what of ['read the canvas', 'read a capture', 'released twice', 'pixel on the frame', 'pixel off it', 'empty canvas']) seen.atLeast(what, RUNS / 10);
    seen.atLeast('warned', 3);
  }, timeoutFor(RUNS, 20));
});
