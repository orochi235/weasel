import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore, type FocusEvent, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import {
  UNSTABLE_ToastRegion as RACToastRegion,
  UNSTABLE_ToastList as RACToastList,
  UNSTABLE_ToastStateContext as RACToastStateContext,
  UNSTABLE_Toast as RACToast,
  UNSTABLE_ToastContent as RACToastContent,
  Text,
  type QueuedToast,
} from 'react-aria-components';
import { useAssignedPortalContainer, type OverlayPortalProps } from '../../overlays/portalHost';
import { CloseButton } from '../CloseButton';
import { defaultToastQueue, racQueueOf, type ToastContent, type ToastQueue, type ToastTone } from './queue';
import s from './Toast.module.css';
import './toastViewTransitions.css';

/** Corner a toast stack anchors to. */
export type ToastPlacement = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

/** Props for {@link ToastRegion}. */
export interface ToastRegionProps extends OverlayPortalProps {
  /** Queue to render. Defaults to the module-level `defaultToastQueue`. */
  queue?: ToastQueue;
  /** Corner for the stack. Default `bottom-right`. */
  placement?: ToastPlacement;
  className?: string;
}

const placementClass: Record<ToastPlacement, string> = {
  'bottom-right': s.bottomRight,
  'bottom-left': s.bottomLeft,
  'top-right': s.topRight,
  'top-left': s.topLeft,
};

const toneClass: Record<ToastTone, string> = {
  info: s.toneInfo,
  success: s.toneSuccess,
  warning: s.toneWarning,
  error: s.toneError,
};

/**
 * Renders the toast stack for a queue. Mount once, near the app root.
 * From the underlying React Aria region: landmark semantics (keyboard /
 * F6 reachable), screen-reader announcements, and hover pausing the
 * auto-dismiss timers.
 *
 * Unlike the other overlays, a toast region does not follow the nearest
 * themed ancestor, which is usually a page-tall app root: it sits fixed in a
 * corner of the viewport unless it is given a container, by `portalContainer`
 * or an `OverlayPortalProvider`. Given one, the stack renders inside it,
 * absolutely positioned in the container's corner, so the container must be a
 * containing block. A contained region is not an F6 landmark; its toasts
 * announce, dismiss and pause the same way.
 */
export function ToastRegion(props: ToastRegionProps) {
  const { queue = defaultToastQueue, placement = 'bottom-right', className, portalContainer } = props;
  const assigned = useAssignedPortalContainer(portalContainer);
  const classes = [s.region, placementClass[placement], className];

  const renderToast = (t: QueuedToast<ToastContent>) => (
    <RACToast
      toast={t}
      className={[s.toast, toneClass[t.content.tone]].filter(Boolean).join(' ')}
      // Inline style is the one sanctioned exception here: each toast
      // needs a *unique* view-transition-name (so enter/exit/reflow
      // track per-toast), and a class can't mint unique idents. The
      // prefix keeps the ident valid (RAC keys can start with digits).
      style={{ viewTransitionName: `wzl-toast-${t.key.replace(/[^a-zA-Z0-9_-]/g, '_')}` }}
    >
      <RACToastContent className={s.content}>
        <Text slot="title" className={s.title}>{t.content.title}</Text>
        {t.content.description !== undefined && (
          <Text slot="description" className={s.description}>{t.content.description}</Text>
        )}
      </RACToastContent>
      <CloseButton ariaLabel="Dismiss notification" onClick={() => racQueueOf(queue).close(t.key)} />
    </RACToast>
  );

  const doc = assigned?.ownerDocument;
  if (assigned && assigned !== doc?.body && assigned !== doc?.documentElement) {
    return (
      <ContainedRegion
        queue={queue}
        container={assigned}
        className={[...classes, s.contained].filter(Boolean).join(' ')}
      >
        {renderToast}
      </ContainedRegion>
    );
  }
  return (
    <RACToastRegion
      queue={racQueueOf(queue)}
      aria-label="Notifications"
      className={classes.filter(Boolean).join(' ')}
    >
      {({ toast: t }) => renderToast(t)}
    </RACToastRegion>
  );
}

interface ContainedRegionProps {
  queue: ToastQueue;
  container: Element;
  className: string;
  children: (toast: QueuedToast<ToastContent>) => ReactElement;
}

/**
 * React Aria's region always portals to `document.body`: its one override is a
 * provider this package does not import (`overlays/portalHost.tsx` says why).
 * So a contained stack builds its own region around RAC's exported list and
 * state context, keeping every region behavior that does not need a landmark.
 */
function ContainedRegion({ queue, container, className, children }: ContainedRegionProps) {
  const rac = racQueueOf(queue);
  const subscribe = useCallback((fn: () => void) => rac.subscribe(fn), [rac]);
  const snapshot = useCallback(() => rac.visibleToasts, [rac]);
  const visibleToasts = useSyncExternalStore(subscribe, snapshot, snapshot);
  const state = useMemo(
    () => ({
      visibleToasts,
      add: rac.add.bind(rac),
      close: rac.close.bind(rac),
      pauseAll: rac.pauseAll.bind(rac),
      resumeAll: rac.resumeAll.bind(rac),
    }),
    [rac, visibleToasts],
  );

  const hovered = useRef(false);
  const focused = useRef(false);
  const lastFocused = useRef<HTMLElement | null>(null);
  const updateTimers = () => (hovered.current || focused.current ? rac.pauseAll() : rac.resumeAll());
  const setHovered = (on: boolean) => {
    hovered.current = on;
    updateTimers();
  };
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    if (focused.current) return;
    focused.current = true;
    lastFocused.current = e.relatedTarget instanceof HTMLElement ? e.relatedTarget : null;
    updateTimers();
  };
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
    focused.current = false;
    lastFocused.current = null;
    updateTimers();
  };

  // Focus that moved into the stack goes back where it came from once the last toast closes.
  useEffect(() => {
    if (visibleToasts.length > 0) return;
    focused.current = false;
    if (lastFocused.current?.isConnected) lastFocused.current.focus();
    lastFocused.current = null;
  }, [visibleToasts.length]);

  if (visibleToasts.length === 0) return null;
  return createPortal(
    <RACToastStateContext.Provider value={state}>
      <div
        role="region"
        aria-label="Notifications"
        tabIndex={-1}
        // Keeps the stack reachable while a modal hides everything outside itself, as RAC's region does.
        data-react-aria-top-layer="true"
        className={className}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <RACToastList<ToastContent> className={s.list}>{({ toast: t }) => children(t)}</RACToastList>
      </div>
    </RACToastStateContext.Provider>,
    container,
  );
}
