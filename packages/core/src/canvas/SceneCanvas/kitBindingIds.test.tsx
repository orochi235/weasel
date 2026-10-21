/**
 * Every binding the kit ships declares an `opts.id`, and no two different
 * bindings share one: a binding override names a binding by that id, and a
 * derived `<owner>#<n>` moves whenever the defaults are reordered.
 *
 * The sweep reads every action, preset and contribution the packages export
 * as a value, and builds the tools and contributions that only a hook or a
 * factory makes. A binding several owners carry, one builder called twice,
 * keeps one id: one override moves it everywhere.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { actionBindings, type Action, type GestureBinding } from '@weasel-js/routing';
import * as routing from '@weasel-js/routing';
import * as core from '@weasel-js/core';
import * as pathTools from '@weasel-js/path-tools';
import * as diagram from '@weasel-js/diagram';
import * as diagramEffect from '@weasel-js/diagram/effect';
import * as kernel3d from '@weasel-js/kernel3d';
import * as rig from '@weasel-js/rig';
import * as guides from '@weasel-js/guides';
import * as hud from '@weasel-js/hud';
import * as minimap from '@weasel-js/minimap';
import * as symmetry from '@weasel-js/symmetry';
import { createModeRegistry } from '@weasel-js/modes';
import { createScene } from 'core/scene/scene';
import * as builtins from 'tools/builtin';
import { createMeasurements } from 'features/measure/measurements';
import { measurementsContribution } from 'features/measure/measureContribution';
import { modeTriggers } from 'features/modes/modeTriggers';
import { buildToolActivateBindings, makeToolActivateAction } from 'interactions/actions/defaults/toolActivate';
import { makeToolResetToDefaultAction } from 'interactions/actions/defaults/toolResetToDefault';

interface Found { id: string | undefined; where: string; binding: GestureBinding }

type Owner = { id: string; bindings?: readonly GestureBinding[]; actions?: readonly Action[] };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isAction = (v: unknown): v is Action => isObject(v) && typeof v.id === 'string' && isObject(v.invoker);
const isOwner = (v: unknown): v is Owner =>
  isObject(v) && typeof v.id === 'string' && (Array.isArray(v.bindings) || Array.isArray(v.actions));
const isPreset = (v: unknown): v is core.FeaturePreset =>
  isObject(v) && typeof v.id === 'string' && !('invoker' in v)
  && ['ambient', 'tools', 'includes', 'contributions', 'moveBehaviors', 'chrome', 'pathEdit', 'snapSources']
    .some((k) => k in v);

class Sweep {
  readonly found: Found[] = [];
  private readonly seen = new Set<unknown>();

  value(v: unknown, where: string): void {
    if (this.seen.has(v)) return;
    if (Array.isArray(v)) { v.forEach((x, i) => this.value(x, `${where}[${i}]`)); return; }
    if (isAction(v)) this.action(v, where);
    else if (isPreset(v)) this.preset(v, where);
    else if (isOwner(v)) this.owner(v, where);
    else if (isObject(v)) {
      // A factory's bundle: `{ layer, contribution }` and the like.
      for (const key of ['contribution', 'contributions', 'ambient', 'tool', 'tools']) {
        if (key in v) this.value(v[key], `${where}.${key}`);
      }
    }
  }

  action(a: Action, where: string): void {
    if (this.seen.has(a)) return;
    this.seen.add(a);
    actionBindings(a).forEach((b, i) => this.found.push({ id: b.opts?.id, where: `${where}: action ${a.id} [${i}]`, binding: b }));
  }

  owner(o: Owner, where: string): void {
    if (this.seen.has(o)) return;
    this.seen.add(o);
    (o.bindings ?? []).forEach((b, i) => this.found.push({ id: b.opts?.id, where: `${where}: ${o.id} [${i}]`, binding: b }));
    (o.actions ?? []).forEach((a) => this.action(a, where));
  }

  preset(p: core.FeaturePreset, where: string): void {
    if (this.seen.has(p)) return;
    this.seen.add(p);
    const at = `${where}: preset ${p.id}`;
    (p.actions ?? []).forEach((a) => this.action(a, at));
    if (p.ambient) {
      this.owner(p.ambient({}), at);
      this.owner(p.ambient({ move: { moveLabel: 'Move' }, rotate: { rotateLabel: 'Rotate' } }), at);
    }
    (p.contributions ?? []).forEach((c) => this.value(c, at));
    (p.tools ?? []).forEach((t) => this.value(t, at));
    (p.includes ?? []).forEach((inner) => this.preset(inner, at));
  }

  module(mod: Record<string, unknown>, name: string): void {
    for (const [key, v] of Object.entries(mod)) this.value(v, `${name}.${key}`);
  }

  hook<T>(fn: () => T, where: string): void {
    const { result } = renderHook(fn);
    this.value(Object.values(result.current as object).length && !isOwner(result.current)
      ? Object.values(result.current as object)
      : result.current, where);
  }
}

/** A binding's identity apart from its id and the params its builder was configured with. */
function signature(b: GestureBinding): string {
  return JSON.stringify({ actionId: b.actionId, spec: b.spec },
    (_k, v: unknown) => (typeof v === 'function' ? `fn:${v.toString()}` : v));
}

