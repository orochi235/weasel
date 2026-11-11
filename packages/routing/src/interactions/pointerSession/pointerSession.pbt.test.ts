/**
 * Stateful test of pointer sessions against a model, through long runs of opens, moves, releases, cancels, new
 * presses, lost captures, detached origins, and `cancel()` calls over several pointers at once: each session hears
 * only its own pointer's moves while held, ends exactly once by exactly one route, and `heldWithin` reports exactly
 * the sessions still open inside a surface.
 */
import { afterEach, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally } from '../../pbt.fixture';
import { heldWithin, openPointerSession, type PointerSession } from './pointerSession';

interface MSession { pointerId: number; origin: number; reportsButtons: boolean; active: boolean; moves: number; ended: string | null }
interface Model { sessions: MSession[]; detached: Set<number> }
interface Real { surface: HTMLElement; origins: HTMLElement[]; sessions: PointerSession[]; heard: { moves: number; ended: string[] }[] }

const t = tally();
let live: Real | null = null;
afterEach(() => {
  for (const s of live?.sessions ?? []) s.cancel();
  live?.surface.remove();
  live = null;
});

function check(m: Model, r: Real): void {
  m.sessions.forEach((s, i) => {
    expect(r.sessions[i]!.active, `session ${i} active`).toBe(s.active);
    expect(r.heard[i]!.moves, `session ${i} moves`).toBe(s.moves);
    expect(r.heard[i]!.ended, `session ${i} endings`).toEqual(s.ended === null ? [] : [s.ended]);
    if (s.ended !== null) t.hit(s.ended);
  });
  for (const pid of [1, 2, 3]) {
    expect(heldWithin(pid, r.surface)).toBe(m.sessions.some((s) => s.active && s.pointerId === pid && !m.detached.has(s.origin)));
  }
}

type Cmd = fc.Command<Model, Real>;
const cmd = (label: string, run: (m: Model, r: Real) => void): Cmd => ({
  check: () => true, run: (m, r) => { run(m, r); check(m, r); }, toString: () => label,
});
const end = (m: Model, pid: number, how: string, when: (s: MSession) => boolean = () => true): void => {
  for (const s of m.sessions) if (s.active && s.pointerId === pid && when(s)) { s.active = false; s.ended = how; }
};
const send = (target: EventTarget, type: string, pointerId: number, buttons = 1) =>
  target.dispatchEvent(new PointerEvent(type, { pointerId, buttons, bubbles: true }));

const pid = fc.integer({ min: 1, max: 3 });
const origin = fc.integer({ min: 0, max: 2 });
const commands = [
  fc.tuple(pid, origin, fc.boolean()).map(([p, o, buttons]) => cmd(`open ${p} on ${o}${buttons ? '' : ' (no buttons)'}`, (m, r) => {
    const i = r.sessions.length;
    r.heard.push({ moves: 0, ended: [] });
    r.sessions.push(openPointerSession(r.origins[o]!, new PointerEvent('pointerdown', { pointerId: p, buttons: buttons ? 1 : 0 }), {
      onMove: () => { r.heard[i]!.moves++; },
      onEnd: () => { r.heard[i]!.ended.push('end'); },
      onCancel: (why) => { r.heard[i]!.ended.push(why); },
    }));
    m.sessions.push({ pointerId: p, origin: o, reportsButtons: buttons, active: true, moves: 0, ended: null });
  })),
  fc.tuple(pid, fc.constantFrom(0, 1)).map(([p, b]) => cmd(`move ${p} buttons ${b}`, (m, r) => {
    send(document, 'pointermove', p, b);
    end(m, p, 'end', (s) => s.reportsButtons && b === 0);
    for (const s of m.sessions) if (s.active && s.pointerId === p) s.moves++;
  })),
  pid.map((p) => cmd(`up ${p}`, (m) => { send(document, 'pointerup', p, 0); end(m, p, 'end'); })),
  pid.map((p) => cmd(`pointercancel ${p}`, (m) => { send(document, 'pointercancel', p); end(m, p, 'pointercancel'); })),
  pid.map((p) => cmd(`press ${p}`, (m) => { send(document, 'pointerdown', p); end(m, p, 'superseded'); })),
  fc.tuple(pid, origin).map(([p, o]) => cmd(`lost capture ${p} on ${o}`, (m, r) => {
    const el = r.origins[o]!;
    send(el.isConnected ? el : document, 'lostpointercapture', p);
    // Wherever it is sent, it reaches the document, and it ends a session whose origin has left it.
    end(m, p, 'lostcapture', (s) => m.detached.has(s.origin));
  })),
  origin.map((o) => cmd(`detach ${o}`, (m, r) => { r.origins[o]!.remove(); m.detached.add(o); })),
  fc.nat(30).map((k) => cmd(`cancel() #${k}`, (m, r) => {
    if (m.sessions.length === 0) return;
    const i = k % m.sessions.length;
    r.sessions[i]!.cancel();
    const s = m.sessions[i]!;
    if (s.active) { s.active = false; s.ended = 'aborted'; }
  })),
];

it('ends each session exactly once, by its own pointer\'s events, through long runs over several pointers', () => {
  fc.assert(fc.property(fc.commands(commands, { maxCommands: 150 }), (cmds) => {
    fc.modelRun(() => {
      for (const s of live?.sessions ?? []) s.cancel();
      live?.surface.remove();
      const surface = document.createElement('div');
      document.body.append(surface);
      const origins = [0, 1, 2].map(() => { const el = document.createElement('span'); surface.append(el); return el; });
      live = { surface, origins, sessions: [], heard: [] };
      return { model: { sessions: [], detached: new Set() }, real: live };
    }, cmds);
  }), runs(200));
  t.expectHit('end', 'pointercancel', 'superseded', 'lostcapture', 'aborted');
});
