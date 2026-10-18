import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { isInControlWithin, startThresholdDrag, type ThresholdDragHandle } from '@weasel-js/core';
import { useKitSetting } from '@weasel-js/react';
import { swallowNextClick } from '../../useReorderDragList';
import { GHOST_WIDTH, ghostIsPage } from './NodeGhost';
import { aliasOf, canAlias, carried, nodeAt, parentPath, pathOf, type SchemaNode, type SchemaRoot, type SchemaTarget } from './schemaEdit';
import type { DropOutside } from './StructurePane';

export interface PreviewGhost {
  left: number;
  top: number;
  width: number;
  node: SchemaNode;
  /** The node sits directly under the root. */
  topLevel: boolean;
  /** How many nodes the drag carries; the one drawn is the one pressed. */
  count: number;
}

/**
 * Dragging what the live preview draws: a press on a row's label, on a group's heading, or on a group's entry in the
 * rail picks that node up, and it drops wherever `place` takes it — the preview itself. A press on a row's control is
 * the control's, but for a button in a bar, which has no label beside it to press. With Alt held the node stays and a copy of it drops; with Alt and Cmd or Ctrl, an alias of a leaf.
 * A press on one of several selected nodes picks them all up, and one let go without a drag picks that node alone.
 */
export function usePreviewDrag({ stage, schema, place, onMove, onCopy, onAlias, selected, onPick }: {
  stage: RefObject<HTMLDivElement | null>;
  schema(): SchemaRoot;
  place: DropOutside;
  onMove(paths: readonly string[], target: SchemaTarget): void;
  onCopy(paths: readonly string[], target: SchemaTarget): void;
  onAlias(paths: readonly string[], target: SchemaTarget): void;
  /** The tree paths selected before the press. */
  selected(): readonly string[];
  /** One of several selected nodes was pressed and let go without a drag. */
  onPick(path: string): void;
}): { ghost: PreviewGhost | null; onPointerDown(e: ReactPointerEvent): void } {
  const [ghost, setGhost] = useState<PreviewGhost | null>(null);
  const drag = useRef<ThresholdDragHandle | null>(null);
  const dragPx = useKitSetting('gestures.dragPx');
  // Its end also tells `place` the drag is over, which stops what `place` had waiting on it.
  useEffect(() => () => { drag.current?.cancel(); }, []);

  const onPointerDown = (e: ReactPointerEvent): void => {
    const box = stage.current;
    const target = e.target as Element;
    // The entry for the root's own leaves has the empty path, and names no node to pick up.
    const entry = target.closest?.('[data-pref-rail]:not([data-pref-rail=""])');
    const el = entry ?? target.closest?.('[data-pref-path]');
    const button = !entry && el?.closest('[data-pref-bar]') ? target.closest?.('button') : null;
    // A rail entry, or a button in a bar, whose press is also the pick-up.
    const pressed = entry ?? (button && el!.contains(button) ? button : null);
    if (!box || !el || drag.current || e.button !== 0 || (!pressed && isInControlWithin(target, el))) return;
    // With Cmd or Ctrl alone the press adds the row to the selection or takes it out, and picks nothing up.
    if ((e.metaKey || e.ctrlKey) && !e.altKey) return;
    // A leaf's row is its label and then its control; only the label picks the row up.
    const row = el.firstElementChild;
    if (!pressed && el.hasAttribute('data-pref-leaf') && row && row.children.length > 1 && !row.firstElementChild!.contains(target)) return;
    // Under a group root every key is one step of the value path.
    const path = pathOf((el.getAttribute('data-pref-rail') ?? el.getAttribute('data-pref-path')!).split('.'))!;
    const node = nodeAt(schema(), path);
    if (!node) return;
    const topLevel = parentPath(path) === null;
    const chosen = selected();
    const several = chosen.length > 1 && chosen.includes(path);
    const paths = several ? carried(schema(), chosen) : [path];
    const nodes = paths.map((p) => nodeAt(schema(), p)!);

    const end = () => {
      drag.current = null;
      place.end();
      setGhost(null);
    };
    // An alias is of one leaf: a drag of several moves or copies them.
    const aliasable = !several && canAlias(schema(), path);
    const effectOf = (ev: PointerEvent): 'move' | 'copy' | 'link' =>
      !ev.altKey ? 'move' : (ev.metaKey || ev.ctrlKey) && aliasable ? 'link' : 'copy';
    // A copy or an alias is new where it lands, so the place is asked about it with no path of its own.
    const held = (ev: PointerEvent): string[] => (effectOf(ev) === 'move' ? paths : []);
    const landing = (ev: PointerEvent): SchemaNode[] => (effectOf(ev) === 'link' ? [aliasOf(schema(), path)] : nodes);
    const update = (ev: PointerEvent) => {
      place.over(landing(ev), held(ev), { x: ev.clientX, y: ev.clientY });
      // Offset from the pointer so what is under it stays visible.
      setGhost({ left: ev.clientX + 10, top: ev.clientY + 10, width: GHOST_WIDTH[ghostIsPage(node, topLevel) ? 'page' : 'node'], node, topLevel, count: paths.length });
    };
    drag.current = startThresholdDrag(e, {
      origin: box,
      threshold: dragPx,
      onActivate: update,
      onMove: update,
      onCommit: (ev) => {
        const to = place.target(landing(ev), held(ev), { x: ev.clientX, y: ev.clientY });
        // The release would otherwise click the label it began on, and toggle its control.
        swallowNextClick(box);
        end();
        if (to) ({ move: onMove, copy: onCopy, link: onAlias })[effectOf(ev)](paths, to);
      },
      onClick: () => {
        end();
        if (several) onPick(path);
        // The session holds the pointer, so the release is not a click on what was pressed.
        (pressed as HTMLElement | null)?.click();
      },
      onCancel: end,
    });
  };

  return { ghost, onPointerDown };
}
