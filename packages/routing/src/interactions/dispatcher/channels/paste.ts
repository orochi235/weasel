/** The paste channel: clipboard content pasted while this dispatcher holds the keys. */
import { itemsFromClipboardData } from '../../../ingestion/ingestItems';
import { isEditableTarget } from '../../keyHelpers';
import type { DispatchCore } from '../dispatchCore';
import { passOn, type TakePaste } from './keyPeers';
import { inModalOver } from './modal';

export function pasteInput(core: DispatchCore): { onPaste: (e: ClipboardEvent) => void; take: TakePaste } {
  // Pastes already offered here by a peer on the surface, which this channel's own listener leaves.
  const taken = new WeakSet<Event>();

  const onPaste = (e: ClipboardEvent): void => {
    // Text-editing surfaces (inputs, the text-edit overlay) own their own
    // paste — never steal it for scene ingestion.
    if (e.defaultPrevented || taken.has(e) || isEditableTarget(e.target) || inModalOver(e.target, core.canvas)) return;
    // Every dispatcher hears paste on window; only the one holding the keys acts.
    if (!core.holdsKeys()) return;
    consider(e);
    if (core.canvas) passOn(core.canvas, 'paste', take, e);
  };

  const take: TakePaste = (e) => {
    taken.add(e);
    consider(e);
  };

  const consider = (e: ClipboardEvent): void => {
    const cd = e.clipboardData;
    if (!cd) return;
    const items = itemsFromClipboardData(cd);
    if (items.length === 0) return;
    // Wheel's shape: dispatch first, suppress the default only when a
    // binding claimed it. Clipboard items materialize synchronously, so
    // unlike a drop the result is known while `preventDefault` is still
    // honored — and a paste no binding wanted stays the page's to handle.
    const result = core.dispatch({
      kind: 'paste', items,
      // ClipboardEvent carries no modifier state.
      altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
    });
    if (result === 'handled') e.preventDefault();
  };

  return { onPaste, take };
}
