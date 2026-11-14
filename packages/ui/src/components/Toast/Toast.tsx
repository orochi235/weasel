import { useLayoutEffect } from 'react';
import { useKitSettings } from '@weasel-js/react';
import {
  UNSTABLE_ToastRegion as RACToastRegion,
  UNSTABLE_Toast as RACToast,
  UNSTABLE_ToastContent as RACToastContent,
  Text,
  type QueuedToast,
} from 'react-aria-components';
import { useAssignedPortalContainer, useOverlayPortal, type OverlayPortalProps } from '../../overlays/portalHost';
import { useAppearance } from '../appearance';
import { Button, CLOSE_BUTTON_PROPS } from '../Button';
import { defaultToastQueue, racQueueOf, readDefaultTtl, type ToastContent, type ToastQueue } from './queue';
import s from './Toast.module.css';
import './toastViewTransitions.css';
import type {} from '../../kitSettings';

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
      <Button {...CLOSE_BUTTON_PROPS} aria-label="Dismiss notification" onClick={() => racQueueOf(queue).close(t.key)} />
    </RACToast>
  );
}

/**
 * Renders the toast stack for a queue. Mount once, near the app root.
 * From the underlying React Aria region: landmark semantics (keyboard /
 * F6 reachable), screen-reader announcements, and hover pausing the
 * auto-dismiss timers.
 *
 * With no container given, it portals into the nearest themed ancestor, as
 * the other overlays do, so it draws in that root's theme, and sits fixed in a
 * corner of the viewport, since that ancestor is usually a page-tall app root.
 * Given a container, by `portalContainer` or an `OverlayPortalProvider`, the
 * stack renders inside it, absolutely positioned in the container's corner, so
 * the container must be a containing block.
 */
export function ToastRegion(props: ToastRegionProps) {
  const { queue = defaultToastQueue, placement = 'bottom-right', className, portalContainer } = props;
  const assigned = useAssignedPortalContainer(portalContainer);
  const { anchor, provide, ready } = useOverlayPortal(portalContainer);
  const settings = useKitSettings();
  useLayoutEffect(() => readDefaultTtl(queue, () => settings.get('toast.ttlMs')), [queue, settings]);
  const classes = [s.region, placementClass[placement], className];

  const renderToast = (t: QueuedToast<ToastContent>) => <ToastItem toast={t} queue={queue} />;

  const doc = assigned?.ownerDocument;
  const contained = assigned && assigned !== doc?.body && assigned !== doc?.documentElement;
  const region = (
    <RACToastRegion
      queue={racQueueOf(queue)}
      className={[...classes, contained && s.contained].filter(Boolean).join(' ')}
    >
      {({ toast: t }) => renderToast(t)}
    </RACToastRegion>
  );
  return (
    <>
      {anchor}
      {ready && provide(region)}
    </>
  );
}
