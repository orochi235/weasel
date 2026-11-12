import { sessionSaveReporter } from '@weasel-js/editor';
import { toast } from '@weasel-js/ui/components/Toast';

/** A rejection handler for a command the user started: a toast titled `title`, with the reason, and the error in the console. */
export function reportFailure(title: string): (err: unknown) => void {
  return (err) => {
    console.warn(`weaselchart: ${title}`, err);
    toast.danger(title, { description: err instanceof Error ? err.message : String(err) });
  };
}

/** Reports each save of the chart to the browser's store, as `useSessionPersistence`'s `onSaved`. */
export const reportChartSave: (saved: boolean) => void = sessionSaveReporter({
  id: 'chart-save-failed',
  title: 'This chart is not being kept in the browser',
  description: 'The browser refused to store it. Use Save to keep a copy as a file.',
});

/** Reports each save of the pipeline to the browser's store, as `useAutosave`'s `onSaved`. */
export const reportPipelineSave: (saved: boolean) => void = sessionSaveReporter({
  id: 'pipeline-save-failed',
  title: 'This pipeline is not being kept in the browser',
  description: 'The browser refused to store it. Use Save to keep a copy as a file.',
});