function sweepKit(): Sweep {
  const s = new Sweep();
  const scene = createScene({ systemLayers: [{ id: 'main' }] }) as never;
  s.module(routing as unknown as Record<string, unknown>, 'routing');
  s.module(core as unknown as Record<string, unknown>, 'core');
  s.module(pathTools as unknown as Record<string, unknown>, 'path-tools');
  s.module(diagram as unknown as Record<string, unknown>, 'diagram');
  s.module(diagramEffect as unknown as Record<string, unknown>, 'diagram/effect');
  s.module(kernel3d as unknown as Record<string, unknown>, 'kernel3d');
  s.module(rig as unknown as Record<string, unknown>, 'rig');
  s.module(guides as unknown as Record<string, unknown>, 'guides');
  s.module(hud as unknown as Record<string, unknown>, 'hud');
  s.module(minimap as unknown as Record<string, unknown>, 'minimap');
  s.module(symmetry as unknown as Record<string, unknown>, 'symmetry');

  // Built-in tools.
  s.hook(() => ({
    hand: builtins.useHandTool({}),
    select: builtins.useSelectTool({} as never, {} as never),
    lasso: builtins.useLassoTool(),
    rect: builtins.useRectTool(),
    ellipse: builtins.useEllipseTool(),
    line: builtins.useLineTool(),
    star: builtins.useStarTool({} as never),
    polygon: builtins.usePolygonTool({} as never),
    pen: builtins.usePenTool(),
    pencil: builtins.usePencilTool(),
    slice: builtins.useSliceTool(),
    measure: builtins.useMeasureTool({ measurements: createMeasurements({ layer: 'notes' }) }),
    text: builtins.useTextTool(),
    sticky: builtins.useStickyTool(),
    eyedropper: builtins.useEyedropperTool({} as never),
  }), 'core builtin tools');

  // Core's generated and factory-built bindings.
  s.value(makeToolActivateAction(buildToolActivateBindings([
    { toolId: 'rect', keyOpts: { key: 'R' } }, { toolId: 'rect', keyOpts: { key: 'M' } },
    { toolId: 'hand', keyOpts: { key: 'H' } },
  ])), 'tool.activate');
  s.value(makeToolResetToDefaultAction(() => null), 'tool.resetToDefault');
  s.value(routing.makeToolOffhandAction(routing.buildToolOffhandBindings([
    { toolId: 'hand', trigger: { key: 'Space' } },
  ] as never)), 'tool.offhand');
  s.value(core.selectionMoveContribution({ reparentOnDrop: 'top' }), 'selectionMoveContribution');
  s.value(core.selectionTransformContribution(), 'selectionTransformContribution');
  s.value(core.selectionResizeContribution(), 'selectionResizeContribution');
  s.value(core.selectionRotateContribution(), 'selectionRotateContribution');
  s.value(core.areaSelectContribution(), 'areaSelectContribution');
  s.value(core.dragPanContribution(), 'dragPanContribution');
  s.value(measurementsContribution(scene, createMeasurements({ layer: 'notes' })), 'measurementsContribution');
  const modes = createModeRegistry({
    initial: 'object',
    modes: [
      { id: 'object' },
      {
        id: 'edit',
        entry: { trigger: 'double-click-target', targets: ['path'], shortcut: 'E' },
        exit: { shortcut: 'Escape' }, discard: { shortcut: 'Mod+Backspace' },
        commit: { shortcut: 'Enter' }, cancel: { shortcut: 'Mod+.' },
      },
    ] as never,
  });
  const run = (): void => {};
  s.value(modeTriggers(modes, { enter: run }), 'modeTriggers');
  s.value(routing.modeShortcuts(modes, { enter: run, exit: run, discard: run, commit: run, cancel: run }), 'modeShortcuts');

  // Other packages' hooks and factories.
  s.hook(() => pathTools.usePathToolsTools(), 'path-tools tools');
  s.hook(() => ({ bone: rig.useBoneTool({} as never), weight: rig.useWeightTool({} as never) }), 'rig tools');
  s.hook(() => ({ orbit: kernel3d.useOrbitTool() }), 'kernel3d tools');
  s.value(guides.createSpacingHintsPreset(), 'guides.createSpacingHintsPreset');
  s.value(guides.distanceReadout(), 'guides.distanceReadout');
  s.value(hud.createHudContribution(), 'hud.createHudContribution');
  s.value(minimap.createMinimapContribution({} as never), 'minimap.createMinimapContribution');
  s.value(minimap.createLinkedCursorContribution(), 'minimap.createLinkedCursorContribution');
  s.value(symmetry.createSymmetry(scene), 'symmetry.createSymmetry');
  s.value(diagram.createDiagramContribution({} as never), 'diagram.createDiagramContribution');
  s.value(diagram.diagramWaypoints({} as never), 'diagram.diagramWaypoints');
  s.value(diagram.diagramLabelDrag({} as never), 'diagram.diagramLabelDrag');
  s.value(diagram.diagramEdgeEnds({} as never), 'diagram.diagramEdgeEnds');
  s.value(diagram.reorderContribution({} as never), 'diagram.reorderContribution');
  s.value(diagram.groupReorderContribution(() => {}), 'diagram.groupReorderContribution');
  s.value(diagram.diagramContainers({} as never), 'diagram.diagramContainers');
  s.value(diagram.diagramOffPage(), 'diagram.diagramOffPage');
  s.value(diagram.connectorTool({} as never), 'diagram.connectorTool');
  s.value(diagram.stencilTool({ id: 'box', label: 'Box' }), 'diagram.stencilTool');
  s.value({ id: 'diagram bindings', bindings: [diagram.editEdgeLabelBinding(), diagram.editContainerTitleBinding()] }, 'diagram');
  return s;
}

describe('kit binding ids', () => {
  const sweep = sweepKit();

  it('reaches the kit', () => {
    expect(sweep.found.length).toBeGreaterThan(100);
  });

  it('gives every kit binding a declared id', () => {
    expect(sweep.found.filter((f) => f.id === undefined).map((f) => f.where)).toEqual([]);
  });

  it('gives no two different bindings one id', () => {
    const byId = new Map<string, Map<string, string>>();
    for (const f of sweep.found) {
      if (f.id === undefined) continue;
      const sigs = byId.get(f.id) ?? new Map<string, string>();
      sigs.set(signature(f.binding), f.where);
      byId.set(f.id, sigs);
    }
    const shared = [...byId].filter(([, sigs]) => sigs.size > 1).map(([id, sigs]) => `${id}: ${[...sigs.values()].join(' | ')}`);
    expect(shared).toEqual([]);
  });
});
