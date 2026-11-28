/**
 * External-content ingestion: an OS drop on the canvas.
 * Items are materialized during the event, since a DataTransfer is only live
 * on the event stack; dispatch happens when materialization resolves.
 */
import { itemsFromDataTransfer, itemTypesFromDataTransfer } from '../../../ingestion/ingestItems';
import { isNode, type IngestItem } from '@weasel-js/gestures';
import { eventTaken, takeEvent, type DispatchCore } from '../dispatchCore';
import type { InputEvent } from '../matcher';
import { dropPreview } from './dropPreview';

/** Toggled on the canvas while an OS drag hovers it; consumers style it. */
export const DROPOVER_CLASS = 'weasel-dropover';

export function ingestInput(core: DispatchCore): {
  onDragOver: (e: DragEvent) => void;
  onDragEnter: (e: DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  /** Take down a drag's preview, for teardown. */
  endPreview: () => void;
} {
  const { canvas, routeAt, toWorld, dispatch } = core;
  const preview = dropPreview();

  // Routes to the point, so the routed view is the one under the drag after.
  const resolveDrag = (e: DragEvent, dt: DataTransfer) => {
    routeAt(null, e.clientX, e.clientY);
    const w = toWorld(e.clientX, e.clientY);
    const event: Extract<InputEvent, { kind: 'drop' }> = {
      kind: 'drop', items: itemTypesFromDataTransfer(dt),
      x: w.x, y: w.y, clientX: e.clientX, clientY: e.clientY,
      altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey,
    };
    const ctx = core.ctxNow();
    return { event, winner: core.dispatcherNow().resolveOnly(event, ctx), ctx };
  };

  // Run for dragenter too: cancelling dragenter (WHATWG)
  // guarantees the element stays the active drop target and shows the copy
  // cursor on entry rather than waiting for the first dragover tick.
  const onDragOver = (e: DragEvent) => {
    const dt = e.dataTransfer;
    // A surface nested in this one took the drag; it is the drop target, not this one.
    if (!dt || eventTaken(e)) { canvas?.classList.remove(DROPOVER_CLASS); preview.end(); return; }
    const { event, winner, ctx } = resolveDrag(e, dt);
    canvas?.classList.toggle(DROPOVER_CLASS, winner !== null);
    // Left alone, a drag no binding would take stays the page's: no copy
    // cursor, and no `drop` event here to swallow.
    if (!winner) { preview.end(); return; }
    takeEvent(e);
    preview.show(event, winner, ctx);
    e.preventDefault();
    dt.dropEffect = 'copy';
  };

  // Enters less leaves, across the element and its children: some engines give
  // `dragleave` a null `relatedTarget` as a drag crosses onto a child.
  let depth = 0;
  const leaveAll = () => {
    depth = 0;
    canvas?.classList.remove(DROPOVER_CLASS);
    preview.end();
  };

  const onDragEnter = (e: DragEvent) => {
    depth++;
    onDragOver(e);
  };

  const onDragLeave = (e: DragEvent) => {
    depth = Math.max(0, depth - 1);
    // A drag moving onto one of the element's own children has not left it.
    if (depth > 0 || (isNode(e.relatedTarget) && canvas?.contains(e.relatedTarget))) return;
    leaveAll();
  };

  // No stopPropagation: handled-ness is only known after the async
  // materialization microtask, so a conditional stop (wheel-style) is
  // impossible; an unconditional one would swallow drops the kit doesn't
  // dispatch. A surface around this one leaves a drop taken here instead.
  const onDrop = (e: DragEvent) => {
    leaveAll();
    const dt = e.dataTransfer;
    if (!dt || eventTaken(e)) return;
    // Which surface owns the drop is settled now, on the item types, as for
    // dragover; one no binding would take stays the page's.
    if (!resolveDrag(e, dt).winner) return;
    e.preventDefault();
    takeEvent(e);
    const dropView = core.routedView();
    const w = toWorld(e.clientX, e.clientY);
    // Real modifiers forwarded (Option-drag is a copy-drag on macOS); the
    // kit ingest binding declares all modifiers optional, so they can't
    // block the default route — but a consumer binding may key on them.
    const base = {
      altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey,
    };
    const failed = (err: unknown) => { console.error('weasel dispatcher: a drop failed', err); };
    let read: Promise<IngestItem[]>;
    try {
      read = itemsFromDataTransfer(dt);
    } catch (err) {
      failed(err);
      return;
    }
    void read.then((items) => {
      if (core.disposed()) return;
      if (items.length === 0) return;
      // The routed view is whatever moved under the cursor since; the drop
      // runs on the one it landed in, dispatcher and context both.
      const routedNow = core.routedView();
      core.setRoutedView(dropView);
      try {
        dispatch({
          kind: 'drop', items,
          x: w.x, y: w.y, clientX: e.clientX, clientY: e.clientY,
          ...base,
        });
      } finally {
        core.setRoutedView(routedNow);
      }
    }).catch(failed);
  };

  return { onDragOver, onDragEnter, onDragLeave, onDrop, endPreview: preview.end };
}
