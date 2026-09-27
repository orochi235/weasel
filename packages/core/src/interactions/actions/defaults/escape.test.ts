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
    const selected = { get: () => ['a'], set: () => {} };
    const empty = { get: () => [], set: () => {} };

    it('returns true with a selection and no editAnchors dep registered', () => {
      expect(escapeAction.enabled?.({ selection: selected } as never)).toBe(true);
    });

    it('returns true with a selection when editAnchors is present but editingId is empty', () => {
      const editAnchors = { editingId: '', setEditingId: () => {}, getEditablePath: () => null, getStorageKind: () => null, getNodeShape: () => null, applyEdit: () => {} };
      expect(escapeAction.enabled?.({ selection: selected, editAnchors } as never)).toBe(true);
    });

    // Nothing to clear, so the press falls through to `tool.resetToDefault`.
    it('returns a disabled reason when nothing is selected', () => {
      expect(escapeAction.enabled?.({ selection: empty } as never)).not.toBe(true);
      expect(escapeAction.enabled?.({})).not.toBe(true);
    });

    it('returns a disabled reason while path-edit mode is active (defers to exitPathEdit)', () => {
      const editAnchors = { editingId: 'p1', setEditingId: () => {}, getEditablePath: () => null, getStorageKind: () => null, getNodeShape: () => null, applyEdit: () => {} };
      expect(escapeAction.enabled?.({ editAnchors } as never)).not.toBe(true);
    });
  });
});
