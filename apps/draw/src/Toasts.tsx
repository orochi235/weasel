/**
 * Transient on-screen notifications. Used to surface non-fatal events
 * (e.g. SVG parse warnings) that the user should see but that shouldn't
 * block the workflow. Auto-dismisses after a timeout; the close button
 * lets the user dismiss earlier.
 */
import { useEffect } from 'react';
import styles from './Toasts.module.css';

export interface Toast {
  id: number;
  title: string;
  messages: string[];
}

export interface ToastsProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
  /** Auto-dismiss delay in ms. Default 8000. */
  ttlMs?: number;
}

export function Toasts({ toasts, onDismiss, ttlMs = 8000 }: ToastsProps) {
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => setTimeout(() => onDismiss(t.id), ttlMs));
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [toasts, onDismiss, ttlMs]);

  if (toasts.length === 0) return null;
  return (
    <div className={styles.container}>
      {toasts.map((t) => (
        <div key={t.id} className={styles.toast}>
          <div>
            <div className={styles.title}>{t.title}</div>
            {t.messages.length > 0 && (
              <ul className={styles.list}>
                {t.messages.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            )}
          </div>
          <button
            className={styles.close}
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
