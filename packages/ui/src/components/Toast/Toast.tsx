import { useCallback, useLayoutEffect } from 'react';
import { UNSAFE_PortalProvider } from 'react-aria';
import { useKitSettings } from '@weasel-js/react';
import {
  UNSTABLE_ToastRegion as RACToastRegion,
  UNSTABLE_Toast as RACToast,
  UNSTABLE_ToastContent as RACToastContent,
  Text,
  type QueuedToast,
} from 'react-aria-components';
import { useAssignedPortalContainer, type OverlayPortalProps } from '../../overlays/portalHost';
import { useAppearance } from '../appearance';
import { CloseButton } from '../CloseButton';
import { defaultToastQueue, racQueueOf, readDefaultTtl, type ToastContent, type ToastQueue } from './queue';
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

function ToastItem({ toast: t, queue }: { toast: QueuedToast<ToastContent>; queue: ToastQueue }) {
  const { style, ...attrs } = useAppearance({ grade: t.content.grade });
  return (
    <RACToast
      toast={t}
      className={s.toast}
      {...attrs}
      // Inline style is the one sanctioned exception here, beside the grade's
      // custom property: each toast needs a *unique* view-transition-name (so
      // enter/exit/reflow track per-toast), and a class can't mint unique
      // idents. The prefix keeps the ident valid (RAC keys can start with digits).
      style={{ ...style, viewTransitionName: `wzl-toast-${t.key.replace(/[^a-zA-Z0-9_-]/g, '_')}` }}
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
}

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
 * containing block.
 */
export function ToastRegion(props: ToastRegionProps) {
  const { queue = defaultToastQueue, placement = 'bottom-right', className, portalContainer } = props;
  const assigned = useAssignedPortalContainer(portalContainer);
  const settings = useKitSettings();
  useLayoutEffect(() => readDefaultTtl(queue, () => settings.get('toast.ttlMs')), [queue, settings]);
  const classes = [s.region, placementClass[placement], className];

  const renderToast = (t: QueuedToast<ToastContent>) => <ToastItem toast={t} queue={queue} />;

  const doc = assigned?.ownerDocument;
  const contained = assigned && assigned !== doc?.body && assigned !== doc?.documentElement;
  const getContainer = useCallback(() => assigned as HTMLElement, [assigned]);
  const region = (
    <RACToastRegion
      queue={racQueueOf(queue)}
      className={[...classes, contained && s.contained].filter(Boolean).join(' ')}
    >
      {({ toast: t }) => renderToast(t)}
    </RACToastRegion>
  );
  if (assigned === undefined) return region;
  // `null` clears an enclosing provider, so a region given the body is not pulled into an overlay's container.
  return <UNSAFE_PortalProvider getContainer={contained ? getContainer : null}>{region}</UNSAFE_PortalProvider>;
}
