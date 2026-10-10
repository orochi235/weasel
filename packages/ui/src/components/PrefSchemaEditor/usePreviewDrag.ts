import { useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { isInControlWithin, startThresholdDrag, type ThresholdDragHandle } from '@weasel-js/core';
import { swallowNextClick } from '../../useReorderDragList';
import { GHOST_WIDTH, ghostIsPage } from './NodeGhost';
import { nodeAt, parentPath, pathOf, type SchemaNode, type SchemaRoot, type SchemaTarget } from './schemaEdit';
import type { DropOutside } from './StructurePane';

export interface PreviewGhost {
  left: number;
  top: number;
  width: number;
  node: SchemaNode;
  /** The node sits directly under the root. */
  topLevel: boolean;
}

/**
 * Dragging what the live preview draws: a press on a row's label, on a group's heading, or on a group's entry in the
 * rail picks that node up, and it drops wherever `place` takes it — the preview itself. A press on a row's control is
 * the control's.
 */
export function usePreviewDrag({ stage, schema, place, onMove }: {
  stage: RefObject<HTMLDivElement | null>;
  schema(): SchemaRoot;
  place: DropOutside;
  onMove(paths: readonly string[], target: SchemaTarget): void;
}): { ghost: PreviewGhost | null; onPointerDown(e: ReactPointerEvent): void } {
  const [ghost, setGhost] = useState<PreviewGhost | null>(null);
  const drag = useRef<ThresholdDragHandle | null>(null);

  const onPointerDown = (e: ReactPointerEvent): void => {
    const box = stage.current;
    const target = e.target as Element;
    // The entry for the root's own leaves has the empty path, and names no node to pick up.
    const entry = target.closest?.('[data-pref-rail]:not([data-pref-rail=""])');
    const el = entry ?? target.closest?.('[data-pref-path]');
    // A rail entry is a button whose press is also the pick-up.
    if (!box || !el || drag.current || e.button !== 0 || (!entry && isInControlWithin(target, el))) return;
    // A leaf's row is its label and then its control; only the label picks the row up.
    const row = el.firstElementChild;
    if (el.hasAttribute('data-pref-leaf') && row && row.children.length > 1 && !row.firstElementChild!.contains(target)) return;
    // Under a group root every key is one step of the value path.
    const path = pathOf((el.getAttribute('data-pref-rail') ?? el.getAttribute('data-pref-path')!).split('.'))!;
    const node = nodeAt(schema(), path);
    if (!node) return;
    const topLevel = parentPath(path) === null;

    const end = () => {
      drag.current = null;
      place.end();
      setGhost(null);
    };
    const update = (ev: PointerEvent) => {
      place.over([node], [path], { x: ev.clientX, y: ev.clientY });
      // Offset from the pointer so what is under it stays visible.
      setGhost({ left: ev.clientX + 10, top: ev.clientY + 10, width: GHOST_WIDTH[ghostIsPage(node, topLevel) ? 'page' : 'node'], node, topLevel });
    };
    drag.current = startThresholdDrag(e, {
      origin: box,
      onActivate: update,
      onMove: update,
      onCommit: (ev) => {
        const to = place.target([node], [path], { x: ev.clientX, y: ev.clientY });
        // The release would otherwise click the label it began on, and toggle its control.
        swallowNextClick(box);
        end();
        if (to) onMove([path], to);
      },
      onClick: () => {
        end();
        // The session holds the pointer, so the release is not a click on the entry.
        (entry as HTMLElement | null)?.click();
      },
      onCancel: end,
    });
  };

  return { ghost, onPointerDown };
}
