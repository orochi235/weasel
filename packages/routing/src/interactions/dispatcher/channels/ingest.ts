/**
 * External-content ingestion: an OS drop on the canvas, a paste on window.
 * Items are materialized during the event, since a DataTransfer is only live
 * on the event stack; dispatch happens when materialization resolves.
 */
import { itemsFromClipboardData, itemsFromDataTransfer, itemTypesFromDataTransfer } from '../../../ingestion/ingestItems';
import { isEditableTarget } from '../../keyHelpers';
import { eventTaken, takeEvent, type DispatchCore } from '../dispatchCore';
import type { InputEvent } from '../matcher';
import { dropPreview } from './dropPreview';
import { inModalOver } from './modal';

/** Toggled on the canvas while an OS drag hovers it; consumers style it. */
export const DROPOVER_CLASS = 'weasel-dropover';

export function ingestInput(core: DispatchCore): {
  onDragOver: (e: DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  onPaste: (e: ClipboardEvent) => void;
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

  // Attached to both dragover and dragenter: cancelling dragenter (WHATWG)
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

  const onDragLeave = (e: DragEvent) => {
    // A drag moving onto one of the element's own children has not left it.
    if (e.relatedTarget instanceof Node && canvas?.contains(e.relatedTarget)) return;
    canvas?.classList.remove(DROPOVER_CLASS);
    preview.end();
  };

  // No stopPropagation: handled-ness is only known after the async
  // materialization microtask, so a conditional stop (wheel-style) is
  // impossible; an unconditional one would swallow drops the kit doesn't
  // dispatch. A surface around this one leaves a drop taken here instead.
  const onDrop = (e: DragEvent) => {
    canvas?.classList.remove(DROPOVER_CLASS);
    preview.end();
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
    void itemsFromDataTransfer(dt).then((items) => {
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
    });
  };

  const onPaste = (e: ClipboardEvent) => {
    // Text-editing surfaces (inputs, the text-edit overlay) own their own
    // paste — never steal it for scene ingestion.
    if (e.defaultPrevented || isEditableTarget(e.target) || inModalOver(e.target, core.canvas)) return;
    // Every dispatcher hears paste on window; only the one holding the keys acts.
    if (!core.holdsKeys()) return;
    const cd = e.clipboardData;
    if (!cd) return;
    const items = itemsFromClipboardData(cd);
    if (items.length === 0) return;
    // Wheel's shape: dispatch first, suppress the default only when a
    // binding claimed it. Clipboard items materialize synchronously, so
    // unlike `onDrop` the result is known while `preventDefault` is still
    // honored — and a paste no binding wanted stays the page's to handle.
    const result = dispatch({
      kind: 'paste', items,
      // ClipboardEvent carries no modifier state.
      altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
    });
    if (result === 'handled') e.preventDefault();
  };

  return { onDragOver, onDragLeave, onDrop, onPaste, endPreview: preview.end };
}
