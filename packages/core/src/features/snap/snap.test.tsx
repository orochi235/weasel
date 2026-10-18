/** `deps.snap.begin` under `<SceneCanvas>`: which sources a session asks, and in what order. */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { useEffect, type ReactNode } from 'react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useDepRegistry } from '@weasel-js/routing/react';
import { SceneCanvas } from 'canvas/SceneCanvas';
import type { FeaturePreset } from 'canvas/SceneCanvas/features';
import { pathFromD } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/types';
import type { SnapDep } from 'interactions/actions/snapDep';
import { useSnapSource } from './registry';
import type { SnapSource } from './types';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
});

const FREE = { suspend: false, constrain: false };

function pointAt(id: string, at: { x: number; y: number }, asked: string[]): SnapSource {
  return {
    id, roles: ['pointer'],
    *collect(q) {
      asked.push(id);
      for (const p of q.probes) yield { probe: p.id, locus: { at, dirs: [] } };
    },
  };
}

function Grab({ into }: { into: { snap?: SnapDep } }) {
  const deps = useDepRegistry();
  useEffect(() => { into.snap = deps.get('snap') as SnapDep; });
  return null;
}

function Contribute({ source }: { source: SnapSource }) {
  useSnapSource(source);
  return null;
}

function mount(children: ReactNode, props: Record<string, unknown>, paths: readonly string[] = []) {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  for (const d of paths) scene.add({ kind: 'leaf', layer: 'main', data: {}, pose: pathFromD(d) } as never);
  const got: { snap?: SnapDep } = {};
  render(
    <SceneCanvas scene={scene} width={200} height={200} {...props}>
      <Grab into={got} />
      {children}
    </SceneCanvas>,
  );
  return got.snap!;
}

describe('<SceneCanvas snap>', () => {
  it('gives deps.snap.begin the sources the prop names', () => {
    const asked: string[] = [];
    const snap = mount(null, { snap: { sources: [pointAt('prop', { x: 40, y: 40 }, asked)] } });
    const s = snap.begin({ gesture: 'point', press: { x: 0, y: 0 } });
    expect(s.at({ x: 38, y: 43 }, FREE).point).toEqual({ x: expect.closeTo(40, 9), y: expect.closeTo(40, 9) });
    expect(s.at({ x: 60, y: 60 }, FREE).point).toEqual({ x: 60, y: 60 });
    expect(asked).toEqual(['prop', 'prop']);
  });

  it('asks the prop\'s sources, then a preset\'s snapSources, then useSnapSource\'s', () => {
    const asked: string[] = [];
    const preset: FeaturePreset = { id: 'snaps', snapSources: [pointAt('preset', { x: 0, y: 0 }, asked)] };
    const snap = mount(<Contribute source={pointAt('hook', { x: 0, y: 0 }, asked)} />, {
      snap: { sources: [pointAt('prop', { x: 0, y: 0 }, asked)] },
      features: [preset],
    });
    snap.begin({ gesture: 'point', press: { x: 0, y: 0 } }).at({ x: 1, y: 1 }, FREE);
    expect(asked).toEqual(['prop', 'preset', 'hook']);
  });

  it('takes its reach from the prop', () => {
    const snap = mount(null, { snap: { sources: [pointAt('prop', { x: 40, y: 40 }, [])], reachPx: 2 } });
    const s = snap.begin({ gesture: 'point', press: { x: 0, y: 0 } });
    expect(s.at({ x: 38, y: 43 }, FREE).point).toEqual({ x: 38, y: 43 });
  });

  it('keeps one source per id: the last one listed', () => {
    const asked: string[] = [];
    const preset: FeaturePreset = { id: 'snaps', snapSources: [pointAt('shared', { x: 0, y: 0 }, asked)] };
    const hook = { ...pointAt('shared', { x: 0, y: 0 }, asked), collect: (q: Parameters<SnapSource['collect']>[0]) => {
      asked.push('hook');
      return pointAt('shared', { x: 0, y: 0 }, []).collect(q);
    } };
    const snap = mount(<Contribute source={hook} />, { features: [preset] });
    snap.begin({ gesture: 'point', press: { x: 0, y: 0 } }).at({ x: 1, y: 1 }, FREE);
    expect(asked).toEqual(['hook']);
  });

  describe('default sources', () => {
    const DEG = Math.PI / 180;
    const rotate = (snap: SnapDep) =>
      snap.begin({ gesture: 'rotate', press: { x: 100, y: 0 }, pivot: { x: 0, y: 0 } });
    const fortyFive: SnapSource = {
      id: 'rotation', roles: [], gestures: ['rotate'], collect: () => [],
      *angles() { yield { angle: 45 * DEG }; },
    };

    it('snaps a rotate to a quarter turn with no source named', () => {
      expect(rotate(mount(null, {})).angle(88 * DEG, FREE).theta).toBeCloseTo(90 * DEG, 9);
    });

    it("lands a pen click on another path's anchor within 8px, unless `omit` names 'path-snap'", () => {
      const click = (props: Record<string, unknown>) => mount(null, props, ['M0 0 L100 100'])
        .begin({ gesture: 'point', press: { x: 103, y: 96 } }).at({ x: 103, y: 96 }, FREE).point;
      expect(click({})).toEqual({ x: expect.closeTo(100, 9), y: expect.closeTo(100, 9) });
      expect(click({ snap: { omit: ['path-snap'] } })).toEqual({ x: 103, y: 96 });
    });

    it('leaves out a default source `omit` names', () => {
      const snap = mount(null, { snap: { omit: ['rotation'] } });
      expect(rotate(snap).angle(88 * DEG, FREE).theta).toBeCloseTo(88 * DEG, 9);
    });

    it('replaces a default source with a consumer source of the same id', () => {
      const s = rotate(mount(null, { snap: { sources: [fortyFive] } }));
      expect(s.angle(88 * DEG, FREE).theta).toBeCloseTo(88 * DEG, 9);
      expect(s.angle(44 * DEG, FREE).theta).toBeCloseTo(45 * DEG, 9);
    });

    it('replaces a default source with one useSnapSource adds', () => {
      const s = rotate(mount(<Contribute source={fortyFive} />, {}));
      expect(s.angle(88 * DEG, FREE).theta).toBeCloseTo(88 * DEG, 9);
    });
  });
});
