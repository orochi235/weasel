import { describe, it, expect } from 'vitest';
import { deselectAction } from './deselect';

describe('deselectAction (descriptor)', () => {
  it('id="deselect", label="Deselect"', () => {
    expect(deselectAction.id).toBe('deselect');
    expect(deselectAction.label).toBe('Deselect');
  });

  it('defaultBinding = Escape, gated to [*:initial]', () => {
    expect(deselectAction.defaultBinding).toEqual([{ spec: {
      kind: 'key',
      key: 'Escape',
      phase: [{ channel: '*', phase: 'initial' }],
    }, opts: { id: 'deselect.key' } }]);
  });

  it('invoker.timing = "immediate"', () => {
    expect(deselectAction.invoker?.timing).toBe('immediate');
  });

  describe('enabled gate', () => {
    const selected = { get: () => ['a'], set: () => {} };
    const empty = { get: () => [], set: () => {} };

    it('returns true with a selection and no editAnchors dep registered', () => {
      expect(deselectAction.enabled?.({ selection: selected } as never)).toBe(true);
    });

    it('returns true with a selection when editAnchors is present but editingId is empty', () => {
      const editAnchors = { editingId: '', setEditingId: () => {}, getEditablePath: () => null, getStorageKind: () => null, getNodeShape: () => null, applyEdit: () => {} };
      expect(deselectAction.enabled?.({ selection: selected, editAnchors } as never)).toBe(true);
    });

    // Nothing to clear, so the press falls through to `tool.resetToDefault`.
    it('returns a disabled reason when nothing is selected', () => {
      expect(deselectAction.enabled?.({ selection: empty } as never)).not.toBe(true);
      expect(deselectAction.enabled?.({})).not.toBe(true);
    });

    it('returns a disabled reason while path-edit mode is active (defers to leavePathEdit)', () => {
      const editAnchors = { editingId: 'p1', setEditingId: () => {}, getEditablePath: () => null, getStorageKind: () => null, getNodeShape: () => null, applyEdit: () => {} };
      expect(deselectAction.enabled?.({ editAnchors } as never)).not.toBe(true);
    });
  });
});
