/**
 * Every binding the kit ships, gathered in one place: every action, preset and
 * contribution the packages export as a value, and the tools and contributions
 * that only a hook or a factory makes. The binding-id and binding-collision
 * tests read it.
 */
import { renderHook } from '@testing-library/react';
import { actionBindings, type Action, type Contribution, type GestureBinding } from '@weasel-js/routing';
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
import { createMeasurements } from 'domains/measure/measurements';
import { measurementsContribution } from 'domains/measure/measureContribution';
import { modeTriggers } from 'domains/modes/modeTriggers';
import { buildToolActivateBindings, createToolActivateAction } from 'interactions/actions/defaults/toolActivate';
import { createToolResetToDefaultAction } from 'interactions/actions/defaults/toolResetToDefault';

export interface FoundBinding { id: string | undefined; where: string; binding: GestureBinding }

/** A tool or contribution the sweep reached, and where. */
export interface FoundEntry { entry: Contribution<unknown>; where: string }

type Owner = { id: string; bindings?: readonly GestureBinding[]; actions?: readonly Action[] };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isAction = (v: unknown): v is Action => isObject(v) && typeof v.id === 'string' && isObject(v.invoker);
const isOwner = (v: unknown): v is Owner =>
  isObject(v) && typeof v.id === 'string' && (Array.isArray(v.bindings) || Array.isArray(v.actions) || isObject(v.eligibility));
const isPreset = (v: unknown): v is core.FeaturePreset =>
  isObject(v) && typeof v.id === 'string' && !('invoker' in v)
  && ['ambient', 'tools', 'includes', 'contributions', 'moveBehaviors', 'chrome', 'pathEdit', 'snapSources']
    .some((k) => k in v);

function firstPerId(found: readonly FoundEntry[]): Contribution<unknown>[] {
  const byId = new Map<string, Contribution<unknown>>();
  for (const { entry } of found) if (!byId.has(entry.id)) byId.set(entry.id, entry);
  return [...byId.values()];
}

export class Sweep {
  readonly found: FoundBinding[] = [];
  /** Every action reached, first one per id. */
  readonly actions = new Map<string, { action: Action; where: string }>();
  readonly entries: FoundEntry[] = [];
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
    if (!this.actions.has(a.id)) this.actions.set(a.id, { action: a, where });
    actionBindings(a).forEach((b, i) => this.found.push({ id: b.opts?.id, where: `${where}: action ${a.id} [${i}]`, binding: b }));
  }

  owner(o: Owner, where: string): void {
    if (this.seen.has(o)) return;
    this.seen.add(o);
    if (isObject((o as { eligibility?: unknown }).eligibility)) this.entries.push({ entry: o as Contribution<unknown>, where });
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

  /** The tools reached, entries that take the active slot, first one per id. */
  tools(): Contribution<unknown>[] {
    return firstPerId(this.entries.filter((e) => e.entry.eligibility?.focus));
  }

  /** The always-on entries reached, first one per id: one id built twice is one entry built two ways. */
  ambient(): Contribution<unknown>[] {
    return firstPerId(this.entries.filter((e) => !e.entry.eligibility?.focus));
  }
}

/** The built-in tools, which only their hooks make. */
function builtinTools(s: Sweep): void {
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
    anchors: builtins.anchorsTool,
  }), 'core builtin tools');
}

/** Core's generated and factory-built bindings. */
function coreFactories(s: Sweep, scene: never): void {
  s.value(createToolActivateAction(buildToolActivateBindings([
    { toolId: 'rect', keyOpts: { key: 'R' } }, { toolId: 'rect', keyOpts: { key: 'M' } },
    { toolId: 'hand', keyOpts: { key: 'H' } },
  ])), 'tool.activate');
  s.value(createToolResetToDefaultAction(() => null), 'tool.resetToDefault');
  s.value(routing.createToolOffhandAction(routing.buildToolOffhandBindings([{ toolId: 'hand', key: ' ' }])), 'tool.offhand');
  s.value(core.selectionMoveContribution({ reparentOnDrop: 'top' }), 'selectionMoveContribution');
  s.value(core.selectionTransformContribution(), 'selectionTransformContribution');
  s.value(core.selectionResizeContribution(), 'selectionResizeContribution');
  s.value(core.selectionRotateContribution(), 'selectionRotateContribution');
  s.value(core.areaSelectContribution(), 'areaSelectContribution');
  s.value(core.dragPanContribution(), 'dragPanContribution');
  s.value(core.createPresentationContribution(), 'createPresentationContribution');
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
}

