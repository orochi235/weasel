import { describe, expect, it } from 'vitest';
import { segmentTooltipContent } from './segmentTooltip';

describe('segmentTooltipContent', () => {
  it('names the shortcut after ariaLabel, else a string label', () => {
    expect(segmentTooltipContent({ ariaLabel: 'Bold', label: 'B', shortcut: '⌘B' })).toBe('Bold (⌘B)');
    expect(segmentTooltipContent({ label: 'Undo', shortcut: '⌘Z' })).toBe('Undo (⌘Z)');
    expect(segmentTooltipContent({ label: <svg />, shortcut: '⌘Z' })).toBe('⌘Z');
  });

  it('lets tooltip override the default, and gives nothing without either field', () => {
    expect(segmentTooltipContent({ ariaLabel: 'Bold', shortcut: '⌘B', tooltip: 'Heavier' })).toBe('Heavier');
    expect(segmentTooltipContent({ ariaLabel: 'Bold', label: 'B' })).toBeUndefined();
  });
});
