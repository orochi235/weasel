import type { View } from '@weasel-js/core';

/** Says whether what a lens reads from changed between one landed frame and the next. */
export interface ContentWatch {
  /** The camera the lens was just drawn through. */
  drew(view: View): void;
  /** Whether the content version or the camera differs from the last time this was asked. The first ask only
   *  takes its bearings, and answers `false`. */
  changed(): boolean;
}

/**
 * Watches the two things that change the pixels under an aim that holds still: the content, through `version`
 * when the lens is given one, and the camera it is drawn through. A lens redrawing itself moves neither, which is
 * what lets it read the framebuffer again on a change without that read's own redraw asking for another.
 */
export function createContentWatch(version: (() => number) | undefined): ContentWatch {
  let camera = '';
  let seen: { version: number | undefined; camera: string } | null = null;
  return {
    drew(view) {
      camera = `${view.x},${view.y},${view.scale.x},${view.scale.y}`;
    },
    changed() {
      const now = { version: version?.(), camera };
      const moved = seen !== null && (seen.version !== now.version || seen.camera !== now.camera);
      seen = now;
      return moved;
    },
  };
}
