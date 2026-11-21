import { useContext, useEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FocusScope, useOverlay } from 'react-aria';
import { OverlayTriggerStateContext } from 'react-aria-components';

/** Props for {@link ContainedModal}. */
export interface ContainedModalProps {
  /** The element standing in for the viewport. */
  root: Element;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  dismissable?: boolean;
  keyboardDismissDisabled?: boolean;
  /** Whether a press on `element` outside the modal may close it. */
  shouldCloseOnInteractOutside?: (element: Element) => boolean;
  overlayClassName: string;
  modalClassName: string;
  modalProps?: HTMLAttributes<HTMLDivElement>;
  children: ReactNode;
}

/** Open state, controlled by `open` when it is given, in the shape React Aria's dialog reads its `close` from.
 *  Given neither `open` nor `defaultOpen`, an enclosing `<DialogTrigger>`'s state, as React Aria's modal reads it. */
function useOpenState({ open: controlled, defaultOpen, onOpenChange }: ContainedModalProps) {
  const trigger = useContext(OverlayTriggerStateContext);
  const [own, setOwn] = useState(defaultOpen ?? false);
  const open = controlled ?? own;
  const local = useMemo(() => {
    const setOpen = (next: boolean) => {
      if (controlled === undefined) setOwn(next);
      if (next !== open) onOpenChange?.(next);
    };
    return {
      isOpen: open,
      setOpen,
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen(!open),
      point: null,
      setPoint: () => {},
    };
  }, [open, controlled, onOpenChange]);
  return controlled === undefined && defaultOpen === undefined && trigger ? trigger : local;
}

/** How many holds made each element inert. One modal stacked on another inerts what the first already did, and
 *  the element comes free only when the last of them lets go. */
const holds = new WeakMap<Element, number>();

/**
 * Makes inert every element under `root` that does not hold `keep`, including one that joins later, until the
 * returned undo. Elements that were inert by some other hand are left as they were, and so are overlays
 * (`data-weasel-overlay`), which sit above the modal: a popover it opens, or a modal stacked on it.
 */
export function inertOutside(root: Element, keep: Element): () => void {
  const made: Element[] = [];
  const hold = (el: Element) => {
    const n = holds.get(el);
    if (n === undefined && el.hasAttribute('inert')) return;
    holds.set(el, (n ?? 0) + 1);
    if (n === undefined) el.setAttribute('inert', '');
    made.push(el);
  };
  const parents: Element[] = [];
  for (let node: Element | null = keep; node && node !== root; node = node.parentElement) {
    const parent: Element | null = node.parentElement;
    if (!parent) break;
    parents.push(parent);
    for (const sibling of Array.from<Element>(parent.children)) {
      if (sibling !== node) hold(sibling);
    }
  }
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      for (const added of Array.from(r.addedNodes)) {
        if (added instanceof Element && !added.contains(keep) && !added.hasAttribute('data-weasel-overlay')) hold(added);
      }
    }
  });
  for (const parent of parents) observer.observe(parent, { childList: true });
  return () => {
    observer.disconnect();
    for (const el of made) {
      const n = holds.get(el) ?? 1;
      if (n > 1) {
        holds.set(el, n - 1);
      } else {
        holds.delete(el);
        el.removeAttribute('inert');
      }
    }
  };
}

/**
 * A modal whose viewport is `root`: it covers `root`, traps focus, closes on Escape, and makes inert only what
 * `root` holds. React Aria's modal hides the whole document and locks its scrolling, with no way to scope either.
 */
export function ContainedModal(props: ContainedModalProps) {
  const { root, dismissable = false, keyboardDismissDisabled = false, overlayClassName, modalClassName } = props;
  const state = useOpenState(props);
  const overlay = useRef<HTMLDivElement>(null);
  const modal = useRef<HTMLDivElement>(null);
  const { overlayProps, underlayProps } = useOverlay(
    {
      isOpen: state.isOpen, onClose: state.close, isDismissable: dismissable, isKeyboardDismissDisabled: keyboardDismissDisabled,
      shouldCloseOnInteractOutside: props.shouldCloseOnInteractOutside,
    },
    modal,
  );

  useEffect(() => {
    if (!state.isOpen || !overlay.current) return;
    return inertOutside(root, overlay.current);
  }, [state.isOpen, root]);

  if (!state.isOpen) return null;
  return createPortal(
    <div ref={overlay} className={overlayClassName} data-weasel-overlay="" data-contained="" {...underlayProps}>
      <FocusScope contain restoreFocus autoFocus>
        <div ref={modal} className={modalClassName} {...props.modalProps} {...overlayProps}>
          <OverlayTriggerStateContext.Provider value={state}>{props.children}</OverlayTriggerStateContext.Provider>
        </div>
      </FocusScope>
    </div>,
    root,
  );
}
