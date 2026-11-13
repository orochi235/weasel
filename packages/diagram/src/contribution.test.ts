import { describe, it, expect, vi } from 'vitest';
import { IDENTITY_POSE_COMPOSITION, createScene, type ActionDeps } from '@weasel-js/core';
import {
  CONNECT_ACTION_ID, GRAB_WAYPOINT_ACTION_ID, SELECT_LABEL_EDGE_ACTION_ID, diagramLabelDrag, diagramPorts, diagramWaypoints,
} from './contribution';
import { SET_HOPS_ACTION_ID } from './hops/hopsAction';
import { PORT_AFFORDANCE_KIND, PORT_LAYER_ID } from './portAffordance';
import { REMOVE_WAYPOINT_ACTION_ID, RESET_ROUTE_ACTION_ID } from './routeCommands';
import { ROUTE_EDIT_ACTION_ID } from './waypointAction';
import { WAYPOINT_AFFORDANCE_KIND, WAYPOINT_LAYER_ID } from './waypointLayer';

interface Rect { x: number; y: number; width: number; height: number }

const PARTICIPANTS = () => [];

/** Only the pointer-shaped specs carry a target; a key spec does not. */
const targetOf = (spec: object): unknown => (spec as { target?: unknown }).target;

describe('diagramPorts', () => {
  it('binds connect to a drag off the port layer', () => {
    const c = diagramPorts<Rect>({ participants: PARTICIPANTS });
    const drag = c.bindings!.find((b) => b.spec.kind === 'drag')!;
    expect(drag.spec).toEqual({ kind: 'drag', target: `affordance:${PORT_AFFORDANCE_KIND}` });
    expect(drag.actionId).toBe(CONNECT_ACTION_ID);
  });

  it('consults the port affordance on every gesture its claim bars', () => {
    // A port claims the whole press protocol so a port drag is never a node
    // move. An exclusive claim bars every binding that does not consult the
    // affordance — so if `pointerDown` and `click` name no binding of ours the
    // press is dropped on the floor and the drag never starts.
    const c = diagramPorts<Rect>({ participants: PARTICIPANTS });
    const kinds = c.bindings!
      .filter((b) => targetOf(b.spec) === `affordance:${PORT_AFFORDANCE_KIND}`)
      .map((b) => b.spec.kind)
      .sort();
    expect(kinds).toEqual(['click', 'drag', 'pointerDown']);
  });

  it('declares each binding exactly once', () => {
    // The action carrying a `defaultBinding` that the bundle also declares is
    // one route registered twice, which the kit reports as a route conflict.
    const c = diagramPorts<Rect>({ participants: PARTICIPANTS });
    const tuples = c.bindings!.map((b) => `${b.spec.kind}:${String(targetOf(b.spec))}`);
    expect(new Set(tuples).size).toBe(tuples.length);
    expect(c.actions!.every((a) => a.defaultBinding === undefined)).toBe(true);
  });

  it('is ambient — a port is grabbable whatever tool is active', () => {
    const c = diagramPorts<Rect>({ participants: PARTICIPANTS });
    expect(c.eligibility).toEqual({ claimed: true });
  });

  it('carries the port layer as a registered layer, never as a painted overlay', () => {
    // An overlay is painted and never hit-tested, so a port there would be
    // drawn and not grabbable.
    const c = diagramPorts<Rect>({ participants: PARTICIPANTS });
    expect(c.overlay).toBeUndefined();
    expect(c.layers?.map((l) => l.id)).toEqual([PORT_LAYER_ID]);
  });
});

describe('diagramWaypoints', () => {
  const bundle = () => diagramWaypoints<Rect>({ participants: PARTICIPANTS, selected: () => [] });

  it('binds the drag, the double-click, and the claim to the route handles', () => {
    const contribution = bundle();
    const onHandles = contribution.bindings!.filter((b) => targetOf(b.spec) === `affordance:${WAYPOINT_AFFORDANCE_KIND}`);
    expect(onHandles.map((b) => `${b.spec.kind}>${b.actionId}`).sort()).toEqual([
      `click>${GRAB_WAYPOINT_ACTION_ID}`,
      `doubleClick>${REMOVE_WAYPOINT_ACTION_ID}`,
      `drag>${ROUTE_EDIT_ACTION_ID}`,
      `pointerDown>${GRAB_WAYPOINT_ACTION_ID}`,
    ]);
  });

  it('carries the reset-route command', () => {
    expect(bundle().actions!.map((a) => a.id)).toContain(RESET_ROUTE_ACTION_ID);
  });

  it('carries the line jumps command', () => {
    expect(bundle().actions!.map((a) => a.id)).toContain(SET_HOPS_ACTION_ID);
  });

  it('carries the layer the handles are composed into', () => {
    expect(bundle().layers?.map((l) => l.id)).toEqual([WAYPOINT_LAYER_ID]);
  });
});

describe('diagramLabelDrag', () => {
  it("applies a click on a label to its edge's selection with the click's modifiers", () => {
    const contribution = diagramLabelDrag({ scene: createScene({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] }), selected: () => [] });
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

  it("ranges the way the select tool does, through the canvas's selectRange inside the entered group", () => {
    const contribution = diagramLabelDrag({ scene: createScene({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] }), selected: () => [] });
    const action = contribution.actions!.find((a) => a.id === SELECT_LABEL_EDGE_ACTION_ID)!;
    if (action.invoker?.timing !== 'immediate') throw new Error('expected an immediate invoker');
    const applyClick = vi.fn();
    const between = () => ['xy', 'ab'];
    const at = vi.fn(() => between);
    const mods = { alt: false, shift: true, meta: false, ctrl: false };
    const payload = { targetId: 'ab/label', labelId: 'ab/label', edgeId: 'ab' };
    const deps = { selection: { applyClick }, selectRange: { at }, enteredGroup: { get: () => 'lane' } };
    action.invoker.run(deps as unknown as ActionDeps, { affordance: { payload }, mods });
    expect(at).toHaveBeenCalledWith('lane');
    expect(applyClick).toHaveBeenCalledWith('ab', mods, between);
    expect((action as { requires?: string[] }).requires).toEqual(['selection', 'enteredGroup', 'selectRange']);
  });
});
