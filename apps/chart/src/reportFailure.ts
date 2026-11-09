import { toast } from '@weasel-js/ui/components/Toast';

/** A rejection handler for a command the user started: a toast titled `title`, with the reason, and the error in the console. */
export function reportFailure(title: string): (err: unknown) => void {
  return (err) => {
    console.warn(`weaselchart: ${title}`, err);
    toast.danger(title, { description: err instanceof Error ? err.message : String(err) });
  };
}
