import { describe, it, expect } from 'vitest';
import { escapeAction } from './escape';

describe('escapeAction (descriptor)', () => {
  it('id="escape", label="Escape"', () => {
    expect(escapeAction.id).toBe('escape');
    expect(escapeAction.label).toBe('Escape');
  });

  it('defaultBinding = Escape, gated to [*:initial]', () => {
    expect(escapeAction.defaultBinding).toEqual({
      kind: 'key',
      key: 'Escape',
      phase: [{ channel: '*', phase: 'initial' }],
    });
  });

  it('invoker.timing = "immediate"', () => {
    expect(escapeAction.invoker?.timing).toBe('immediate');
  });

  describe('enabled gate', () => {
    it('returns true when no editAnchors dep is registered', () => {
      expect(escapeAction.enabled?.({})).toBe(true);
    });

    it('returns true when editAnchors is present but editingId is empty', () => {
      const editAnchors = { editingId: '', setEditingId: () => {}, getEditablePath: () => null, getStorageKind: () => null, getNodeShape: () => null, applyEdit: () => {} };
      expect(escapeAction.enabled?.({ editAnchors } as never)).toBe(true);
    });

    it('returns a disabled reason while path-edit mode is active (defers to exitPathEdit)', () => {
      const editAnchors = { editingId: 'p1', setEditingId: () => {}, getEditablePath: () => null, getStorageKind: () => null, getNodeShape: () => null, applyEdit: () => {} };
      expect(escapeAction.enabled?.({ editAnchors } as never)).not.toBe(true);
    });
  });
});
