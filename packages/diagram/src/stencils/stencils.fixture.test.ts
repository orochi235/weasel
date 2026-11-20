import { describe, expect, it, vi } from 'vitest';
import type { StencilGroup } from '../diagramTypes/types';
import { icon } from '../icons.gen';
import { expectStencilsBuild } from './stencils.fixture';

const group = (stencil: StencilGroup['stencils'][number]): StencilGroup => ({ id: 'probe', label: 'Probe', stencils: [stencil] });

describe('expectStencilsBuild', () => {
  it('counts a header row, and its aside, as text nodes', () => {
    expectStencilsBuild(group({
      id: 'table', label: 'Table', outline: 'rect', size: { width: 160, height: 80 }, verticalAlign: 'top', icon: icon('shape:diamond'),
      rows: [{ kind: 'header', text: 'Table', aside: 'T' }, { kind: 'field', label: 'id', value: 'int' }],
    }));
  });

  it('restores console.warn when an assertion fails', () => {
    const before = console.warn;
    expect(() => expectStencilsBuild(group({
      id: 'sized', label: 'Sized', outline: 'rect', size: { width: 10, height: 10 }, icon: icon('shape:diamond'),
      rows: [{ kind: 'label', text: 'Far too long for its box' }],
    }))).toThrow();
    expect(vi.isMockFunction(console.warn)).toBe(false);
    expect(console.warn).toBe(before);
  });
});
