import { Children, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { mergeProps, OverlayContainer, useOverlayPosition, useTooltip } from 'react-aria';
import { filterDOMProps } from 'react-aria/filterDOMProps';
import {
  TooltipTrigger as RACTooltipTrigger,
  TooltipContext,
  TooltipTriggerStateContext,
  useContextProps,
  useRenderProps,
  type TooltipProps as RACTooltipProps,
  type TooltipTriggerComponentProps,
  type TooltipTriggerState,
} from 'react-aria-components';
import { targetInBlockUnits } from '../../overlays/blockFrame';
import { frameBoundary, overlayFrameFor, targetInFrame } from '../../overlays/overlayFrame';
import { useEnterAnimation, useExitAnimation } from '../../overlays/overlayAnimation';
import {
  useOverlayPortal,
  useReactAriaPortalTarget,
  type OverlayPortalProps,
  type WithoutPortalTarget,
} from '../../overlays/portalHost';
import { InlineMarkdown } from '../InlineMarkdown';
import s from './Tooltip.module.css';

/** Props for {@link TooltipTrigger}: React Aria's `TooltipTrigger` props, and `keepEscape`. */
export type TooltipTriggerProps = TooltipTriggerComponentProps & {
  /** Every Escape while the tooltip is open only closes it, as one pressed on the trigger does: for help
   *  that describes the focused control from elsewhere. Default false. */
  keepEscape?: boolean;
};

/**
 * TooltipTrigger with kit defaults: ~600 ms open delay, instant close.
 * Wrap a focusable trigger plus a `<Tooltip>`. Non-RAC triggers (plain
 * `<button>`, a `Badge` etc.) must be wrapped in `Focusable` so
 * hover/focus props reach the DOM node.
 *
 * Escape closes an open tooltip. Pressed on its trigger, that is all it does;
 * pressed with focus anywhere else — an editor, the canvas — it also reaches
 * whatever it was pressed in.
 */
export function TooltipTrigger(props: TooltipTriggerProps) {
  const { delay = 600, closeDelay = 0, onOpenChange, keepEscape = false, ...rest } = props;
  const [open, setOpen] = useState(false);
  useEscapePassesThrough(!keepEscape && (props.isOpen ?? open));
  const changed = useCallback((next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  }, [onOpenChange]);
  return <RACTooltipTrigger delay={delay} closeDelay={closeDelay} {...rest} onOpenChange={changed} />;
}

/** Whether keyboard focus is on a tooltip's trigger: the element an open tooltip describes. */
function focusOnTrigger(): boolean {
  const ids = document.activeElement?.getAttribute('aria-describedby');
  return !!ids && ids.split(' ').some((id) => document.getElementById(id)?.getAttribute('role') === 'tooltip');
}

/**
 * While a tooltip is open, react-aria stops every Escape at the document, to close it. This runs at
 * the window, ahead of that, and for an Escape pressed away from the trigger turns the stop into a
 * no-op for that one event: the tooltip still closes, and the key still reaches where it was pressed.
 */
function useEscapePassesThrough(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !focusOnTrigger()) e.stopPropagation = () => {};
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open]);
}

/** Props for {@link Tooltip}, on top of React Aria's `Tooltip` props. */
export type TooltipProps = Omit<WithoutPortalTarget<RACTooltipProps>, 'children' | 'className'> &
  OverlayPortalProps & {
    /** A string is read as inline markdown ({@link InlineMarkdown}), its links drawn as their
     *  labels; an element is drawn as given. */
    children?: ReactNode;
    className?: string;
  };

/**
 * Tooltip bubble with an arrow pointing at the trigger. Non-interactive
 * content only (ARIA tooltip semantics). Use inside `<TooltipTrigger>`.
 *
 * It is placed inside a box drawn at another size as {@link Popover} is: React Aria's own `Tooltip` gives its
 * placement no way to read the trigger or the viewport in the box's px, so this one places itself.
 */
export function Tooltip(props: TooltipProps) {
  const { children, className, placement = 'top', offset = 8, portalContainer, ...rest } = props;
  const { anchor, provide, ready } = useOverlayPortal(portalContainer);
  return (
    <>
      {anchor}
      {ready && provide(
        <TooltipOverlay
          {...rest}
          placement={placement}
          offset={offset}
          className={[s.tooltip, className].filter(Boolean).join(' ')}
        >
          {Children.map(children, (child) =>
            typeof child === 'string' ? <InlineMarkdown text={child} links="text" /> : child,
          )}
        </TooltipOverlay>
      )}
    </>
  );
}

type OverlayProps = Omit<WithoutPortalTarget<RACTooltipProps>, 'children'> & { children: ReactNode };

