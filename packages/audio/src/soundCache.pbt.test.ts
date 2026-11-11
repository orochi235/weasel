/**
 * Stateful test of the sound cache: loads of a few urls, fetches answered in any order with a sound, an HTTP
 * error, a network failure, or bytes that will not decode, and buffers registered and decoded directly. Against a
 * model of each url: a url loaded once is never fetched again, loads made while a fetch is out share it and its
 * answer, a failed load is not kept, and every handle names its own buffer.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createSoundCache, type SoundCache, type SoundHandle } from './soundCache';
import { createFakeAudioContext } from './testing/fakeAudioContext';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 150;
const URLS = ['/a.wav', '/b.wav', '/c.wav'];

type Outcome = 'ok' | 'http' | 'network' | 'undecodable';
type Settled = { handle: SoundHandle } | { error: unknown } | null;

interface Fetch { url: string; answer(outcome: Outcome): void; done: boolean }
interface UrlState { loaded: SoundHandle | null; inflight: Fetch | null; waiting: { settled: Settled }[] }
interface Model { urls: Map<string, UrlState>; handles: SoundHandle[]; fetches: number }
interface Real { cache: SoundCache; fetches: Fetch[] }

const seen = tally();
const flush = async (): Promise<void> => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); };

function track(p: Promise<SoundHandle>): { settled: Settled } {
  const box: { settled: Settled } = { settled: null };
  p.then((handle) => { box.settled = { handle }; }, (error: unknown) => { box.settled = { error }; });
  return box;
}

class Load implements fc.AsyncCommand<Model, Real> {
  constructor(readonly url: string) {}
  check = () => true;
  async run(m: Model, r: Real): Promise<void> {
    const s = m.urls.get(this.url)!;
    const box = track(r.cache.load(this.url));
    if (!s.loaded && !s.inflight) {
      m.fetches += 1;
      s.inflight = r.fetches[r.fetches.length - 1]!;
      expect(s.inflight.url).toBe(this.url);
    } else if (s.inflight) {
      seen.count('shared');
    }
    expect(r.fetches).toHaveLength(m.fetches);
    await flush();
    if (s.loaded) {
      expect(box.settled).toEqual({ handle: s.loaded });
      seen.count('cached');
    } else {
      expect(box.settled).toBeNull();
      s.waiting.push(box);
    }
  }
  toString = () => `load(${this.url})`;
}

class Answer implements fc.AsyncCommand<Model, Real> {
  constructor(readonly pick: number, readonly outcome: Outcome) {}
  check = (m: Readonly<Model>) => [...m.urls.values()].some((s) => s.inflight);
  async run(m: Model, r: Real): Promise<void> {
    const open = [...m.urls.entries()].filter(([, s]) => s.inflight);
    const [, s] = open[this.pick % open.length]!;
    s.inflight!.answer(this.outcome);
    s.inflight = null;
    await flush();
    const results = s.waiting.map((w) => w.settled);
    s.waiting = [];
    for (const res of results) expect(res).not.toBeNull();
    if (this.outcome === 'ok') {
      const first = results[0] as { handle: SoundHandle };
      expect(first.handle).toBeDefined();
      for (const res of results) expect(res).toEqual(first);
      expect(m.handles.map((h) => h.id)).not.toContain(first.handle.id);
      s.loaded = first.handle;
      m.handles.push(first.handle);
      expect(r.cache.buffer(first.handle)).not.toBeNull();
      seen.count('loaded');
    } else {
      for (const res of results) expect((res as { error: Error }).error).toBeInstanceOf(Error);
      seen.count(`failed ${this.outcome}`);
    }
  }
  toString = () => `answer(#${this.pick}, ${this.outcome})`;
}

class Register implements fc.AsyncCommand<Model, Real> {
  constructor(readonly decode: boolean) {}
  check = () => true;
  async run(m: Model, r: Real): Promise<void> {
    const buffer = { duration: 2 };
    const h = this.decode ? await r.cache.decode(new ArrayBuffer(4)) : r.cache.register(buffer as never);
    expect(m.handles.map((x) => x.id)).not.toContain(h.id);
    m.handles.push(h);
    if (!this.decode) expect(r.cache.buffer(h)).toBe(buffer);
    else expect(r.cache.buffer(h)).not.toBeNull();
  }
  toString = () => (this.decode ? 'decode' : 'register');
}

const commands = fc.commands([
  ...[1, 2, 3].map(() => fc.constantFrom(...URLS).map((u) => new Load(u))),
  ...[1, 2].map(() => fc.tuple(fc.nat(), fc.constantFrom<Outcome>('ok', 'ok', 'http', 'network', 'undecodable')).map(([p, o]) => new Answer(p, o))),
  fc.boolean().map((d) => new Register(d)),
], { maxCommands: 30, size: '+1' });

describe('createSoundCache', () => {
  it('fetches a url until one load of it succeeds, sharing each fetch with the loads made while it is out', async () => {
    await fc.assert(fc.asyncProperty(commands, async (cmds) => {
      const ctx = createFakeAudioContext();
      const decode = ctx.decodeAudioData.bind(ctx);
      ctx.decodeAudioData = async (bytes: ArrayBuffer) => {
        if (bytes.byteLength === 0) throw new Error('@weasel-js/audio test: undecodable');
        return decode(bytes);
      };
      const fetches: Fetch[] = [];
      const fetchFn = (url: string) => new Promise((resolve, reject) => {
        const f: Fetch = {
          url, done: false,
          answer(outcome) {
            f.done = true;
            if (outcome === 'network') reject(new TypeError('Failed to fetch'));
            else resolve({ ok: outcome !== 'http', status: outcome === 'http' ? 404 : 200, arrayBuffer: async () => new ArrayBuffer(outcome === 'undecodable' ? 0 : 8) });
          },
        };
        fetches.push(f);
      });
      const real: Real = { cache: createSoundCache(ctx as never, fetchFn as never), fetches };
      const model: Model = { urls: new Map(URLS.map((u) => [u, { loaded: null, inflight: null, waiting: [] }])), handles: [], fetches: 0 };
      await fc.asyncModelRun(() => ({ model, real }), cmds);
      // Answer whatever is still out, so no load is left hanging.
      for (const s of model.urls.values()) {
        if (s.inflight) await new Answer(0, 'ok').run(model, real);
      }
      expect(fetches.every((f) => f.done)).toBe(true);
    }), runs(RUNS));
    for (const what of ['shared', 'cached', 'loaded', 'failed http', 'failed network', 'failed undecodable']) seen.atLeast(what, RUNS / 10);
  }, timeoutFor(RUNS, 30));
});
