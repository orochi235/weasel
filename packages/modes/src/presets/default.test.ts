import { describe, it, expect } from 'vitest';
import { DEFAULT_MODES, defaultModeById } from './default';
import { shortcutOn } from '../modeDefinition';

describe('default mode preset', () => {
  it('includes the documented mode ids', () => {
    const ids = DEFAULT_MODES.map((m) => m.id).sort();
    expect(ids).toEqual(['crop', 'free-transform', 'normal', 'path-edit', 'text-edit']);
  });

  it('path-edit is soft, scoping, blue', () => {
    const m = defaultModeById('path-edit');
    expect(m.kind).toBe('soft');
    expect(m.scoping).toBe(true);
    expect(m.workspace?.tint).toBe('#3b82f6');
    expect(m.allows).toContain('edits-anchors');
  });

  it('free-transform is strict, non-scoping, amber, with commit/cancel shortcuts', () => {
    const m = defaultModeById('free-transform');
    expect(m.kind).toBe('strict');
    expect(m.scoping).toBe(false);
    expect(m.workspace?.tint).toBe('#f59e0b');
    expect(m.commit?.shortcut).toBeDefined();
    expect(m.cancel?.shortcut).toBeDefined();
  });

  it('free-transform is entered on Mod+Alt+T and abandoned on Escape', () => {
    const m = defaultModeById('free-transform');
    expect(m.entry?.shortcut).toBe('Mod+Alt+T');
    expect(m.cancel?.shortcut).toBe('Escape');
    expect(m.discard).toBeUndefined();
  });

  it('path-edit and text-edit discard on Cmd+Escape on a Mac, and on no key elsewhere', () => {
    for (const id of ['path-edit', 'text-edit']) {
      const discard = defaultModeById(id).discard?.shortcut;
      expect(shortcutOn(discard, true), id).toBe('Meta+Escape');
      expect(shortcutOn(discard, false), id).toBeUndefined();
      expect(shortcutOn(defaultModeById(id).exit?.shortcut, false), id).toBe('Escape');
    }
  });

  it('normal has no workspace tint', () => {
    const m = defaultModeById('normal');
    expect(m.workspace).toBeUndefined();
  });

  it('defaultModeById throws for unknown id', () => {
    expect(() => defaultModeById('nope')).toThrow();
  });
});

describe('DEFAULT_MODES display', () => {
  it('gives every shipped mode a label and a description', () => {
    for (const m of DEFAULT_MODES) {
      expect(m.label, m.id).toMatch(/\S/);
      expect(m.description, m.id).toMatch(/\S/);
    }
  });

  it('labels the modes the way the chrome names them', () => {
    expect(DEFAULT_MODES.map((m) => m.label)).toEqual([
      'Normal', 'Path Edit', 'Free Transform', 'Text Edit', 'Crop',
    ]);
  });
});
