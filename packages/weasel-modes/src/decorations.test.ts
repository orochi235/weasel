import { describe, it, expect, vi } from 'vitest';
import { createModeDecorations } from './decorations';
import { createModeRegistry } from './registry';
import { DEFAULT_MODES } from './presets/default';

describe('createModeDecorations', () => {
  it('returns no draw commands when no painter is registered for the active mode', () => {
    const registry = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    const d = createModeDecorations({ registry });

    const cmds = d.paint();
    expect(cmds).toEqual([]);
  });

  it('returns painter output for the active mode', () => {
    const registry = createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' });
    const d = createModeDecorations({ registry });

    const painter = vi.fn().mockReturnValue([{ kind: 'path', d: 'M0 0', fill: '#000' } as never]);
    d.register('path-edit', painter);

    const cmds = d.paint();
    expect(painter).toHaveBeenCalledTimes(1);
    expect(cmds.length).toBe(1);
  });

  it('switching modes swaps which painter is invoked', () => {
    const registry = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    const d = createModeDecorations({ registry });

    const pathEditPainter = vi.fn().mockReturnValue([]);
    const isolationPainter = vi.fn().mockReturnValue([]);
    d.register('path-edit', pathEditPainter);
    d.register('isolation', isolationPainter);

    registry.setMode('path-edit');
    d.paint();
    expect(pathEditPainter).toHaveBeenCalledTimes(1);
    expect(isolationPainter).not.toHaveBeenCalled();

    registry.setMode('isolation');
    d.paint();
    expect(isolationPainter).toHaveBeenCalledTimes(1);
  });

  it('version() bumps when the active mode changes', () => {
    const registry = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    const d = createModeDecorations({ registry });

    const v0 = d.version();
    registry.setMode('path-edit');
    expect(d.version()).toBeGreaterThan(v0);
  });
});
