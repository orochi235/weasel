/** The overlay one edit opens: built, seeded with the node's text, mounted, placed over the node, and focused. */
import type { ResolvedTextStyle, StyledRun } from '@weasel-js/text';
import { timerScheduler } from '@weasel-js/ui-input';
import { domToRuns } from './domRuns';
import { seedDraft, type EditDraft } from './overlayDraft';
import { holdForFaces, installSelectionStyle, openingRange } from './overlayOpen';
import { mountOverlayBoxes, placeOverlay, type OverlayBoxes } from './overlayPlace';
import { applyOverlayStyle } from './overlayStyle';
import type { TextEditClipRect, TextEditScreenPose, TextEditSelection } from './textEditTypes';

let OVERLAY_SEQ = 0;

/** What an edit opens on: the node's text and runs, and its resolved style. */
export interface EditedNode {
  readonly text: string;
  readonly runs: readonly StyledRun[] | undefined;
  readonly style: ResolvedTextStyle;
  /** An edit already open in another container: its overlay's content and its draft, which the new overlay takes
   *  over in place of the node's text. */
  readonly carried?: { readonly content: DocumentFragment; readonly draft: EditDraft };
}

/** Where the node is on screen now, and the style the edit holds it in, read each time the overlay is placed. */
export interface EditedFrame {
  pose(): TextEditScreenPose | null;
  clip(): TextEditClipRect | null;
  style(): ResolvedTextStyle;
}

export interface EditOverlay {
  readonly overlay: HTMLDivElement;
  readonly boxes: OverlayBoxes;
  readonly draft: EditDraft;
  /** Put the overlay over the node where `frame` says it is now. */
  place(): void;
  /** Take the overlay and everything it installed down. */
  remove(): void;
}

/**
 * Open an overlay on `node` in `container`, placed where `frame` says, with `caret` selected. It stays hidden for up
 * to `holdFor` ms while the faces it shows load, and is measured again once they have.
 */
export function openEditOverlay(
  container: HTMLElement,
  node: EditedNode,
  frame: EditedFrame,
  holdFor: number,
  caret: number | 'all' | 'end' | TextEditSelection,
): EditOverlay {
  const { style } = node;
  const overlay = document.createElement('div');
  const overlayClass = `weasel-text-edit-${++OVERLAY_SEQ}`;
  overlay.classList.add(overlayClass);
  overlay.setAttribute('contenteditable', 'true');
  overlay.spellcheck = false;
  const draft = node.carried ? node.carried.draft : seedDraft(overlay, node.text, node.runs, style);
  if (node.carried) overlay.append(node.carried.content);
  applyOverlayStyle(overlay, style);
  const hold = holdFor > 0 ? holdForFaces(style, node.carried ? domToRuns(overlay) : node.runs ?? []) : null;
  if (hold) overlay.style.opacity = '0';
  const styleEl = installSelectionStyle(overlayClass, style);
  const boxes = mountOverlayBoxes(container, overlay);

  const place = () => {
    placeOverlay(overlay, boxes, frame.pose(), frame.clip(), frame.style());
  };
  place();
  // Measured again on release: the first `place` ran in the fallback face.
  let held = hold !== null;
  const release = () => {
    if (!held) return;
    held = false;
    cancelHold();
    place();
    overlay.style.opacity = '';
  };
  const cancelHold = held ? timerScheduler.set(release, holdFor) : () => {};
  void hold?.then(release);

  const range = openingRange(overlay, caret);
  // Focus first, then place the caret: focusing an editable host itself
  // moves the selection (jsdom collapses to the start; browsers vary).
  boxes.scroller.focus();
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);

  return {
    overlay, boxes, draft, place,
    remove() {
      held = false;
      cancelHold();
      boxes.remove();
      styleEl?.remove();
    },
  };
}
