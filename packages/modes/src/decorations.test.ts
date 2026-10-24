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

  it('a released painter stops painting, and subscribers hear of it', () => {
    const registry = createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' });
    const d = createModeDecorations({ registry });
    const release = d.register('path-edit', () => [{ kind: 'path' } as never]);
    const listener = vi.fn();
    d.subscribe(listener);
    const before = d.getVersion();

    release();
    expect(d.paint()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(d.getVersion()).toBeGreaterThan(before);
  });

  it('a release leaves the painter that replaced its own alone', () => {
    const registry = createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' });
    const d = createModeDecorations({ registry });
    const release = d.register('path-edit', () => []);
    d.register('path-edit', () => [{ kind: 'path' } as never]);

    release();
    expect(d.paint()).toHaveLength(1);
  });

  it('switching modes swaps which painter is invoked', () => {
    const registry = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    const d = createModeDecorations({ registry });

    const pathEditPainter = vi.fn().mockReturnValue([]);
    const textEditPainter = vi.fn().mockReturnValue([]);
    d.register('path-edit', pathEditPainter);
    d.register('text-edit', textEditPainter);

    registry.setMode('path-edit');
    d.paint();
    expect(pathEditPainter).toHaveBeenCalledTimes(1);
    expect(textEditPainter).not.toHaveBeenCalled();

    registry.setMode('text-edit');
    d.paint();
    expect(textEditPainter).toHaveBeenCalledTimes(1);
  });

  it('getVersion() bumps when the active mode changes', () => {
    const registry = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    const d = createModeDecorations({ registry });

    const v0 = d.getVersion();
    registry.setMode('path-edit');
    expect(d.getVersion()).toBeGreaterThan(v0);
  });

  it('notifies subscribers on a mode switch and on registration, and not after unsubscribing', () => {
    const registry = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    const d = createModeDecorations({ registry });
    const listener = vi.fn();
    const off = d.subscribe(listener);
    registry.setMode('path-edit');
    d.register('path-edit', () => []);
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    registry.setMode('normal');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