/** Other packages' hooks and factories. */
function packageFactories(s: Sweep, scene: never): void {
  s.hook(() => pathTools.usePathToolsTools(), 'path-tools tools');
  s.hook(() => ({ bone: rig.useBoneTool({} as never), weight: rig.useWeightTool({} as never) }), 'rig tools');
  s.hook(() => ({ orbit: kernel3d.useOrbitTool() }), 'kernel3d tools');
  s.value(guides.createSpacingHintsPreset(), 'guides.createSpacingHintsPreset');
  s.value(guides.distanceReadout(), 'guides.distanceReadout');
  s.value(hud.createHudContribution(), 'hud.createHudContribution');
  s.value(minimap.createMinimapContribution({} as never), 'minimap.createMinimapContribution');
  s.value(minimap.createLinkedCursorContribution(), 'minimap.createLinkedCursorContribution');
  s.value(symmetry.createSymmetry(scene), 'symmetry.createSymmetry');
  s.value(diagram.diagramPorts({ participants: () => [] } as never), 'diagram.diagramPorts');
  s.value(diagram.diagramWaypoints({} as never), 'diagram.diagramWaypoints');
  s.value(diagram.diagramLabelDrag({} as never), 'diagram.diagramLabelDrag');
  s.value(diagram.diagramEdgeEnds({} as never), 'diagram.diagramEdgeEnds');
  s.value(diagram.reorderContribution({} as never), 'diagram.reorderContribution');
  s.value(diagram.groupReorderContribution(() => {}), 'diagram.groupReorderContribution');
  s.value(diagram.createReorderPreset({} as never), 'diagram.createReorderPreset');
  s.value(diagram.createGroupReorderPreset(() => {}), 'diagram.createGroupReorderPreset');
  s.value(diagram.diagramContainers({} as never), 'diagram.diagramContainers');
  s.value(diagram.diagramOffPage(), 'diagram.diagramOffPage');
  s.value(diagram.connectorTool({} as never), 'diagram.connectorTool');
  s.value(diagram.stencilTool({ id: 'box', label: 'Box' }), 'diagram.stencilTool');
  s.value({ id: 'diagram bindings', bindings: [diagram.editEdgeLabelBinding(), diagram.editContainerTitleBinding()] }, 'diagram');
}

export function sweepKit(): Sweep {
  const s = new Sweep();
  const scene = createScene({ systemLayers: [{ id: 'main' }] }) as never;
  const modules: [Record<string, unknown>, string][] = [
    [routing as unknown as Record<string, unknown>, 'routing'],
    [core as unknown as Record<string, unknown>, 'core'],
    [pathTools as unknown as Record<string, unknown>, 'path-tools'],
    [diagram as unknown as Record<string, unknown>, 'diagram'],
    [diagramEffect as unknown as Record<string, unknown>, 'diagram/effect'],
    [kernel3d as unknown as Record<string, unknown>, 'kernel3d'],
    [rig as unknown as Record<string, unknown>, 'rig'],
    [guides as unknown as Record<string, unknown>, 'guides'],
    [hud as unknown as Record<string, unknown>, 'hud'],
    [minimap as unknown as Record<string, unknown>, 'minimap'],
    [symmetry as unknown as Record<string, unknown>, 'symmetry'],
  ];
  for (const [mod, name] of modules) s.module(mod, name);
  builtinTools(s);
  coreFactories(s, scene);
  packageFactories(s, scene);
  return s;
}
