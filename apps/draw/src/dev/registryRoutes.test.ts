import { describe, it, expect } from 'vitest';
import type { ToolDef } from '@weasel-js/core';
import { routesForSpec } from '@weasel-js/core/routing';
import { collectDeclaredRoutes } from './registryProbe';

function toolDef(bindings: unknown[]): ToolDef<unknown> {
  return { id: 'probe', bindings } as unknown as ToolDef<unknown>;
}

function routesOf(specs: unknown[]): readonly string[] {
  const bindings = specs.map((spec) => ({ spec, actionId: 'act' }));
  const def = toolDef(bindings);
  return collectDeclaredRoutes(def, def.bindings, [], new Map()).map((r) => r.route);
}

describe('inspector route projection', () => {
  it('routes drop and paste bindings', () => {
    expect(routesOf([{ kind: 'drop' }, { kind: 'paste' }]))
      .toEqual(['[*] drop', '[*] paste']);
  });

  it('agrees with the kit for every binding it projects', () => {
    const specs = [
      { kind: 'drop' },
      { kind: 'paste', types: ['text/plain'] },
      { kind: 'drag', target: 'selected-body' },
      { kind: 'wheel', direction: 'up' },
      { kind: 'key', key: ['ArrowUp', 'ArrowDown'] },
      { kind: 'multiTouchTap', fingers: 2 },
      { kind: 'multiTouch' },
    ];
    const expected = specs.flatMap((spec) => routesForSpec(spec as never));
    expect(routesOf(specs)).toEqual(expected);
  });
});
