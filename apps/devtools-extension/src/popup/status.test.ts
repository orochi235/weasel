import { describe, expect, it } from 'vitest';
import { popupStatus } from './status';

describe('popupStatus', () => {
  it('names the version, counts canvases, and says where the panel is', () => {
    expect(popupStatus({ kitVersions: ['1.11.0'], roots: 1, frames: 1 }, true)).toEqual({
      title: 'weasel 1.11.0',
      lines: ['1 canvas on this page.', 'Open DevTools (⌥⌘I) and pick the weasel tab.'],
    });
  });

  it('counts frames when weasel runs in more than one', () => {
    expect(popupStatus({ kitVersions: ['1.11.0'], roots: 3, frames: 2 }, false).lines).toEqual([
      '3 canvases in 2 frames on this page.', 'Open DevTools (Ctrl+Shift+I) and pick the weasel tab.',
    ]);
  });

  it('names every version its frames run, and none when none reports one', () => {
    expect(popupStatus({ kitVersions: ['1.4.0', '1.2.0'], roots: 3, frames: 2 }, true).title).toBe('weasel 1.4.0, 1.2.0');
    expect(popupStatus({ kitVersions: [], roots: 3, frames: 2 }, true).title).toBe('weasel');
  });

  it('says when the page has no weasel, and why that can be', () => {
    expect(popupStatus(null, true).title).toBe('No weasel on this page');
  });
});
