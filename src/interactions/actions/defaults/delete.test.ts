/**
 * Tests for `deleteAction` descriptor.
 */
import { describe, it, expect } from 'vitest';
import { deleteAction } from './delete';

describe('deleteAction (descriptor)', () => {
  it('id="delete", label="Delete"', () => {
    expect(deleteAction.id).toBe('delete');
    expect(deleteAction.label).toBe('Delete');
  });

  it('gestureBinding = { kind: "key", key: ["Delete", "Backspace"] }', () => {
    expect(deleteAction.gestureBinding).toEqual({ kind: 'key', key: ['Delete', 'Backspace'] });
  });

  it('invoker.timing = "immediate"', () => {
    expect(deleteAction.invoker?.timing).toBe('immediate');
  });
});
