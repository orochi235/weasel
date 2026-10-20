import { describe, it, expect } from 'vitest';
import { describeSelection } from './selectionSummary';

describe('describeSelection', () => {
  it('says nothing without a selection context', () => {
    expect(describeSelection(null)).toBeNull();
  });

  it('says so when nothing is selected', () => {
    expect(describeSelection({ selection: [] })).toBe('No selection');
  });

  it('names the kind when every selected node shares one, plural past one', () => {
    expect(describeSelection({ selection: ['a'], kinds: ['rect'] })).toBe('1 rect selected');
    expect(describeSelection({ selection: ['a', 'b', 'c'], kinds: ['rect', 'rect', 'rect'] })).toBe('3 rects selected');
    expect(describeSelection({ selection: ['a', 'b'], kinds: ['box', 'box'] })).toBe('2 boxes selected');
    expect(describeSelection({ selection: ['a', 'b'], kinds: ['entry', 'entry'] })).toBe('2 entries selected');
  });

  it('falls back to objects when the kinds differ, one is missing, or none were published', () => {
    expect(describeSelection({ selection: ['a', 'b'], kinds: ['rect', 'text'] })).toBe('2 objects selected');
    expect(describeSelection({ selection: ['a', 'b'], kinds: ['rect', undefined] })).toBe('2 objects selected');
    expect(describeSelection({ selection: ['a', 'b'] })).toBe('2 objects selected');
    expect(describeSelection({ selection: ['a'] })).toBe('1 object selected');
  });

  it('falls back to objects when the kinds do not line up with the selection', () => {
    expect(describeSelection({ selection: ['a', 'b'], kinds: ['rect'] })).toBe('2 objects selected');
  });
});
