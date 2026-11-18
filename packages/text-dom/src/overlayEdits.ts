/**
 * How an open edit changes its overlay: typing, and stepping its undo history. Either way the change ends the same:
 * the caret holder is told, the overlay follows its new line count, the draft goes out, and the change is a step.
 */
import type { TextStyle } from '@weasel-js/text';
import { domToRuns, type OverlayRunBase } from './domRuns';
import { overlayHistory, type OverlayHistory, type OverlayState } from './overlayHistory';
import type { CaretHolder } from './overlaySeed';
import { readSelectionOffsets, writeRunsPreservingSelection } from './overlaySelection';
import { typingHandlers, type TypingHost } from './overlayTyping';
import type { TextEditSelection } from './textEditTypes';

/** What an overlay's edits read and report to. */
export interface OverlayEditsHost extends Pick<TypingHost, 'pending' | 'base' | 'lastRange'> {
  /** The overlay's caret holder. */
  readonly holder: CaretHolder;
  /** The node style the edit holds, which a history step records. */
  readonly nodeStyle: () => TextStyle | null;
  /** Hold `style` as the node's, or the node's own for `null`, and dress the overlay in it. */
  readonly restyle: (style: TextStyle | null) => OverlayRunBase;
  /** Put the overlay over the node again and keep the caret in view, after its text changed. */
  readonly follow: () => void;
  /** Drop any style armed at the caret. */
  readonly dropPending: () => void;
  readonly publishRange: (overlay: HTMLElement, range: TextEditSelection) => void;
  readonly sendDraft: (overlay: HTMLElement) => void;
}

/** `overlay`'s undo history, and the typing listeners that record every input in it. */
export function createOverlayEdits(
  overlay: HTMLElement,
  host: OverlayEditsHost,
): { history: OverlayHistory; typing: ReturnType<typeof typingHandlers> } {
  const { holder } = host;
  const written = (range: TextEditSelection) => {
    holder.wrote(overlay, range.end);
    host.dropPending();
    host.publishRange(overlay, range);
  };
  // Typing can change the line count; re-placing on `input` rather than on the
  // next frame keeps a center/bottom-aligned overlay from jumping a frame late.
  const edited = () => {
    holder.edited(overlay);
    host.follow();
    host.sendDraft(overlay);
    history.after();
  };
  const history = overlayHistory({
    read: (): OverlayState | null => {
      const at = readSelectionOffsets(overlay) ?? host.lastRange();
      const runs = domToRuns(overlay);
      return at && { runs: holder.trim(runs), selection: at, style: host.nodeStyle() };
    },
    write: ({ runs, selection: at, style: held }) => {
      const base = host.restyle(held);
      writeRunsPreservingSelection(overlay, runs, at.start, at.end, base);
      holder.reseed(runs);
      written(at);
      edited();
    },
  });
  const typing = typingHandlers(overlay, {
    pending: host.pending,
    base: host.base,
    lastRange: host.lastRange,
    onWritten: written,
    onEdited: edited,
    history,
  });
  return { history, typing };
}
