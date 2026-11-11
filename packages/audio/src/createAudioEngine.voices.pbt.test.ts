/**
 * Stateful test of an engine's voices through notes, noises, and buffer plays booked now or ahead, stops with and
 * without a fade, releases, gain writes, `stopKey`, `stopAll`, the context suspending and resuming, clock advances
 * at any pace, and a dispose. After every step each voice has had at most one of `onDone` and `onDrop`, once; a
 * voice that has had one reads as not playing; and `activeVoices()` counts no more than the voices still playing.
 * At the end, once the clock has run past everything and the engine is disposed, every voice has had exactly one.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createAudioEngine } from './createAudioEngine';
import { createFakeAudioContext } from './testing/fakeAudioContext';
import type { VoiceDropReason, VoiceHandle } from './types';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 60;
const seen = tally();

type Cmd =
  | { kind: 'note' | 'noise' | 'buffer'; offset: number; duration?: number; key?: string; loop: boolean }
  | { kind: 'stop'; i: number; fade?: number }
  | { kind: 'release'; i: number }
  | { kind: 'gain'; i: number; value: number }
  | { kind: 'stopKey'; key: string }
  | { kind: 'stopAll' }
  | { kind: 'advance'; ms: number; pace: number }
  | { kind: 'state'; to: 'running' | 'suspended' }
  | { kind: 'dispose' };

const key = fc.option(fc.constantFrom('a', 'b'), { nil: undefined });
const cmd: fc.Arbitrary<Cmd> = fc.oneof(
  { weight: 4, arbitrary: fc.record({
    kind: fc.constantFrom('note' as const, 'noise' as const, 'buffer' as const),
    offset: fc.oneof(fc.constant(0), fc.integer({ min: -300, max: 2000 })),
    duration: fc.option(fc.integer({ min: 0, max: 400 }), { nil: undefined }),
    key, loop: fc.boolean(),
  }, { requiredKeys: ['kind', 'offset', 'loop'] }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('stop' as const), i: fc.nat(20), fade: fc.option(fc.integer({ min: 0, max: 300 }), { nil: undefined }) }, { requiredKeys: ['kind', 'i'] }) },
  fc.record({ kind: fc.constant('release' as const), i: fc.nat(20) }),
  fc.record({ kind: fc.constant('gain' as const), i: fc.nat(20), value: fc.oneof(fc.double({ min: 0, max: 2, noNaN: true }), fc.constantFrom(NaN, Infinity)) }),
  fc.record({ kind: fc.constant('stopKey' as const), key: fc.constantFrom('a', 'b') }),
  fc.constant({ kind: 'stopAll' as const }),
  { weight: 4, arbitrary: fc.record({ kind: fc.constant('advance' as const), ms: fc.integer({ min: 1, max: 1500 }), pace: fc.oneof(fc.constant(25), fc.integer({ min: 26, max: 1000 })) }) },
  fc.record({ kind: fc.constant('state' as const), to: fc.constantFrom('running' as const, 'suspended' as const) }),
  { weight: 1, arbitrary: fc.constant({ kind: 'dispose' as const }) },
);

interface Voice { handle: VoiceHandle; done: number; drops: VoiceDropReason[] }

describe('an engine\'s voices', () => {
  it('give each voice one end, onDone or onDrop, through any interleaving of plays, stops, suspends, and time', async () => {
    await fc.assert(fc.asyncProperty(fc.array(cmd, { minLength: 1, maxLength: 30 }), async (cmds) => {
      const ctx = createFakeAudioContext();
      let pass: (() => void) | null = null;
      const engine = createAudioEngine({
        context: ctx as never, voiceLimit: 6,
        setTimer: (cb) => { pass = cb; return 1; },
        clearTimer: () => { pass = null; },
      });
      await engine.unlock();
      const sound = engine.register(ctx.createBuffer(1, 4800, 48000) as never);
      const flush = async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); };
      const advance = async (ms: number, pace: number) => {
        for (let t = 0; t < ms; t += pace) {
          await flush();
          ctx._advance(Math.min(pace, ms - t));
          const p = pass;
          pass = null;
          p?.();
          await flush();
        }
      };
      const voices: Voice[] = [];
      let disposed = false;
      const check = (): void => {
        for (const v of voices) {
          expect(v.done + v.drops.length).toBeLessThanOrEqual(1);
          if (v.done + v.drops.length > 0) expect(v.handle.isPlaying()).toBe(false);
        }
        if (!disposed) expect(engine.activeVoices()).toBeLessThanOrEqual(voices.filter((v) => v.handle.isPlaying()).length);
      };
      for (const c of cmds) {
        const v = voices[c.kind === 'stop' || c.kind === 'release' || c.kind === 'gain' ? c.i % Math.max(1, voices.length) : 0];
        switch (c.kind) {
          case 'note': case 'noise': case 'buffer': {
            const voice = { done: 0, drops: [] as VoiceDropReason[] } as Voice;
            const common = {
              when: engine.now() + c.offset, ...(c.key ? { cancelKey: c.key } : {}),
              onDone: () => { voice.done += 1; }, onDrop: (r: VoiceDropReason) => { voice.drops.push(r); },
            };
            const dur = c.duration !== undefined ? { duration: c.duration } : {};
            voice.handle = c.kind === 'note' ? engine.playNote({ pitch: 440, ...dur, ...common })
              : c.kind === 'noise' ? engine.playNoise({ noise: 'white', ...dur, ...common })
                : engine.play(sound, { loop: c.loop, ...common });
            voices.push(voice);
            break;
          }
          case 'stop': if (v) v.handle.stop(c.fade); break;
          case 'release': if (v) v.handle.release(); break;
          case 'gain':
            if (!v) break;
            if (Number.isFinite(c.value)) v.handle.setGain(c.value);
            else expect(() => v.handle.setGain(c.value)).toThrow(RangeError);
            break;
          case 'stopKey': engine.stopKey(c.key); break;
          case 'stopAll': engine.stopAll(); break;
          case 'advance': await advance(c.ms, c.pace); break;
          case 'state': ctx._setState(c.to); break;
          case 'dispose': engine.dispose(); disposed = true; break;
        }
        await flush();
        check();
      }
      ctx._setState('running');
      engine.stopAll();
      await advance(5000, 25);
      engine.dispose();
      await advance(1000, 25);
      await flush();
      check();
      for (const v of voices) {
        expect(v.done + v.drops.length).toBe(1);
        seen.count(v.done ? 'done' : `drop:${v.drops[0]}`);
      }
    }), runs(RUNS));
    seen.atLeast('done', 30);
    seen.atLeast('drop:stopped', 5);
    seen.atLeast('drop:disposed', 5);
  }, timeoutFor(RUNS, 400));
});
