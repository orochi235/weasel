import { describe, it, expect } from 'vitest';
import { mergeContributions } from '@weasel-js/core';
import { CONNECT_ACTION_ID, createDiagramContribution } from './contribution';
import { PORT_AFFORDANCE_KIND } from './portAffordance';

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

  it('composes with other bundles', () => {
    const c = createDiagramContribution<Rect>({ participants: PARTICIPANTS });
    expect(mergeContributions([c], [])).toHaveLength(1);
  });

  it('declares no overlay — a painted layer is never hit-tested', () => {
    // The port layer has to be attached with `registerLayer`. Shipping it as
    // `Contribution.overlay` would paint the ports and make none of them
    // grabbable, which is the failure this arc exists to fix.
    const c = createDiagramContribution<Rect>({ participants: PARTICIPANTS });
    expect(c.overlay).toBeUndefined();
  });
});
