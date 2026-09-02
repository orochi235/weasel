import { describe, expect, it } from 'vitest';
import type { Track } from '@weasel-js/core';
import { buildLanes, trackAtPath } from './lanes';

const sampled = (label: string, values: unknown[]): Track => ({
  kind: 'sampled',
  label,
  keys: values.map((value, i) => ({ t: i * 100, value })),
  onTick: () => {},
}) as Track;

const events = (label: string): Track => ({
  kind: 'event',
  label,
  events: [{ t: 50, fire: () => {} }],
}) as Track;

const nested = (label: string, at: number, children: Track[]): Track => ({
  kind: 'timeline',
  label,
  at,
  timeline: { tracks: children },
}) as Track;

describe('buildLanes', () => {
  it('makes one row per top-level track, in order', () => {
    const rows = buildLanes([sampled('x', [0, 1]), events('step')], new Set());
    expect(rows.map((r) => r.label)).toEqual(['x', 'step']);
    expect(rows.map((r) => r.depth)).toEqual([0, 0]);
  });

  it('labels an unlabelled track by its kind and index', () => {
    const t = { kind: 'sampled', keys: [], onTick: () => {} } as unknown as Track;
    expect(buildLanes([t], new Set())[0].label).toBe('sampled 0');
  });

  it('gives each row a stable path-derived key', () => {
    const rows = buildLanes([sampled('x', [0]), sampled('y', [0])], new Set());
    expect(rows.map((r) => r.key)).toEqual(['0', '1']);
  });

  it('hides a collapsed nested timeline’s children', () => {
    const rows = buildLanes([nested('blink', 200, [sampled('o', [0, 1])])], new Set());
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('timeline');
  });

  it('shows an expanded nested timeline’s children one level deeper', () => {
    const rows = buildLanes([nested('blink', 200, [sampled('o', [0, 1])])], new Set(['0']));
    expect(rows.map((r) => r.label)).toEqual(['blink', 'o']);
    expect(rows.map((r) => r.depth)).toEqual([0, 1]);
    expect(rows.map((r) => r.key)).toEqual(['0', '0.0']);
  });

  it('accumulates the nested offset onto a child row', () => {
    const rows = buildLanes(
      [nested('outer', 200, [nested('inner', 50, [sampled('o', [0, 1])])])],
      new Set(['0', '0.0']),
    );
    expect(rows.map((r) => r.offset)).toEqual([0, 200, 250]);
  });

  it('marks an all-numeric sampled track as numeric', () => {
    expect(buildLanes([sampled('x', [0, 10])], new Set())[0].numeric).toBe(true);
  });

  it('does not mark a track with a non-numeric value as numeric', () => {
    expect(buildLanes([sampled('p', [{ x: 0 }, { x: 1 }])], new Set())[0].numeric).toBe(false);
  });

  it('does not mark an empty sampled track as numeric', () => {
    expect(buildLanes([sampled('empty', [])], new Set())[0].numeric).toBe(false);
  });

  it('never marks an event or nested row as numeric', () => {
    const rows = buildLanes([events('step'), nested('n', 0, [])], new Set());
    expect(rows.map((r) => r.numeric)).toEqual([false, false]);
  });
});

describe('trackAtPath', () => {
  it('finds a top-level track', () => {
    const tracks = [sampled('x', [0]), events('step')];
    expect(trackAtPath(tracks, [1])).toBe(tracks[1]);
  });

  it('descends into a nested timeline', () => {
    const child = sampled('o', [0]);
    const tracks = [nested('blink', 0, [child])];
    expect(trackAtPath(tracks, [0, 0])).toBe(child);
  });

  it('returns undefined for a path that does not exist', () => {
    expect(trackAtPath([sampled('x', [0])], [4])).toBeUndefined();
    expect(trackAtPath([sampled('x', [0])], [0, 0])).toBeUndefined();
  });
});
