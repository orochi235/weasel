import { useMemo } from 'react';
import type { PlacedPage, SceneCanvasProps } from '@weasel-js/core';
import type { AppCommands } from './appCommands';
import { usePref } from './prefs';

/**
 * The "Bound view to content" preference: while it is on, the view pans no
 * further than the drawing and its pages plus a margin, and a drag held at
 * the edge scrolls the view to make room. Returns the canvas's `viewBounds`
 * and the toggle the View menu fires.
 */
export function useViewBounds(pages: readonly PlacedPage[]) {
  const [on, setOn] = usePref('view.boundToContent');
  const viewBounds = useMemo((): SceneCanvasProps<unknown, string, unknown>['viewBounds'] => (on
    ? { content: { include: pages.map(({ x, y, width, height }) => ({ x, y, width, height })) } }
    : undefined), [on, pages]);
  const commands: Pick<AppCommands, 'boundToContent' | 'toggleBoundToContent'> = {
    boundToContent: on,
    toggleBoundToContent: () => setOn(!on),
  };
  return { viewBounds, commands };
}
