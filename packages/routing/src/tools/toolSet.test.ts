import { describe, expect, it } from 'vitest';
import { isToolSet, toolIdsOf, toolSet, toolSetHas, toolStacksOf, withoutTools } from './toolSet';

const shapes = toolSet('shape', ['rect', 'ellipse']);
const draw = toolSet('draw', ['pen', 'pencil']);
const all = toolSet('all', ['select', shapes, draw, 'rect']);

describe('tool sets', () => {
  it('opens nested sets in place, keeping each id once at its first place', () => {
    expect(toolIdsOf([all])).toEqual(['select', 'rect', 'ellipse', 'pen', 'pencil']);
    expect(toolIdsOf(['hand', shapes, 'hand'])).toEqual(['hand', 'rect', 'ellipse']);
  });

  it('leaves out ids and whole sets', () => {
    const cut = withoutTools(all, draw, 'select');
    expect(toolIdsOf([cut])).toEqual(['rect', 'ellipse']);
    expect(toolIdsOf([all])).toContain('pen');
  });

  it('answers membership through nested sets', () => {
    expect(toolSetHas(all, 'pencil')).toBe(true);
    expect(toolSetHas(all, 'hand')).toBe(false);
  });

  it('tells a set from an id', () => {
    expect(isToolSet(shapes)).toBe(true);
    expect(isToolSet('rect')).toBe(false);
  });

  it('lists the stacked sets at any depth, opened, and keeps the mark through withoutTools', () => {
    const warps = toolSet('warp', ['distort', toolSet('bend', ['envelope'])], { stack: true });
    const reshape = toolSet('reshape', ['trim', toolSet('outer', [warps])]);
    expect(toolStacksOf([reshape, toolSet('pens', ['pen', 'pencil'], { stack: true })]))
      .toEqual([['distort', 'envelope'], ['pen', 'pencil']]);
    expect(toolStacksOf([shapes])).toEqual([]);
    expect(withoutTools(warps, 'envelope').stack).toBe(true);
    expect('stack' in withoutTools(shapes, 'rect')).toBe(false);
  });
});

