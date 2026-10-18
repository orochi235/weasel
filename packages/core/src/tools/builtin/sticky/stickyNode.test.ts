import { describe, it, expect } from 'vitest';
import { STICKY_DEFAULTS, stickyData, stickyNodeFactory } from './stickyNode';
import { solid } from '../../../util/paint';

describe('stickyData', () => {
  it('is an empty text node on the default paper', () => {
    expect(stickyData({})).toEqual({
      text: '',
      background: STICKY_DEFAULTS.background,
      padding: STICKY_DEFAULTS.padding,
      style: STICKY_DEFAULTS.style,
      verticalAlign: STICKY_DEFAULTS.verticalAlign,
    });
  });

  it('takes every field the tool names over its default', () => {
    const background = { paint: solid('#a6e1ff') };
    const fill = { paint: solid('#202020') };
    expect(stickyData({ background, fill, padding: 4, style: { fontSize: 12 }, verticalAlign: 'top', text: 'x' })).toEqual({
      text: 'x', background, fill, padding: 4, style: { fontSize: 12 }, verticalAlign: 'top',
    });
  });

  it('carries none of the insert bookkeeping onto the node', () => {
    const data = stickyData({ kind: 'sticky', originMode: 'corner', size: { width: 1, height: 1 } } as never);
    expect(Object.keys(data).sort()).toEqual(['background', 'padding', 'style', 'text', 'verticalAlign']);
  });
});

describe('stickyNodeFactory', () => {
  it('mints the sticky data from the insert extras and leaves the pose to the dep', () => {
    const built = stickyNodeFactory({ x: 0, y: 0, width: 10, height: 10 }, { kind: 'sticky', padding: 3 });
    expect(built).toEqual({ data: stickyData({ padding: 3 }) });
  });
});
