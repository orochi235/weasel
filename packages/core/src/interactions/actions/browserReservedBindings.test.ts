import { describe, expect, it } from 'vitest';
import { actionBindings, browserReservedChord } from '@weasel-js/routing';
import type { KeySpec } from '@weasel-js/gestures';
import * as defaults from './defaults';

import type { Action } from '@weasel-js/routing';

type AnyAction = Action;

/** Every default key binding of `actions` that a browser takes first. */
function reserved(actions: readonly AnyAction[]): string[] {
  return actions.flatMap((action) =>
    actionBindings(action)
      .filter((b) => b.spec.kind === 'key')
      .flatMap((b) => {
        const hit = browserReservedChord(b.spec as KeySpec);
        return hit ? [`${action.id}: ${JSON.stringify((b.spec as KeySpec).mods ?? {})}+${hit.key} (${hit.use})`] : [];
      }));
}

describe('kit key bindings a browser reserves', () => {
  it('has no collision but the two known ones', () => {
    const actions = (Object.values(defaults) as unknown[]).filter(
      (v): v is AnyAction => typeof v === 'object' && v !== null && 'id' in v && 'invoker' in v,
    );
    // Filed in docs/TODO.md; a new entry here is a new collision.
    expect(reserved(actions).map((r) => r.split(':')[0])).toEqual(['createOutlines', 'averageAnchors']);
  });
});
