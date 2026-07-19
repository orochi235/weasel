import { useId, useRef, type ReactNode, type RefObject } from 'react';
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
  /** Show the × button. Defaults to `!modal`. */
  showCloseButton?: boolean;
  /** Anchor to an arbitrary element (programmatic use, with `isOpen`). */
  triggerRef?: RefObject<Element | null>;
  /**
   * Anchor to a client-coordinate rect — e.g. a scene node located via
   * core's `sceneNodeClientRect`. Snapshot semantics: the callout does not
   * re-anchor on pan/zoom or scene changes. Takes precedence over
   * `triggerRef`.
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
  const titleId = useId();
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
