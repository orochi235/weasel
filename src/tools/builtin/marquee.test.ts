/**
 * Tests for `marqueeDrawCommands` — the helper that turns world-space
 * insert bounds into screen-space dash-stroke draw commands for tool
 * overlays. Two surfaces verified: (1) world→screen projection (identity
 * view passes bounds through; pan/scale view transforms correctly),
 * (2) style fallback (caller's overrides win over defaults).
 */
import { describe, it, expect } from 'vitest';
import { marqueeDrawCommands } from './marquee';

const DEFAULTS = {
  fill: '#00000020',
  stroke: '#888888',
  dash: [4, 2],
  lineWidth: 1,
};

describe('marqueeDrawCommands', () => {
  it('identity view passes world bounds through to screen-space rect', () => {
    const cmds = marqueeDrawCommands(
      { x: 0, y: 0, scale: 1 },
      { x: 10, y: 20, width: 30, height: 40 },
      undefined,
      DEFAULTS,
    );
    expect(cmds).toHaveLength(1);
    const c = cmds[0];
    expect(c.kind).toBe('path');
    if (c.kind !== 'path' || c.path.kind !== 'rect') throw new Error('unreachable');
    expect(c.path).toEqual({ kind: 'rect', x: 10, y: 20, width: 30, height: 40 });
  });

  it('pan moves the marquee in the opposite direction of view.x/y', () => {
    // view.x=5 means "world point 5 is at screen 0", so a world rect at
    // world.x=10 sits at screen.x = (10 - 5) * scale = 5.
    const cmds = marqueeDrawCommands(
      { x: 5, y: 10, scale: 1 },
      { x: 10, y: 20, width: 4, height: 4 },
      undefined,
      DEFAULTS,
    );
    if (cmds[0].kind !== 'path' || cmds[0].path.kind !== 'rect') throw new Error('unreachable');
    expect(cmds[0].path).toEqual({ kind: 'rect', x: 5, y: 10, width: 4, height: 4 });
  });

  it('scale multiplies bounds dimensions', () => {
    const cmds = marqueeDrawCommands(
      { x: 0, y: 0, scale: 2 },
      { x: 10, y: 20, width: 4, height: 6 },
      undefined,
      DEFAULTS,
    );
    if (cmds[0].kind !== 'path' || cmds[0].path.kind !== 'rect') throw new Error('unreachable');
    expect(cmds[0].path).toEqual({ kind: 'rect', x: 20, y: 40, width: 8, height: 12 });
  });

  it('caller style fields override matching defaults', () => {
    const cmds = marqueeDrawCommands(
      { x: 0, y: 0, scale: 1 },
      { x: 0, y: 0, width: 1, height: 1 },
      { fill: '#ff0000', stroke: '#00ff00', dash: [1, 1], lineWidth: 3 },
      DEFAULTS,
    );
    const c = cmds[0];
    if (c.kind !== 'path') throw new Error('unreachable');
    expect(c.fill).toEqual({ color: '#ff0000' });
    expect(c.stroke?.paint).toEqual({ color: '#00ff00' });
    expect(c.stroke?.dash).toEqual([1, 1]);
    expect(c.stroke?.width).toBe(3);
  });

  it('partial caller style merges with defaults (unspecified fields fall through)', () => {
    const cmds = marqueeDrawCommands(
      { x: 0, y: 0, scale: 1 },
      { x: 0, y: 0, width: 1, height: 1 },
      { fill: '#ff0000' }, // only fill specified
      DEFAULTS,
    );
    const c = cmds[0];
    if (c.kind !== 'path') throw new Error('unreachable');
    expect(c.fill).toEqual({ color: '#ff0000' });
    expect(c.stroke?.paint).toEqual({ color: DEFAULTS.stroke });
    expect(c.stroke?.dash).toEqual(DEFAULTS.dash);
    expect(c.stroke?.width).toBe(DEFAULTS.lineWidth);
  });

  it('omitted style uses every default', () => {
    const cmds = marqueeDrawCommands(
      { x: 0, y: 0, scale: 1 },
      { x: 0, y: 0, width: 1, height: 1 },
      undefined,
      DEFAULTS,
    );
    const c = cmds[0];
    if (c.kind !== 'path') throw new Error('unreachable');
    expect(c.fill).toEqual({ color: DEFAULTS.fill });
    expect(c.stroke?.paint).toEqual({ color: DEFAULTS.stroke });
    expect(c.stroke?.dash).toEqual(DEFAULTS.dash);
    expect(c.stroke?.width).toBe(DEFAULTS.lineWidth);
  });
});
