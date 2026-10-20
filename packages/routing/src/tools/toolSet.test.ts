import { describe, expect, it } from 'vitest';
import { isToolSet, toolIdsOf, toolSet, toolSetHas, withoutTools } from './toolSet';

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
});
