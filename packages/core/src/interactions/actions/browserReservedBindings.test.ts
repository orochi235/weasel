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
  it('has no collision', () => {
    const actions = (Object.values(defaults) as unknown[]).filter(
      (v): v is AnyAction => typeof v === 'object' && v !== null && 'id' in v && 'invoker' in v,
    );
    expect(actions.length).toBeGreaterThan(0);
    expect(reserved(actions)).toEqual([]);
  });
});
