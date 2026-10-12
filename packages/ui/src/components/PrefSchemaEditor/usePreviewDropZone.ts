import { useRef, useState, type RefObject } from 'react';
import { prefDropTargetAt, type PrefDrop } from '../Prefs';
import { heldDrop, previewDrop, previewMark, previewTarget, sameDrop } from './previewDrop';
import { pathOf, type SchemaNode, type SchemaRoot } from './schemaEdit';
import type { DropOutside } from './StructurePane';

/** How long a drag rests on a rail entry before the preview opens that page. */
const RAIL_OPEN_MS = 500;

export interface PreviewDropZone {
  /** The element the form is drawn in, which a drag is hit-tested against. */
  stage: RefObject<HTMLDivElement | null>;
  /** What the form draws of the drag over it. */
  drop: PrefDrop | null;
  outside: DropOutside;
  /** Set while a drop into the preview is being carried out, which every way of dropping there does in one task. */
  dropping: RefObject<boolean>;
  /** What was selected when a drag opened a rail page, which selects that page's group: a step back from the drop
   *  returns to this and not to the group. */
  beforeOpening: RefObject<readonly string[] | null>;
}

/** The live preview as a place to drop: the form says what is under the pointer, the schema whether it fits there. */
export function usePreviewDropZone({ schema, selected, maxDepth, pageless = false, locked = false, onOpen }: {
  schema(): SchemaRoot;
  selected(): readonly string[];
  maxDepth?: number;
  /** `holdsPages`'s: the root's own rows are rows of it. */
  pageless?: boolean;
  /** Nothing lands: the schema takes no edit. */
  locked?: boolean;
  /** A drag rested on a rail entry: select these, the group whose page it is, or nothing for the root's. */
  onOpen(paths: readonly string[]): void;
}): PreviewDropZone {
  const stage = useRef<HTMLDivElement | null>(null);
  const [drop, setDrop] = useState<PrefDrop | null>(null);
  const dropping = useRef(false);
  const beforeOpening = useRef<readonly string[] | null>(null);
  const opening = useRef<{ path: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const stopOpening = () => {
    if (opening.current) clearTimeout(opening.current.timer);
    opening.current = null;
  };
  const markAt = (nodes: readonly SchemaNode[], point: { x: number; y: number }) =>
    previewMark((stage.current && prefDropTargetAt(stage.current, point.x, point.y)) || null, nodes);
  const outside: DropOutside = {
    over(nodes, paths, point) {
      const mark = markAt(nodes, point);
      const landing = !locked && mark && previewTarget(schema(), mark, nodes, paths, maxDepth, pageless) !== null ? previewDrop(mark, nodes, paths) : null;
      const next = landing ?? heldDrop(schema(), nodes, paths);
      setDrop((cur) => (sameDrop(cur, next) ? cur : next));
      // Held on the middle of a rail entry, the drag opens that page, so a row on it can be aimed at.
      if (next?.rail && next.where === 'into') {
        if (opening.current?.path !== next.path) {
          stopOpening();
          const path = next.path;
          opening.current = {
            path,
            timer: setTimeout(() => {
              beforeOpening.current ??= selected();
              onOpen(path === '' ? [] : [pathOf(path.split('.'))!]);
            }, RAIL_OPEN_MS),
          };
        }
      } else {
        stopOpening();
      }
      return landing !== null;
    },
    target: (nodes, paths, point) => {
      const target = locked ? null : previewTarget(schema(), markAt(nodes, point), nodes, paths, maxDepth, pageless);
      if (target) {
        dropping.current = true;
        queueMicrotask(() => { dropping.current = false; });
      }
      return target;
    },
    end() {
      stopOpening();
      setDrop(null);
      // A preview drag ends before its drop is committed, in the same task.
      queueMicrotask(() => { beforeOpening.current = null; });
    },
  };
  return { stage, drop, outside, dropping, beforeOpening };
}
