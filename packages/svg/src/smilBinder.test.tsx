import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { bindClip } from '@weasel-js/animator';
import { useAnimator } from '@weasel-js/animator/react';
import { boundsOfPath, createScene, nodeAsShown, type NodeId, type Path, type PoseComposition, type RectPose } from '@weasel-js/core';
import { parseSvg, svgClipBinder, svgDraftSpecs, svgNodesToKitDrafts, type SvgDraftPose } from './index';

type Data = Record<string, unknown>;

function play(svg: string) {
  const cbs: ((t: number) => void)[] = [];
  let clock = 0;
  const { result } = renderHook(() => useAnimator({
    requestFrame: (cb) => { cbs.push(cb); return cbs.length; },
    cancelFrame: () => {},
    now: () => clock,
  }));
  const parsed = parseSvg(svg);
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  let n = 0;
  const drafts = svgNodesToKitDrafts(parsed, () => `n${++n}`);
  const specs = svgDraftSpecs(drafts, { layer: 'main', composition: scene.composition as PoseComposition<SvgDraftPose> });
  for (const spec of specs) scene.add(spec as never);
  const binder = svgClipBinder(scene as never, parsed, drafts);
  const live = bindClip(parsed.clip!, binder);
  const timeline = result.current.timeline({ ...live, autoplay: false });
  const at = (ms: number) => {
    act(() => { timeline.seek(ms); });
    clock += 16;
    act(() => { for (const cb of cbs.splice(0)) cb(clock); });
  };
  const idOf = (source: string) => drafts.find((d) => d.source === source)!.id as NodeId;
  const shown = (source: string) => nodeAsShown(scene.overrides, scene.get(idOf(source))!).data as Data;
  return { scene, at, idOf, shown, binder };
}

const doc = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
const fillOf = (d: Data) => (d.fill as { paint: { color: string; opacity?: number } }).paint;
const strokeOf = (d: Data) => d.stroke as { width: number; paint: { opacity?: number } };

describe('svgClipBinder', () => {
  it('fades a group in from 0 over every leaf under it, and leaves it where the clip ends', () => {
    const { at, shown, scene, idOf } = play(doc(`
      <g id="g" opacity="0">
        <rect id="a" width="10" height="10" fill="#ff0000" stroke="#000" stroke-width="2"/>
        <rect id="b" x="20" width="10" height="10" fill="#00ff00" fill-opacity="0.5"/>
        <animate attributeName="opacity" from="0" to="1" dur="1s" fill="freeze"/>
      </g>`));
    at(500);
    expect(fillOf(shown('a')).opacity).toBeCloseTo(0.5, 5);
    expect(strokeOf(shown('a')).paint.opacity).toBeCloseTo(0.5, 5);
    expect(fillOf(shown('b')).opacity).toBeCloseTo(0.25, 5);
    at(1000);
    expect(fillOf(scene.get(idOf('b'))!.data as Data).opacity).toBeCloseTo(0.5, 5);
  });

  it('moves a shape\'s fill color, stroke width and fill opacity', () => {
    const { at, shown } = play(doc(`
      <rect id="r" width="10" height="10" fill="#ff0000" stroke="#000" stroke-width="2">
        <animate attributeName="fill" from="#ff0000" to="#0000ff" dur="1s"/>
        <animate attributeName="stroke-width" from="2" to="4" dur="1s"/>
        <animate attributeName="fill-opacity" from="0" to="1" dur="1s"/>
      </rect>`));
    at(500);
    const d = shown('r');
    expect(fillOf(d).color).toBe('#800080');
    expect(fillOf(d).opacity).toBeCloseTo(0.5, 5);
    expect(strokeOf(d).width).toBeCloseTo(3, 5);
  });

  it('relowers an animated radius and commits the path and its box together', () => {
    const { at, scene, idOf } = play(doc(`
      <circle id="c" cx="10" cy="10" r="5" fill="#000">
        <animate attributeName="r" from="5" to="10" dur="1s" fill="freeze"/>
      </circle>`));
    at(500);
    const id = idOf('c');
    const drawn = scene.overrides.read(id)!.path!;
    expect(boundsOfPath(drawn).width).toBeCloseTo(15, 3);
    at(1000);
    const node = scene.get(id)!;
    expect(boundsOfPath((node.data as { path: Path }).path).width).toBeCloseTo(20, 3);
    expect(node.pose.width).toBeCloseTo(20, 3);
    expect(scene.overrides.read(id)?.path).toBeUndefined();
  });

  it('interpolates a d whose values share their commands', () => {
    const { at, scene, idOf } = play(doc(`
      <path id="p" d="M0 0 L10 0 L10 10 Z" fill="#000">
        <animate attributeName="d" values="M0 0 L10 0 L10 10 Z;M0 0 L20 0 L20 20 Z" dur="1s"/>
      </path>`));
    at(500);
    expect(boundsOfPath(scene.overrides.read(idOf('p'))!.path!).width).toBeCloseTo(15, 3);
  });

  it('turns a shape about the center its rotate names', () => {
    const { at, scene, idOf } = play(doc(`
      <rect id="r" width="10" height="10">
        <animateTransform attributeName="transform" type="rotate" from="0 5 5" to="90 5 5" dur="1s"/>
      </rect>`));
    at(500);
    const pose = scene.overrides.read(idOf('r'))!.pose as RectPose & { transform: number[] };
    expect(pose.x).toBeCloseTo(0, 5);
    expect(pose.transform[0]).toBeCloseTo(Math.SQRT1_2, 5);
    expect(pose.transform[1]).toBeCloseTo(Math.SQRT1_2, 5);
  });

  it('replaces an element\'s own transform, and moves every shape under a group', () => {
    const { at, scene, idOf } = play(doc(`
      <g id="g" transform="translate(5 0)">
        <rect id="a" width="10" height="10"/>
        <rect id="b" y="20" width="10" height="10"/>
        <animateTransform attributeName="transform" type="translate" from="0 0" to="10 0" dur="1s" fill="freeze"/>
      </g>`));
    // Poses are in the group's frame; the file draws each shape at its rest pose when the translate is 5.
    const rest = { a: scene.get(idOf('a'))!.pose.x, b: scene.get(idOf('b'))!.pose.x };
    at(100);
    expect((scene.overrides.read(idOf('a'))!.pose as RectPose).x).toBeCloseTo(rest.a - 4, 5);
    expect((scene.overrides.read(idOf('b'))!.pose as RectPose).x).toBeCloseTo(rest.b - 4, 5);
    at(1000);
    expect(scene.get(idOf('b'))!.pose.x).toBeCloseTo(rest.b + 5, 5);
  });
});
