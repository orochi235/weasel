/**
 * A model test of the toast queue through adds with and without an id, dismissals, and clears: the visible toasts
 * are the model's five newest, newest first, and an id names at most one toast.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from '../../pbt.fixture';
import { createToastQueue, racQueueOf, type ToastQueue } from './queue';

const RUNS = 200;
interface Live { id?: string; title: string }
interface Model { live: Live[]; seen: ReturnType<typeof tally> }

function check(m: Model, q: ToastQueue): void {
  const shown = racQueueOf(q).visibleToasts.map((t) => t.content.title);
  expect(shown).toEqual(m.live.slice(0, 5).map((l) => l.title));
}

let n = 0;
class Add implements fc.Command<Model, ToastQueue> {
  constructor(readonly id: string | undefined) {}
  check = () => true;
  run(m: Model, q: ToastQueue) {
    const title = `t${n++}`;
    q.add('info', title, { ttlMs: null, ...(this.id === undefined ? {} : { id: this.id }) });
    if (this.id !== undefined && m.live.some((l) => l.id === this.id)) m.seen.count('replaced');
    m.live = [{ id: this.id, title }, ...m.live.filter((l) => this.id === undefined || l.id !== this.id)];
    if (m.live.length > 5) m.seen.count('overflow');
    check(m, q);
  }
  toString = () => `add(${this.id ?? ''})`;
}

class Dismiss implements fc.Command<Model, ToastQueue> {
  constructor(readonly id: string) {}
  check = () => true;
  run(m: Model, q: ToastQueue) {
    q.dismiss(this.id);
    if (m.live.some((l) => l.id === this.id)) m.seen.count('dismissed');
    m.live = m.live.filter((l) => l.id !== this.id);
    check(m, q);
  }
  toString = () => `dismiss(${this.id})`;
}

class Clear implements fc.Command<Model, ToastQueue> {
  check = () => true;
  run(m: Model, q: ToastQueue) {
    q.clear();
    m.live = [];
    check(m, q);
  }
  toString = () => 'clear';
}

const id = fc.constantFrom('a', 'b', 'c', '__proto__', 'constructor');
const commands = fc.commands([
  fc.constant(new Add(undefined)),
  fc.constant(new Add(undefined)),
  fc.constant(new Add(undefined)),
  id.map((i) => new Add(i)),
  id.map((i) => new Add(i)),
  id.map((i) => new Dismiss(i)),
  fc.constant(new Clear()),
], { maxCommands: 30, size: 'max' });

describe('the toast queue against a model', () => {
  it('shows the five newest live toasts, newest first, one per id', () => {
    const seen = tally();
    fc.assert(fc.property(commands, (cmds) => {
      fc.modelRun(() => ({ model: { live: [], seen }, real: createToastQueue() }), cmds);
    }), runs(RUNS));
    for (const k of ['replaced', 'overflow', 'dismissed']) seen.atLeast(k, 20);
  }, timeoutFor(RUNS, 5));
});
