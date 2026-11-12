import { defaultToastQueue, toast } from '@weasel-js/ui/components/Toast';

/** The toast a {@link sessionSaveReporter} raises: its id, and what it says. */
export interface SessionSaveNotice {
  id: string;
  title: string;
  description: string;
}

/**
 * A reporter for each save of a document to the browser's store, to pass as `onSaved`. The first
 * failure of a run raises `notice` as a toast that stays up; the next save that lands takes it down.
 */
export function sessionSaveReporter(notice: SessionSaveNotice): (saved: boolean) => void {
  let failing = false;
  return (saved) => {
    if (saved === !failing) return;
    failing = !saved;
    if (saved) {
      defaultToastQueue.dismiss(notice.id);
      return;
    }
    toast.danger(notice.title, { id: notice.id, description: notice.description, ttlMs: null });
  };
}
