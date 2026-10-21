import { useEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FocusScope, useOverlay } from 'react-aria';
import { OverlayTriggerStateContext } from 'react-aria-components';

/** Props for {@link ContainedModal}. */
export interface ContainedModalProps {
  /** The element standing in for the viewport. */
  root: Element;
  isOpen?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  isDismissable?: boolean;
  isKeyboardDismissDisabled?: boolean;
  overlayClassName: string;
  modalClassName: string;
  modalProps?: HTMLAttributes<HTMLDivElement>;
  children: ReactNode;
}

/** Open state, controlled by `isOpen` when it is given, in the shape React Aria's dialog reads its `close` from. */
function useOpenState({ isOpen, defaultOpen = false, onOpenChange }: ContainedModalProps) {
  const [own, setOwn] = useState(defaultOpen);
  const open = isOpen ?? own;
  return useMemo(() => {
    const setOpen = (next: boolean) => {
      if (isOpen === undefined) setOwn(next);
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
  }, [open, isOpen, onOpenChange]);
}

/**
 * Makes inert every element under `root` that does not hold `keep`, and returns the undo. Elements that were
 * inert already are left as they were.
 */
export function inertOutside(root: Element, keep: Element): () => void {
  const made: Element[] = [];
  for (let node: Element | null = keep; node && node !== root; node = node.parentElement) {
    const parent: Element | null = node.parentElement;
    if (!parent) break;
    for (const sibling of Array.from<Element>(parent.children)) {
      if (sibling === node || sibling.hasAttribute('inert')) continue;
      sibling.setAttribute('inert', '');
      made.push(sibling);
    }
  }
  return () => {
    for (const el of made) el.removeAttribute('inert');
  };
}

/**
 * A modal whose viewport is `root`: it covers `root`, traps focus, closes on Escape, and makes inert only what
 * `root` holds. React Aria's modal hides the whole document and locks its scrolling, with no way to scope either.
 */
export function ContainedModal(props: ContainedModalProps) {
  const { root, isDismissable = false, isKeyboardDismissDisabled = false, overlayClassName, modalClassName } = props;
  const state = useOpenState(props);
  const overlay = useRef<HTMLDivElement>(null);
  const modal = useRef<HTMLDivElement>(null);
  const { overlayProps, underlayProps } = useOverlay(
    { isOpen: state.isOpen, onClose: state.close, isDismissable, isKeyboardDismissDisabled },
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
