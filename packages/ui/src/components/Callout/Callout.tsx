import { useCallback, useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  DialogTrigger,
  Popover as RACPopover,
  OverlayArrow,
  Dialog as RACDialog,
  Heading,
  type PopoverProps as RACPopoverProps,
} from 'react-aria-components';
import s from './Callout.module.css';

/** Accent color of a {@link Callout}'s border and arrow. */
export type CalloutTone = 'info' | 'warning' | 'danger';

/**
 * Composition wrapper for press-to-open callouts:
 * `<CalloutTrigger><Pressable>…</Pressable><Callout>…</Callout></CalloutTrigger>`.
 * Re-exported RAC DialogTrigger — non-RAC trigger elements must be wrapped
 * in `<Pressable>` from react-aria-components.
 * In composed mode, put `defaultOpen` on `CalloutTrigger`, not `Callout` —
 * RAC detaches to local open state on the trigger, not the popover.
 */
export { DialogTrigger as CalloutTrigger };

/** Props for {@link Callout}, on top of React Aria's `Popover` props. */
export type CalloutProps = Omit<
  RACPopoverProps,
  'children' | 'className' | 'isNonModal' | 'triggerRef'
> & {
  children?: ReactNode;
  className?: string;
  /** Optional heading rendered above the body. */
  title?: ReactNode;
  /** Footer slot — typically action buttons. */
  footer?: ReactNode;
  /** Accent tone for border + arrow. Default `info`. */
  tone?: CalloutTone;
  /**
   * `true` — blocks interaction with the rest of the app until dismissed;
   * inner dialog is `role="alertdialog"`. `false` (default) — non-blocking:
   * the app stays interactive; Esc / outside click / close button dismiss.
   */
  modal?: boolean;
  /**
   * Show the × button. Defaults to `!modal`. In programmatic
   * `triggerRef`/`anchorRect` modes the close button requires either
   * controlled open (`isOpen` + `onOpenChange`) or `onDismiss`; with only
   * `defaultOpen` it has no open-state setter to call and cannot close.
   */
  showCloseButton?: boolean;
  /**
   * The user asked for this callout to go away — the × button or Escape.
   *
   * Distinct from `onOpenChange`, which a non-modal popover *also* fires when
   * interaction or focus merely leaves it. On a canvas that's every click on
   * the artwork, so a consumer that pins `isOpen` and treats `onOpenChange`
   * as dismissal retires messages nobody read. Use this instead: it fires
   * only on a deliberate act, and never on incidental focus loss.
   */
  onDismiss?: () => void;
  /** Anchor to an arbitrary element (programmatic use, with `isOpen`). */
  triggerRef?: RefObject<Element | null>;
  /**
   * Anchor to a client-coordinate rect — e.g. a scene node's on-screen box.
   * The callout re-anchors whenever this rect changes, so a consumer that
   * recomputes it on pan, zoom, or scene edits keeps the arrow on its target.
   * Takes precedence over `triggerRef`.
   */
  anchorRect?: { x: number; y: number; width: number; height: number };
};

const toneClass: Record<CalloutTone, string> = {
  info: s.toneInfo,
  warning: s.toneWarning,
  danger: s.toneDanger,
};

/**
 * Anchored callout with an arrow pointing at its source — a trigger
 * element, an arbitrary `triggerRef`, or a client-space `anchorRect`.
 * Wraps React Aria Popover + Dialog; positioning, collision flipping,
 * dismissal, and focus behavior come from the underlying primitives.
 */
