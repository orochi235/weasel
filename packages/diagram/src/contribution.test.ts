import { describe, it, expect, vi } from 'vitest';
import { createScene, type ActionDeps } from '@weasel-js/core';
import {
  CONNECT_ACTION_ID, GRAB_WAYPOINT_ACTION_ID, SELECT_LABEL_EDGE_ACTION_ID, createDiagramContribution, diagramLabelDrag, diagramWaypoints,
} from './contribution';
import { SET_HOPS_ACTION_ID } from './hops/hopsAction';
import { PORT_AFFORDANCE_KIND } from './portAffordance';
import { REMOVE_WAYPOINT_ACTION_ID, RESET_ROUTE_ACTION_ID } from './routeCommands';
import { ROUTE_EDIT_ACTION_ID } from './waypointAction';
import { WAYPOINT_AFFORDANCE_KIND, WAYPOINT_LAYER_ID } from './waypointLayer';

interface Rect { x: number; y: number; width: number; height: number }

const PARTICIPANTS = () => [];

/** Only the pointer-shaped specs carry a target; a key spec does not. */
const targetOf = (spec: object): unknown => (spec as { target?: unknown }).target;

describe('createDiagramContribution', () => {
  it('binds connect to a drag off the port layer', () => {
    const c = createDiagramContribution<Rect>({ participants: PARTICIPANTS });
    const drag = c.bindings!.find((b) => b.spec.kind === 'drag')!;
    expect(drag.spec).toEqual({ kind: 'drag', target: `affordance:${PORT_AFFORDANCE_KIND}` });
    expect(drag.actionId).toBe(CONNECT_ACTION_ID);
  });

  it('consults the port affordance on every gesture its claim bars', () => {
    // A port claims the whole press protocol so a port drag is never a node
    // move. An exclusive claim bars every binding that does not consult the
    // affordance — so if `pointerDown` and `click` name no binding of ours the
    // press is dropped on the floor and the drag never starts.
    const c = createDiagramContribution<Rect>({ participants: PARTICIPANTS });
    const kinds = c.bindings!
      .filter((b) => targetOf(b.spec) === `affordance:${PORT_AFFORDANCE_KIND}`)
      .map((b) => b.spec.kind)
      .sort();
    expect(kinds).toEqual(['click', 'drag', 'pointerDown']);
  });

  it('declares each binding exactly once', () => {
    // The action carrying a `defaultBinding` that the bundle also declares is
    // one route registered twice, which the kit reports as a route conflict.
    const c = createDiagramContribution<Rect>({ participants: PARTICIPANTS });
    const tuples = c.bindings!.map((b) => `${b.spec.kind}:${String(targetOf(b.spec))}`);
    expect(new Set(tuples).size).toBe(tuples.length);
    expect(c.actions!.every((a) => a.defaultBinding === undefined)).toBe(true);
  });

  it('is ambient — a port is grabbable whatever tool is active', () => {
    const c = createDiagramContribution<Rect>({ participants: PARTICIPANTS });
    expect(c.eligibility).toEqual({ claimed: true });
  });

  it('declares no overlay — a painted layer is never hit-tested', () => {
    // The port layer has to be attached with `registerLayer`. Shipping it as
    // `Contribution.overlay` would paint the ports and make none of them
    // grabbable, which is the failure this arc exists to fix.
    const c = createDiagramContribution<Rect>({ participants: PARTICIPANTS });
    expect(c.overlay).toBeUndefined();
  });
});

describe('diagramWaypoints', () => {
  const bundle = () => diagramWaypoints<Rect>({ participants: PARTICIPANTS, selected: () => [] });

  it('binds the drag, the double-click, and the claim to the route handles', () => {
    const { contribution } = bundle();
    const onHandles = contribution.bindings!.filter((b) => targetOf(b.spec) === `affordance:${WAYPOINT_AFFORDANCE_KIND}`);
    expect(onHandles.map((b) => `${b.spec.kind}>${b.actionId}`).sort()).toEqual([
      `click>${GRAB_WAYPOINT_ACTION_ID}`,
      `doubleClick>${REMOVE_WAYPOINT_ACTION_ID}`,
      `drag>${ROUTE_EDIT_ACTION_ID}`,
      `pointerDown>${GRAB_WAYPOINT_ACTION_ID}`,
    ]);
  });

  it('carries the reset-route command', () => {
    expect(bundle().contribution.actions!.map((a) => a.id)).toContain(RESET_ROUTE_ACTION_ID);
  });

  it('carries the line jumps command', () => {
    expect(bundle().contribution.actions!.map((a) => a.id)).toContain(SET_HOPS_ACTION_ID);
  });

  it('hands back the layer the handles are composed into', () => {
    expect(bundle().layer.id).toBe(WAYPOINT_LAYER_ID);
  });
});

describe('diagramLabelDrag', () => {
  it("applies a click on a label to its edge's selection with the click's modifiers", () => {
    const { contribution } = diagramLabelDrag({ scene: createScene({ systemLayers: [{ id: 'main' }] }), selected: () => [] });
    const click = contribution.bindings!.find((b) => b.actionId === SELECT_LABEL_EDGE_ACTION_ID)!;
    expect((click.spec as { mods?: unknown }).mods).toMatchObject({ shift: 'optional', meta: 'optional' });
    const action = contribution.actions!.find((a) => a.id === SELECT_LABEL_EDGE_ACTION_ID)!;
    if (action.invoker?.timing !== 'immediate') throw new Error('expected an immediate invoker');
    const applyClick = vi.fn();
    const mods = { alt: false, shift: true, meta: false, ctrl: false };
    const payload = { targetId: 'ab/label', labelId: 'ab/label', edgeId: 'ab' };
    action.invoker.run({ selection: { applyClick } } as unknown as ActionDeps, { affordance: { payload }, mods });
    expect(applyClick).toHaveBeenCalledWith('ab', mods);
  });
});
