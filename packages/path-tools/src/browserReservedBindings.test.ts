import { describe, expect, it } from 'vitest';
import { actionBindings, browserReservedChord } from '@weasel-js/routing';
import { pathTools } from './presets';

describe('path-tools key bindings a browser reserves', () => {
  it('binds no chord a browser takes first', () => {
    const actions = (pathTools.includes ?? []).flatMap((p) => p.actions ?? []);
    const reserved = actions.flatMap((action) => actionBindings(action)
      .filter((b) => b.spec.kind === 'key')
      .flatMap((b) => (browserReservedChord(b.spec as Parameters<typeof browserReservedChord>[0]) ? [action.id] : [])));
    expect(actions.length).toBeGreaterThan(0);
    expect(reserved).toEqual([]);
  });
});
