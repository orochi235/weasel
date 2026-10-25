import { useContext, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  DialogTrigger,
  OverlayArrow,
  Dialog as RACDialog,
  Heading,
  OverlayTriggerStateContext,
} from 'react-aria-components';
import { Popover, type PopoverProps } from '../Popover';
import { useOverlayPortal, type OverlayPortalProps, type WithoutPortalTarget } from '../../overlays/portalHost';
import { CloseButton } from '../CloseButton';
import { type AppearanceProps, useAppearance } from '../appearance';
import { useEscapeDismissal } from './useEscapeDismissal';
import s from './Callout.module.css';

/** Far past the 1/64px a browser lays out in, and far short of anything seen. */
const ANCHOR_NUDGE_PX = 1 / 16;

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
  WithoutPortalTarget<PopoverProps>,
  'children' | 'className' | 'isNonModal' | 'triggerRef'
> &
  OverlayPortalProps &
  AppearanceProps & {
  children?: ReactNode;
  className?: string;
  /** Optional heading rendered above the body. */
  title?: ReactNode;
  /** Footer slot — typically action buttons. */
  footer?: ReactNode;
  /**
   * `true` — blocks interaction with the rest of the app until dismissed;
   * inner dialog is `role="alertdialog"`. `false` (default) — non-blocking:
   * the app stays interactive; Esc / outside click / close button dismiss.
   */
  modal?: boolean;
  /**
   * Show the close button. Defaults to `!modal`. In programmatic
   * `triggerRef`/`anchorRect` modes the close button needs controlled open
   * (`isOpen` + `onOpenChange`); with only `defaultOpen` it has no open-state
   * setter to call and cannot close.
   */
  showCloseButton?: boolean;
  /**
   * The user asked for this callout to go away — the close button, or an
   * Escape that closes it. An Escape that something inside the callout took,
   * like an open menu's, is not one.
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
    stance,
    grade,
    emphasis,
    tint,
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
    portalContainer,
    ...rest
  } = props;
  const anchorRef = useRef<HTMLSpanElement>(null);
  const appearance = useAppearance({ stance, grade, emphasis, tint });
  const { anchor: portalAnchor, provide, ready } = useOverlayPortal(portalContainer);
  const showClose = showCloseButton ?? !modal;
  const { watched, closedByEscape, dialogRef } = useEscapeDismissal(onDismiss);
  const titleId = useId();
  // RAC repositions when the anchor changes size, through its own ResizeObserver, and not when it only moves, as
  // it does when a consumer tracks a scene node across a pan. Popover has no public updatePosition, so each move
  // also flips the anchor's width by a fraction of a pixel, which that observer sees and nothing else does.
  const [seen, setSeen] = useState({ x: anchorRect?.x, y: anchorRect?.y, flip: false });
  if (seen.x !== anchorRect?.x || seen.y !== anchorRect?.y) {
    setSeen({ x: anchorRect?.x, y: anchorRect?.y, flip: !seen.flip });
  }
  const nudge = seen.flip ? ANCHOR_NUDGE_PX : 0;
  // RAC's popover role-heuristic misses alertdialog; label the outer role
  // it stamps. Upstream: react-spectrum Popover.mjs querySelector('[role=dialog]').
  const popoverAriaLabelledby =
    modal && title !== undefined ? titleId : ariaLabelledby;
  const popoverAriaLabel = modal ? ariaLabel : undefined;
  return (
    <>
      {portalAnchor}
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
              width: anchorRect.width + nudge,
              height: anchorRect.height,
            }}
          />,
          document.body,
        )}
      {ready && provide(
        <OverlayTriggerStateContext.Provider value={watched}>
          <Popover
            {...rest}
            triggerRef={anchorRect !== undefined ? anchorRef : triggerRef}
            isNonModal={!modal}
            placement={placement}
            offset={offset}
            maxHeight={maxHeight}
            onOpenChange={(open) => {
              if (!open) closedByEscape();
              onOpenChange?.(open);
            }}
            shouldCloseOnInteractOutside={
              shouldCloseOnInteractOutside ?? (modal ? () => false : undefined)
            }
            aria-label={popoverAriaLabel}
            aria-labelledby={popoverAriaLabelledby}
            className={[s.popover, className].filter(Boolean).join(' ')}
            {...appearance}
            data-weasel-overlay=""
          >
            <OverlayArrow className={s.arrow}>
              <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true">
                <path d="M0 0 L6 6 L12 0" />
              </svg>
            </OverlayArrow>
            <CalloutDialog
              modal={modal}
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledby}
              titleId={title !== undefined ? titleId : undefined}
              dialogRef={dialogRef}
            >
              {({ close }) => (
                <>
                  {(title !== undefined || showClose) && (
                    <header className={s.header}>
                      {title !== undefined && (
                        <Heading id={titleId} slot={modal ? 'title' : undefined} className={s.title}>
                          {title}
                        </Heading>
                      )}
                      {showClose && (
                        <CloseButton
                          ariaLabel="Close callout"
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
                        />
                      )}
                    </header>
                  )}
                  <div className={s.body}>{children}</div>
                  {footer !== undefined && <footer className={s.footer}>{footer}</footer>}
                </>
              )}
            </CalloutDialog>
          </Popover>
        </OverlayTriggerStateContext.Provider>
      )}
    </>
  );
}

type CalloutDialogProps = {
  modal: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  /** The heading's id, when there is a heading. */
  titleId?: string;
  dialogRef: (node: HTMLElement | null) => void;
  children: (renderProps: { close: () => void }) => ReactNode;
};

/**
 * React Aria's Dialog contains focus wherever it is mounted: it flips its overlay's FocusScope to `contain`, which
 * would make a non-modal callout pull focus back from every input clicked outside it. So only a modal callout gets
 * one. A non-modal one is a plain `role="dialog"` that, like React Aria's own non-modal popovers, leaves focus where it
 * was when it opens: a callout that opens because of typing elsewhere must not take the next keystroke.
 */
function CalloutDialog({ modal, titleId, dialogRef, children, ...labels }: CalloutDialogProps) {
  const trigger = useContext(OverlayTriggerStateContext);
  if (modal) {
    return (
      <RACDialog role="alertdialog" className={s.dialog} {...labels} ref={dialogRef}>
        {children}
      </RACDialog>
    );
  }
  const labelledby = labels['aria-labelledby'] ?? (labels['aria-label'] === undefined ? titleId : undefined);
  return (
    <section
      role="dialog"
      tabIndex={-1}
      className={s.dialog}
      aria-label={labels['aria-label']}
      aria-labelledby={labelledby}
      ref={dialogRef}
    >
      {children({ close: () => trigger?.close() })}
    </section>
  );
}
