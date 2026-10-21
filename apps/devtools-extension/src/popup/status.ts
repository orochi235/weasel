import type { TabWeasel } from '../tabWeasel';

export interface PopupStatus {
  title: string;
  lines: string[];
}

export function popupStatus(tab: TabWeasel | null, mac: boolean): PopupStatus {
  if (!tab) {
    return {
      title: 'No weasel on this page',
      lines: [
        'A dev build hooks in when its first canvas mounts. A production build hooks in only if it imports @weasel-js/core/devtools.',
      ],
    };
  }
  const canvases = `${tab.roots} ${tab.roots === 1 ? 'canvas' : 'canvases'}`;
  const frames = tab.frames > 1 ? ` in ${tab.frames} frames` : '';
  return {
    title: tab.kitVersion ? `weasel ${tab.kitVersion}` : 'weasel',
    lines: [
      `${canvases}${frames} on this page.`,
      `Open DevTools (${mac ? '⌥⌘I' : 'Ctrl+Shift+I'}) and pick the weasel tab.`,
    ],
  };
}
