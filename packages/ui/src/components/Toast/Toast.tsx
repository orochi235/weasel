import {
  UNSTABLE_ToastRegion as RACToastRegion,
  UNSTABLE_Toast as RACToast,
  UNSTABLE_ToastContent as RACToastContent,
  Text,
  Button,
} from 'react-aria-components';
import { defaultToastQueue, racQueueOf, type ToastQueue, type ToastTone } from './queue';
import s from './Toast.module.css';

export type ToastPlacement = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface ToastRegionProps {
  /** Queue to render. Defaults to the module-level `defaultToastQueue`. */
  queue?: ToastQueue;
  /** Screen corner for the stack. Default `bottom-right`. */
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
 */
export function ToastRegion(props: ToastRegionProps) {
  const { queue = defaultToastQueue, placement = 'bottom-right', className } = props;
  return (
    <RACToastRegion
      queue={racQueueOf(queue)}
      aria-label="Notifications"
      className={[s.region, placementClass[placement], className].filter(Boolean).join(' ')}
    >
      {({ toast: t }) => (
        <RACToast toast={t} className={[s.toast, toneClass[t.content.tone]].filter(Boolean).join(' ')}>
          <RACToastContent className={s.content}>
            <Text slot="title" className={s.title}>{t.content.title}</Text>
            {t.content.description !== undefined && (
              <Text slot="description" className={s.description}>{t.content.description}</Text>
            )}
          </RACToastContent>
          <Button slot="close" className={s.close} aria-label="Dismiss notification">
            ×
          </Button>
        </RACToast>
      )}
    </RACToastRegion>
  );
}