export function Callout(props: CalloutProps) {
  const {
    children,
    className,
    title,
    footer,
    tone = 'info',
    modal = false,
    showCloseButton,
    onDismiss,
    triggerRef,
    anchorRect,
    placement = 'top',
    offset = 12,
    maxHeight = 400,
    onOpenChange,
    shouldCloseOnInteractOutside,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    ...rest
  } = props;
  const anchorRef = useRef<HTMLSpanElement>(null);
  const showClose = showCloseButton ?? !modal;
  // Escape is a dismissal like the × is. It can't ride on a React `onKeyDown`:
  // RAC's Dialog runs its props through filterDOMProps, which drops handlers
  // it doesn't know, so the listener goes on the section itself. RAC's own
  // Escape handling is untouched — this only adds the signal.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const escapeListener = useRef((e: KeyboardEvent) => {
    if (e.key === 'Escape') onDismissRef.current?.();
  });
  const listeningTo = useRef<HTMLElement | null>(null);
  const dialogRef = useCallback((node: HTMLElement | null) => {
    listeningTo.current?.removeEventListener('keydown', escapeListener.current);
    listeningTo.current = node;
    node?.addEventListener('keydown', escapeListener.current);
  }, []);
  const titleId = useId();
  // RAC positions on open and recomputes on scroll, resize, and a
  // ResizeObserver on the anchor — none of which fire when `anchorRect` is
  // merely *translated*, as it is when a consumer tracks a scene node across a
  // pan. (Zoom happens to work, since scaling also changes the anchor's size.)
  // Nudging RAC's own resize listener is the supported way to make it
  // recompute; there's no public updatePosition on Popover.
  const hasAnchorRect = anchorRect !== undefined;
  useEffect(() => {
    if (!hasAnchorRect || typeof window === 'undefined') return;
    window.dispatchEvent(new Event('resize'));
  }, [hasAnchorRect, anchorRect?.x, anchorRect?.y, anchorRect?.width, anchorRect?.height]);
  // RAC's popover role-heuristic misses alertdialog; label the outer role
  // it stamps. Upstream: react-spectrum Popover.mjs querySelector('[role=dialog]').
  const popoverAriaLabelledby =
    modal && title !== undefined ? titleId : ariaLabelledby;
  const popoverAriaLabel = modal ? ariaLabel : undefined;
  return (
    <>
      {/* Harmless while closed — RAC reads the ref only when the popover is open. */}
      {anchorRect !== undefined &&
        createPortal(
          <span
            ref={anchorRef}
            data-callout-anchor=""
            className={s.anchor}
            aria-hidden="true"
            // Dynamic geometry — inline style is the mechanism here, not styling.
            style={{
              left: anchorRect.x,
              top: anchorRect.y,
              width: anchorRect.width,
              height: anchorRect.height,
            }}
          />,
          document.body,
        )}
      <RACPopover
        {...rest}
        triggerRef={anchorRect !== undefined ? anchorRef : triggerRef}
        isNonModal={!modal}
        placement={placement}
        offset={offset}
        maxHeight={maxHeight}
        onOpenChange={onOpenChange}
        shouldCloseOnInteractOutside={
          shouldCloseOnInteractOutside ?? (modal ? () => false : undefined)
        }
        aria-label={popoverAriaLabel}
        aria-labelledby={popoverAriaLabelledby}
        className={[s.popover, toneClass[tone], className].filter(Boolean).join(' ')}
        data-weasel-overlay=""
      >
        <OverlayArrow className={s.arrow}>
          <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true">
            <path d="M0 0 L6 6 L12 0" />
          </svg>
        </OverlayArrow>
        <RACDialog
          role={modal ? 'alertdialog' : 'dialog'}
          className={s.dialog}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          ref={dialogRef}
        >
          {({ close }) => (
            <>
              {(title !== undefined || showClose) && (
                <header className={s.header}>
                  {title !== undefined && (
                    <Heading id={titleId} slot="title" className={s.title}>
                      {title}
                    </Heading>
                  )}
                  {showClose && (
                    <button
                      type="button"
                      className={s.close}
                      onClick={() => {
                        // `close()` resolves OverlayTriggerStateContext, only
                        // provided by DialogTrigger (composed mode). In
                        // triggerRef/anchorRect modes there is no such
                        // context, so `close()` is a no-op there — the
                        // controlled-open fallback below does the work.
                        close();
                        onOpenChange?.(false);
                        onDismiss?.();
                      }}
                      aria-label="Close callout"
                    >
                      ×
                    </button>
                  )}
                </header>
              )}
              <div className={s.body}>{children}</div>
              {footer !== undefined && <footer className={s.footer}>{footer}</footer>}
            </>
          )}
        </RACDialog>
      </RACPopover>
    </>
  );
}
