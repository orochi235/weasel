import { describe, it, expect, afterEach, vi } from 'vitest';
import { matchSorted } from './interactions/dispatcher/matcher';
import { isDev } from './devFlag';

/**
 * A bundle that reads `process.env` bare works everywhere the kit is normally
 * tested — vitest, jsdom, vite, webpack — because all of them define `process`
 * or substitute the read at build time. A consumer loading the published ESM
 * from a `<script type="module">`, or bundling with esbuild and no `--define`,
 * defines neither, and the read throws a ReferenceError out of whatever called
 * it. These run with `process` genuinely absent, which is the only arrangement
 * that can fail.
 */
const realProcess = globalThis.process;
afterEach(() => { globalThis.process = realProcess; });

function withoutProcess<T>(fn: () => T): T {
  // @ts-expect-error — deleting a global the runtime guarantees is the point.
  delete globalThis.process;
  return fn();
}

describe('dev-flag reads survive a runtime with no process', () => {
  it('isDev answers rather than throwing', () => {
    expect(withoutProcess(() => isDev())).toBe(true);
  });

  it('an exclusive claim matching no binding still drops the press cleanly', () => {
    const warn = vi.fn();
    // An exclusive claim nothing targets, against a binding pool that is
    // non-empty but whose only entry consults no affordance — the dead-claim
    // report's exact precondition.
    const event = {
      kind: 'pointerdown', x: 0, y: 0, clientX: 0, clientY: 0,
      altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      affordance: { kind: 'layer:colorKnob', owner: 'colorKnob', strength: 'exclusive' },
    } as never;
    const pool = [{
      binding: { spec: { kind: 'drag' }, actionId: 'insert' },
      scope: 'active', ownerToolId: 'rect',
    }] as never;
    expect(withoutProcess(() => matchSorted(event, pool, false, undefined, warn))).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });
});
