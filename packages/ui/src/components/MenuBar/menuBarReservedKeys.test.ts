import { describe, expect, it } from 'vitest';
import { browserReservedChord } from '@weasel-js/routing';
import type { KeySpec } from '@weasel-js/gestures';
import { DEFAULT_ACCESS_CHORD } from './MenuBar';
import { openBindings } from './useMenuBarKeys';

/** Collisions waiting on a choice of key, each listed under "Audit round twelve" in `docs/unruled.md`.
 *  Drop an entry once its key changes. */
const KNOWN = ['menu.open.f', 'menu.open.e', 'menu.open.v', 'menu.open.h'];

describe('the menu bar access keys a browser reserves', () => {
  it('collide only where known, under the default chord and the usual titles', () => {
    const titles = ['File', 'Edit', 'View', 'Window', 'Help'].map((t) => ({ key: t, access: t }));
    const bindings = openBindings(titles, DEFAULT_ACCESS_CHORD) as readonly { spec: KeySpec; opts?: { id?: string } }[];
    const hits = bindings
      .filter((b) => browserReservedChord(b.spec) !== null)
      .map((b) => b.opts?.id);
    expect(hits).toEqual(KNOWN);
  });
});
