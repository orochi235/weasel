import { describe, it, expect } from 'vitest';
import { createDepRegistry, type Action, type Contribution, type DepName } from '@weasel-js/routing';
import { describeRegistry } from './registry';

const rect = {
  id: 'rect',
  eligibility: { focus: true },
  presentation: { label: 'Rectangle', icon: 'core:rect', group: 'shapes', shortcut: 'R' },
  bindings: [{ spec: { kind: 'drag' }, actionId: 'insert', opts: { params: { shape: 'rect' } } }],
  cursor: 'crosshair',
} as unknown as Contribution<unknown>;

const wheel = {
  id: 'wheel-zoom',
  eligibility: { always: true },
  bindings: [{ spec: { kind: 'wheel' }, actionId: 'viewport.zoom' }],
  actions: [{ id: 'viewport.zoom', label: 'Zoom' }],
  deps: { zoom: () => 1 },
  overlay: {},
} as unknown as Contribution<unknown>;

const preset = { id: 'snap', eligibility: { always: true }, presentation: { hide: true } } as unknown as Contribution<unknown>;

const actions: Action[] = [
  {
    id: 'flip', label: 'Flip', icon: 'core:flip' as never, group: 'arrange', tags: ['mirror'], shortcut: '⇧H',
    requires: ['selection' as DepName],
    invoker: { timing: 'immediate', run: () => {} } as never,
    variants: [{ key: 'h', label: 'Horizontal', params: { axis: 'x' } }],
    defaultBinding: [{ spec: { kind: 'key', key: 'h', mods: { shift: true } } as never, opts: { params: { axis: 'x' } } }],
    enabled: (deps) => ((deps as { selection?: unknown[] } | undefined)?.selection?.length ? true : 'selection-required'),
    active: () => false,
  },
  { id: 'undo', label: 'Undo', scope: 'hotkey', preview: () => {}, eligible: { capability: 'edits' } as never },
];

function setup() {
  const deps = createDepRegistry();
  deps.register('selection' as DepName, (() => []) as never);
  return describeRegistry({
    tools: { registry: { rect }, ambient: [wheel] },
    contributions: [preset],
    actions: { list: () => actions },
    deps,
    routingKinds: ['rect', 'container'],
  });
}

describe('describeRegistry', () => {
  it('lists tools, always-on entries and preset contributions with their bindings', () => {
    const { tools } = setup();
    expect(tools.map((t) => [t.id, t.slot])).toEqual([['rect', 'tool'], ['wheel-zoom', 'ambient'], ['snap', 'contribution']]);
    expect(tools[0]).toEqual({
      id: 'rect', slot: 'tool', label: 'Rectangle', icon: 'core:rect', group: 'shapes', shortcut: 'R', hotkey: null,
      hidden: false, cursor: 'crosshair', eligibility: { focus: true },
      bindings: [{ actionId: 'insert', spec: { kind: 'drag' }, routes: expect.any(Array), opts: { params: { shape: 'rect' } } }],
      actions: [], deps: [], hasOverlay: false,
    });
    expect(tools[0]!.bindings[0]!.routes.length).toBeGreaterThan(0);
    expect(tools[1]).toMatchObject({ label: 'wheel-zoom', actions: ['viewport.zoom'], deps: ['zoom'], hasOverlay: true });
    expect(tools[2]).toMatchObject({ hidden: true });
  });

  it('describes each action, asking enabled and active with the deps it requires', () => {
    const { actions: out } = setup();
    expect(out[0]).toEqual({
      id: 'flip', label: 'Flip', icon: 'core:flip', group: 'arrange', tags: ['mirror'], shortcut: '⇧H',
      scope: 'ambient', invoker: 'immediate', requires: ['selection'],
      variants: [{ key: 'h', label: 'Horizontal', icon: null, params: { axis: 'x' } }],
      enabled: 'selection-required', active: false, hasPreview: false, eligible: null,
      bindings: [{ actionId: 'flip', spec: { kind: 'key', key: 'h', mods: { shift: true } }, routes: expect.any(Array), opts: { params: { axis: 'x' } } }],
    });
    expect(out[1]).toMatchObject({
      id: 'undo', scope: 'hotkey', invoker: null, enabled: true, active: null, hasPreview: true,
      eligible: { capability: 'edits' }, bindings: [],
    });
  });

  it('lists the deps the registry answers, and the routing kinds', () => {
    const r = setup();
    expect(r.deps).toEqual([{ name: 'selection', depth: 0, stacked: 1 }]);
    expect(r.routingKinds).toEqual(['rect', 'container']);
  });
});