/** The open state a tooltip reads: its trigger's, unless it is given one of its own. */
function useTooltipState(props: OverlayProps): TooltipTriggerState {
  const fromTrigger = useContext(TooltipTriggerStateContext);
  const [uncontrolled, setUncontrolled] = useState(props.defaultOpen ?? false);
  const isOpen = props.isOpen ?? uncontrolled;
  const { onOpenChange } = props;
  const set = useCallback(
    (open: boolean) => {
      setUncontrolled(open);
      onOpenChange?.(open);
    },
    [onOpenChange],
  );
  if (fromTrigger && props.isOpen == null && props.defaultOpen == null) return fromTrigger;
  return { isOpen, shouldSkipAnimation: false, open: () => set(true), close: () => set(false) };
}

function TooltipOverlay(own: OverlayProps) {
  const [props, ref] = useContextProps(own, undefined, TooltipContext);
  const state = useTooltipState(props);
  const exiting = useExitAnimation(ref, state.isOpen);
  const isExiting = props.isExiting || (!state.shouldSkipAnimation && exiting) || false;
  const container = useReactAriaPortalTarget();
  const frame = useMemo(() => overlayFrameFor(container), [container]);
  if (!state.isOpen && !isExiting) return null;
  return (
    <OverlayContainer portalContainer={frame ?? undefined}>
      <TooltipBody {...props} state={state} tooltipRef={ref} isExiting={isExiting} frame={frame} />
    </OverlayContainer>
  );
}

function TooltipBody({ state, tooltipRef, frame, ...props }: OverlayProps & {
  state: TooltipTriggerState;
  tooltipRef: RefObject<HTMLDivElement | null>;
  /** The overlay frame it is portaled into inside a positioned container, else null. */
  frame: HTMLElement | null;
}) {
  const arrowRef = useRef<HTMLDivElement>(null);
  const getTargetRect = useCallback(
    (target: Element) =>
      frame
        ? targetInFrame(target.getBoundingClientRect(), target, frame)
        : targetInBlockUnits(target.getBoundingClientRect(), tooltipRef.current),
    [tooltipRef, frame],
  );
  const { overlayProps, arrowProps, placement, triggerAnchorPoint } = useOverlayPosition({
    placement: props.placement ?? 'top',
    targetRef: props.triggerRef ?? { current: null },
    overlayRef: tooltipRef,
    arrowRef,
    offset: props.offset,
    crossOffset: props.crossOffset,
    isOpen: state.isOpen,
    arrowBoundaryOffset: props.arrowBoundaryOffset,
    shouldFlip: props.shouldFlip,
    containerPadding: props.containerPadding,
    boundaryElement: frame ? frameBoundary(frame) : undefined,
    onClose: () => state.close(true),
    getTargetRect,
  });
  const entering = useEnterAnimation(tooltipRef, !!placement);
  const isEntering = props.isEntering || (!state.shouldSkipAnimation && entering) || false;
  const renderProps = useRenderProps({
    ...props,
    defaultClassName: 'react-aria-Tooltip',
    values: { placement, isEntering, isExiting: props.isExiting ?? false, state },
  });
  const merged = mergeProps(props, overlayProps);
  const { tooltipProps } = useTooltip(merged, state);
  const style = {
    ...overlayProps.style,
    '--trigger-anchor-point': triggerAnchorPoint ? `${triggerAnchorPoint.x}px ${triggerAnchorPoint.y}px` : undefined,
    ...renderProps.style,
  } as CSSProperties;
  return (
    <div
      {...mergeProps(filterDOMProps(merged, { global: true }), renderProps, tooltipProps)}
      ref={tooltipRef}
      style={style}
      data-weasel-overlay=""
      data-placement={placement ?? undefined}
      data-entering={isEntering || undefined}
      data-exiting={props.isExiting || undefined}
    >
      <Arrow placement={placement} arrowRef={arrowRef} style={arrowProps.style} />
      {renderProps.children}
    </div>
  );
}

/** The arrow, placed by React Aria's arrow props. Not RAC's `OverlayArrow`, which would also take the props of an
 *  enclosing popover's arrow through context. */
function Arrow({ placement, arrowRef, style }: { placement: string | null; arrowRef: RefObject<HTMLDivElement | null>; style?: CSSProperties }) {
  return (
    <div ref={arrowRef} className={s.arrow} data-placement={placement ?? undefined} style={style}>
      <svg width={8} height={8} viewBox="0 0 8 8" aria-hidden="true">
        <path d="M0 0 L4 4 L8 0" />
      </svg>
    </div>
  );
}
