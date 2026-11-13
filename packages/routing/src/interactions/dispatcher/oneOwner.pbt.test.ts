/**
 * Property test of press ownership: candidates bound to one drag, each declining, starting an empty handle,
 * taking, passing on its nth move, or firing at once, behind a drag threshold or not. The dispatcher's calls must
 * match a model in which the first candidate in rank order to start the gesture owns it until it hands it on,
 * a hand-off goes to the next one that has not passed it, and nothing else ever sees the gesture.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from '../../pbt.fixture';
import type { Action } from '../actions/action';
import type { OngoingHandle } from '../actions/invoker';
import { createDispatcher } from './dispatcher';
import type { InputEvent } from './matcher';
import { makeCtx, makeRegistry } from './testing/dispatcherStubs';

/** What one candidate does with the drag. `pass` hands it on at its `pass`th move. */
type Behavior =
  | { kind: 'decline' } | { kind: 'empty' } | { kind: 'take' } | { kind: 'pass'; at: number }
  | { kind: 'fire' } | { kind: 'firePass' };
interface Candidate { behavior: Behavior; threshold: boolean }

const ongoing = (b: Behavior) => b.kind === 'empty' || b.kind === 'take' || b.kind === 'pass';

const candidate: fc.Arbitrary<Candidate> = fc.record({
  behavior: fc.oneof(
    fc.constant<Behavior>({ kind: 'decline' }), fc.constant<Behavior>({ kind: 'empty' }),
    fc.constant<Behavior>({ kind: 'take' }), fc.integer({ min: 1, max: 3 }).map((at): Behavior => ({ kind: 'pass', at })),
    fc.constant<Behavior>({ kind: 'fire' }), fc.constant<Behavior>({ kind: 'firePass' }),
  ),
  threshold: fc.boolean(),
}).map((c) => (ongoing(c.behavior) ? c : { ...c, threshold: false }));

const MODS = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
const at = (kind: 'pointerdown' | 'pointermove' | 'pointerup', x: number): InputEvent =>
  ({ kind, x, y: 0, clientX: x, clientY: 0, ...MODS });
// Every move is past the threshold, so a held-back start runs on the first move it sees.
const THRESHOLD_PX = 5;
const STEP_PX = 20;

/** What the dispatcher does to the candidates, as a log. */
function observe(cands: readonly Candidate[], moves: number): { log: string[]; maxInFlight: number } {
  const log: string[] = [];
  const moved = cands.map(() => 0);
  const actions = cands.map(({ behavior: b, threshold }, i): Action => {
    const base = { id: `c${i}`, label: `c${i}`, defaultBinding: { kind: 'drag' as const } };
    if (b.kind === 'decline') return { ...base, enabled: () => 'not here', invoker: { timing: 'immediate', run: () => {} } };
    if (b.kind === 'fire' || b.kind === 'firePass') {
      return { ...base, invoker: { timing: 'immediate', run: () => { log.push(`run ${i}`); return b.kind === 'firePass' ? 'pass' : undefined; } } };
    }
    const start = (): OngoingHandle => {
      log.push(`start ${i}`);
      if (b.kind === 'empty') return {};
      return {
        onMove: (ctx) => {
          log.push(`move ${i} ${ctx.world.x}`);
          moved[i]!++;
          return b.kind === 'pass' && moved[i] === b.at ? 'pass' : undefined;
        },
        onEnd: (_ctx, reason) => { log.push(`end ${i} ${reason}`); },
      };
    };
    return { ...base, invoker: { timing: 'ongoing', start, ...(threshold ? { dragThresholdPx: THRESHOLD_PX } : {}) } };
  });
  const dispatcher = createDispatcher();
  const ctx = makeCtx({ actions: makeRegistry(actions) });
  let maxInFlight = 0;
  const feed = (e: InputEvent) => {
    dispatcher.handleInput(e, ctx);
    maxInFlight = Math.max(maxInFlight, dispatcher.inFlight().size);
  };
  feed(at('pointerdown', 0));
  for (let j = 1; j <= moves; j++) feed(at('pointermove', j * STEP_PX));
  feed(at('pointerup', moves * STEP_PX));
  return { log, maxInFlight };
}

/** The same, from the rule: the first in rank order to start the gesture owns it, a pass offers it to the next. */
function model(cands: readonly Candidate[], moves: number): string[] {
  const log: string[] = [];
  const skip = new Set<number>();
  const moved = cands.map(() => 0);
  const begun = new Set<number>();
  let owner: number | null = null;

  /** Walk the press: the candidate that takes it, starting the non-held-back ones it reaches on the way. */
  const walk = (): void => {
    owner = null;
    for (let i = 0; i < cands.length; i++) {
      if (skip.has(i)) continue;
      const { behavior: b, threshold } = cands[i]!;
      if (b.kind === 'decline') continue;
      if (b.kind === 'fire' || b.kind === 'firePass') {
        log.push(`run ${i}`);
        if (b.kind === 'fire') return;
        continue;
      }
      if (threshold) { owner = i; return; }
      log.push(`start ${i}`);
      if (b.kind === 'empty') continue;
      begun.add(i);
      owner = i;
      return;
    }
  };
  /** Hand the owner the move at `x`; true when it passes it on. */
  const deliver = (i: number, x: number): boolean => {
    const { behavior: b, threshold } = cands[i]!;
    if (threshold && !begun.has(i)) {
      log.push(`start ${i}`);
      if (b.kind === 'empty') return true;
      begun.add(i);
    }
    log.push(`move ${i} ${x}`);
    moved[i]!++;
    return b.kind === 'pass' && moved[i] === b.at;
  };

  walk();
  for (let j = 1; j <= moves; j++) {
    const x = j * STEP_PX;
    while (owner !== null && deliver(owner, x)) {
      if (begun.has(owner)) log.push(`end ${owner} cancel`);
      skip.add(owner);
      walk();
    }
  }
  if (owner !== null && begun.has(owner)) log.push(`end ${owner} commit`);
  return log;
}

describe('a drag has one owner', () => {
  it('runs one action at a time, hands the gesture on only when its owner passes, and never back', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(candidate, { minLength: 1, maxLength: 5 }), fc.integer({ min: 0, max: 5 }), (cands, moves) => {
      const { log, maxInFlight } = observe(cands, moves);
      expect(log).toEqual(model(cands, moves));
      expect(maxInFlight).toBeLessThanOrEqual(1);
      expect(log.filter((l) => l.endsWith('commit')).length).toBeLessThanOrEqual(1);
      if (log.some((l) => l.endsWith('cancel'))) t.hit('handed on');
      if (log.filter((l) => l.startsWith('end')).length > 1) t.hit('handed on twice');
      if (log.some((l) => l.endsWith('commit')) && cands.some((c) => c.threshold)) t.hit('held back');
      if (cands[0]!.behavior.kind === 'empty' && log.some((l) => l.endsWith('commit'))) t.hit('fell through an empty handle');
    }), runs(400));
    t.expectHit('handed on', 'handed on twice', 'held back', 'fell through an empty handle');
  }, timeoutFor(400, 2));
});
