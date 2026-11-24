import { describe, expect, it } from 'vitest';
import { mat3 } from '@weasel-js/geom';
import type { DrawCommand } from '../DrawCommand';
import { commandsBounds } from './contentBounds';

const PAGE = { width: 200, height: 100 };
const square: DrawCommand = {
  kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { paint: { color: '#000' } },
};

describe('commandsBounds for a group with its own composite', () => {
  it('spans the page, or the group clip, for an operator that clears what the group leaves empty', () => {
    const clearing: DrawCommand = { kind: 'group', composite: 'destination-out', children: [square] };
    expect(commandsBounds([clearing], mat3.identity(), PAGE)).toEqual({ x: 0, y: 0, width: 11, height: 11 });
    const scaling: DrawCommand = { kind: 'group', composite: 'source-in', children: [square] };
    expect(commandsBounds([scaling], mat3.identity(), PAGE)).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    const clipped: DrawCommand = { ...scaling, clip: { kind: 'rect', x: 0, y: 0, width: 50, height: 40 } };
    expect(commandsBounds([clipped], mat3.identity(), PAGE)).toMatchObject({ width: 51, height: 41 });
  });
});
