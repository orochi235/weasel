import { describe, expect, it } from 'vitest';
import type { ClipSampledTrack } from '@weasel-js/animator';
import { parseSvg } from './index';
import { clockValue, timeList } from './smilTime';

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${body}</svg>`;
const read = (body: string) => {
  const result = parseSvg(svg(body));
  return { ...result, tracks: (result.clip?.tracks ?? []) as ClipSampledTrack[] };
};
const keys = (t: ClipSampledTrack) => t.keys.map((k) => [k.t, k.value]);

describe('SMIL clock values', () => {
  it('reads full and partial clocks, and counts in each unit', () => {
    expect(['02:30:03', '01:02.5', '3.2h', '45min', '30s', '5ms', '12.467'].map(clockValue))
      .toEqual([9_003_000, 62_500, 11_520_000, 2_700_000, 30_000, 5, 12_467]);
    expect(clockValue('soon')).toBeNull();
  });

  it('reads begin lists of offsets, syncbases, and what it has no clock for', () => {
    expect(timeList('1s; -0.5s; a.end+2s; b\\.c.begin; click')).toEqual([
      { kind: 'offset', ms: 1000 }, { kind: 'offset', ms: -500 },
      { kind: 'sync', id: 'a', edge: 'end', ms: 2000 }, { kind: 'sync', id: 'b.c', edge: 'begin', ms: 0 },
      { kind: 'other', raw: 'click' },
    ]);
  });
});

describe('SMIL as a clip', () => {
  it('has none for a document without animation', () => {
    expect(parseSvg(svg('<rect width="1" height="1"/>')).clip).toBeUndefined();
  });

  it('names a track by its target node and attribute, giving an unnamed target an id', () => {
    const { nodes, tracks } = read('<circle r="5"><animate attributeName="r" from="5" to="9" dur="2s" fill="freeze"/></circle>');
    expect(nodes[0].id).toBe('smil-1');
    expect(tracks[0].target).toBe('smil-1.r');
    expect(keys(tracks[0])).toEqual([[0, 5], [2000, 9]]);
  });

  it('targets an href, and spreads values evenly or by keyTimes', () => {
    const { tracks } = read(
      '<rect id="r" width="1" height="1" opacity="1"/>'
      + '<animate href="#r" attributeName="opacity" values="0;1;0.5" dur="1s" fill="freeze"/>'
      + '<animate href="#r" attributeName="opacity" values="0;1;0.5" keyTimes="0;0.2;1" dur="1s" fill="freeze"/>',
    );
    expect(keys(tracks[0])).toEqual([[0, 0], [500, 1], [1000, 0.5]]);
    expect(keys(tracks[1])).toEqual([[0, 0], [200, 1], [1000, 0.5]]);
  });

  it('eases each segment by its keySpline, and steps a discrete one', () => {
    const { tracks } = read(
      '<rect id="r" width="1" height="1"/>'
      + '<animate href="#r" attributeName="x" values="0;10" calcMode="spline" keySplines="0.4 0 0.2 1" dur="1s" fill="freeze"/>'
      + '<animate href="#r" attributeName="x" values="0;10" calcMode="discrete" dur="1s" fill="freeze"/>',
    );
    expect(tracks[0].keys[1].easing).toEqual({ bezier: [0.4, 0, 0.2, 1] });
    expect(tracks[1].keys.map((k) => [k.t, k.value, k.easing])).toEqual([[0, 0, undefined], [500, 10, { steps: 1 }], [1000, 10, { steps: 1 }]]);
  });

  it('paces values by how far apart they are', () => {
    const { tracks } = read('<rect id="r" width="1" height="1"/><animate href="#r" attributeName="x" values="0;30;40" calcMode="paced" dur="4s" fill="freeze"/>');
    expect(keys(tracks[0])).toEqual([[0, 0], [3000, 30], [4000, 40]]);
  });

  it('reads colors as RGBA and lists as numbers', () => {
    const { tracks } = read(
      '<rect id="r" width="1" height="1"/>'
      + '<animate href="#r" attributeName="fill" from="#ff0000" to="#0000ff" dur="1s" fill="freeze"/>'
      + '<animate href="#r" attributeName="stroke-dasharray" from="0 10" to="10, 0" dur="1s" fill="freeze"/>',
    );
    expect(keys(tracks[0])).toEqual([[0, [1, 0, 0, 1]], [1000, [0, 0, 1, 1]]]);
    expect(keys(tracks[1])).toEqual([[0, [0, 10]], [1000, [10, 0]]]);
  });

  it('lays out a finite repeat as keys, cutting the last pass where it ends', () => {
    const { tracks } = read('<rect id="r" width="1" height="1"/><animate href="#r" attributeName="x" from="0" to="10" dur="1s" repeatCount="1.5" begin="2s" fill="freeze"/>');
    expect(keys(tracks[0])).toEqual([[2000, 0], [3000, 10], [3000, 0], [3500, 5]]);
  });

  it('goes back to the attribute at its end unless it freezes', () => {
    const { tracks } = read('<rect id="r" x="3" width="1" height="1"/><animate href="#r" attributeName="x" to="10" dur="1s"/>');
    expect(keys(tracks[0])).toEqual([[0, 3], [1000, 10], [1000, 3]]);
  });

  it('loops the clip when every animation repeats forever from 0 on one period', () => {
    const { clip } = read('<rect id="r" width="1" height="1"/><animate href="#r" attributeName="x" from="0" to="1" dur="2s" repeatCount="indefinite"/>');
    expect(clip).toMatchObject({ loop: true, duration: 2000 });
  });

  it('times one animation by another\'s end', () => {
    const { tracks } = read(
      '<rect id="r" width="1" height="1"/>'
      + '<animate id="a" href="#r" attributeName="x" from="0" to="1" dur="1s" begin="0.5s" fill="freeze"/>'
      + '<animate href="#r" attributeName="y" from="0" to="1" dur="1s" begin="a.end+250ms" fill="freeze"/>',
    );
    expect(keys(tracks[1])).toEqual([[1750, 0], [2750, 1]]);
  });

  it('reads animateTransform values to the type\'s arity under transform.<type>', () => {
    const { tracks } = read('<g id="g"><animateTransform attributeName="transform" type="rotate" from="0" to="90 5 5" dur="1s" fill="freeze"/></g>');
    expect(tracks[0].target).toBe('g.transform.rotate');
    expect(keys(tracks[0])).toEqual([[0, [0, 0, 0]], [1000, [90, 5, 5]]]);
  });

  it("reads an animation's fill as its timing, never as a paint", () => {
    const { warnings } = read('<path d="M0 0L5 0" stroke="#000"><animate attributeName="opacity" values="0;1" dur="1s" fill="freeze"/></path>');
    expect(warnings).toEqual([]);
  });

  it('steps a set, and a string that does not interpolate', () => {
    const { tracks } = read('<rect id="r" width="1" height="1"/><set href="#r" attributeName="visibility" to="hidden" begin="1s" dur="2s" fill="freeze"/>');
    expect(tracks[0].keys.map((k) => [k.t, k.value, k.easing])).toEqual([[1000, 'hidden', undefined], [3000, 'hidden', { steps: 1 }]]);
  });

  it('reports, and leaves out, what it has no clock or reading for', () => {
    const { tracks, warnings } = read(
      '<rect id="r" width="1" height="1"/>'
      + '<animate id="e" href="#r" attributeName="x" from="0" to="1" dur="1s" begin="click"/>'
      + '<animate href="#r" attributeName="x" from="0" to="1em" dur="1s"/>'
      + '<animateMotion href="#r" path="M0 0L1 1" dur="1s"/>',
    );
    expect(tracks).toHaveLength(0);
    expect(warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('"click"'), expect.stringContaining('cannot read'), expect.stringContaining('moves along a path'),
    ]));
  });
});
