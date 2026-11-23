/** An open edit moving to another container: what its overlay held, taken out when the old overlay comes down and
 *  handed to the one the new container opens. */
import { useCallback, useRef } from 'react';
import type { TextStyle } from '@weasel-js/text';
import type { EditDraft } from './overlayDraft';
import { readSelectionOffsets } from './overlaySelection';
import type { TextEditSelection } from './textEditTypes';

/** What an open edit carries from one container's overlay to the next. */
export interface CarriedEdit {
  readonly id: string;
  readonly content: DocumentFragment;
  readonly draft: EditDraft;
  readonly selection: TextEditSelection | null;
  readonly held: TextStyle | null;
}

/** The latest editing id and container, the published range, and the node style held, as the hook reads them. */
export interface EditCarryHost {
  readonly editingIdRef: { readonly current: string | null };
  readonly optsRef: { readonly current: { readonly container: HTMLElement | null } };
  readonly selectionRef: { readonly current: TextEditSelection | null };
  readonly nodeStyleRef: { readonly current: TextStyle | null };
}

export function useEditCarry(host: EditCarryHost) {
  const { editingIdRef, optsRef, selectionRef, nodeStyleRef } = host;
  const carryRef = useRef<CarriedEdit | null>(null);

  /** The edit carried for `id`, taken once it has a container to open in. One carried for any other edit is dropped. */
  const takeCarry = useCallback((id: string | null, hasContainer: boolean): CarriedEdit | null => {
    const carried = carryRef.current?.id === id ? carryRef.current : null;
    carryRef.current = hasContainer ? null : carried;
    return carried;
  }, []);

  /** As `overlay` comes down: when `id` is still being edited, in a container other than `container`, carry it. */
  const stashCarry = useCallback((id: string, container: HTMLElement, overlay: HTMLElement, draft: EditDraft) => {
    if (editingIdRef.current !== id || optsRef.current.container === container) return;
    const selection = readSelectionOffsets(overlay) ?? selectionRef.current;
    const content = document.createDocumentFragment();
    content.append(...overlay.childNodes);
    carryRef.current = { id, content, draft, selection, held: nodeStyleRef.current };
  }, [editingIdRef, optsRef, selectionRef, nodeStyleRef]);

  return { takeCarry, stashCarry };
}
