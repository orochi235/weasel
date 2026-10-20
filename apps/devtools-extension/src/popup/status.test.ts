import { describe, expect, it } from 'vitest';
import { popupStatus } from './status';

describe('popupStatus', () => {
  it('names the version, counts canvases, and says where the panel is', () => {
    expect(popupStatus({ kitVersion: '1.11.0', roots: 1, frames: 1 }, true)).toEqual({
      title: 'weasel 1.11.0',
      lines: ['1 canvas on this page.', 'Open DevTools (⌥⌘I) and pick the weasel tab.'],
    });
  });

  it('counts frames when weasel runs in more than one', () => {
    expect(popupStatus({ kitVersion: '1.11.0', roots: 3, frames: 2 }, false).lines).toEqual([
      '3 canvases in 2 frames on this page.', 'Open DevTools (Ctrl+Shift+I) and pick the weasel tab.',
    ]);
  });

  it('says when the page has no weasel, and why that can be', () => {
    expect(popupStatus(null, true).title).toBe('No weasel on this page');
  });
});
