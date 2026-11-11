/**
 * Stateful test of the voice pool: acquires, releases, and gain changes, with stale tokens among them, against a
 * model of the live voices in the order the pool visits them. Every step checks the slot, token, and stolen voice
 * it hands back, and that no more voices are live than the limit allows.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createVoicePool, type StealPolicy, type VoicePool } from './voicePool';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 200;

interface Voice { slot: number; token: number; startedAt: number; gain: number }
interface Model { limit: number; steal: StealPolicy; live: Voice[]; free: number[]; nextSlot: number; nextToken: number; tokens: { slot: number; token: number }[] }
interface Real { pool: VoicePool }

const seen = tally();

class Acquire implements fc.Command<Model, Real> {
  constructor(readonly startedAt: number, readonly gain: number) {}
  check = () => true;
  run(m: Model, r: Real): void {
    const got = r.pool.acquire({ startedAt: this.startedAt, gain: this.gain });
    const token = m.nextToken++;
    let want: { slot: number; token: number; stolen: number | null };
    if (m.live.length < m.limit) {
      const slot = m.free.length > 0 ? m.free.pop()! : m.nextSlot++;
      want = { slot, token, stolen: null };
      seen.count('acquired');
    } else {
      const score = (v: Voice) => (m.steal === 'quietest' ? v.gain : v.startedAt);
      const victim = m.live.reduce((worst, v) => (score(v) < score(worst) ? v : worst));
      m.live.splice(m.live.indexOf(victim), 1);
      want = { slot: victim.slot, token, stolen: victim.token };
      seen.count(`stole ${m.steal}`);
    }
    m.live.push({ slot: want.slot, token, startedAt: this.startedAt, gain: this.gain });
    m.tokens.push({ slot: want.slot, token });
    expect(got).toEqual(want);
    expect(r.pool.active()).toBe(m.live.length);
    expect(m.live.length).toBeLessThanOrEqual(m.limit);
  }
  toString = () => `acquire(${this.startedAt}, ${this.gain})`;
}

class Release implements fc.Command<Model, Real> {
  constructor(readonly pick: number, readonly wrongSlot: boolean) {}
  check = (m: Readonly<Model>) => m.tokens.length > 0;
  run(m: Model, r: Real): void {
    const { slot: held, token } = m.tokens[this.pick % m.tokens.length]!;
    const slot = this.wrongSlot ? held + 1 : held;
    r.pool.release(slot, token);
    const i = m.live.findIndex((v) => v.slot === slot && v.token === token);
    if (i >= 0) {
      m.live.splice(i, 1);
      m.free.push(slot);
      seen.count('released');
    } else {
      seen.count('stale release');
    }
    expect(r.pool.active()).toBe(m.live.length);
  }
  toString = () => `release(#${this.pick}${this.wrongSlot ? ', wrong slot' : ''})`;
}

class SetGain implements fc.Command<Model, Real> {
  constructor(readonly pick: number, readonly gain: number) {}
  check = (m: Readonly<Model>) => m.tokens.length > 0;
  run(m: Model, r: Real): void {
    const { slot, token } = m.tokens[this.pick % m.tokens.length]!;
    r.pool.setGain(slot, token, this.gain);
    const v = m.live.find((x) => x.slot === slot && x.token === token);
    if (v) v.gain = this.gain;
    expect(r.pool.active()).toBe(m.live.length);
  }
  toString = () => `setGain(#${this.pick}, ${this.gain})`;
}

// Few distinct values, so ties on the steal score come up.
const time = fc.oneof(fc.integer({ min: 0, max: 5 }), fc.double({ min: 0, max: 1e6, noNaN: true }));
const level = fc.oneof(fc.constantFrom(0, 0.5, 1), fc.double({ min: 0, max: 2, noNaN: true }));
const commands = fc.commands([
  ...[1, 2, 3].map(() => fc.tuple(time, level).map(([t, g]) => new Acquire(t, g))),
  fc.tuple(fc.nat(), fc.boolean()).map(([p, w]) => new Release(p, w)),
  fc.tuple(fc.nat(), level).map(([p, g]) => new SetGain(p, g)),
], { maxCommands: 60, size: '+1' });

describe('createVoicePool', () => {
  it('hands out and steals voices as its model does, never more than the limit', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 5 }), fc.constantFrom<StealPolicy>('oldest', 'quietest'), commands, (limit, steal, cmds) => {
      const model: Model = { limit, steal, live: [], free: [], nextSlot: 0, nextToken: 1, tokens: [] };
      fc.modelRun(() => ({ model, real: { pool: createVoicePool({ limit, steal }) } }), cmds);
    }), runs(RUNS));
    for (const what of ['acquired', 'stole oldest', 'stole quietest', 'released', 'stale release']) seen.atLeast(what, RUNS / 4);
  }, timeoutFor(RUNS, 5));

  it('refuses a limit below 1', () => {
    fc.assert(fc.property(fc.oneof(fc.double({ max: 0.999, noNaN: true }), fc.constant(Number.NaN)), (limit) => {
      expect(() => createVoicePool({ limit })).toThrow(RangeError);
    }), runs(RUNS));
  });
});
