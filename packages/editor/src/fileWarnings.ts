import { toast } from '@weasel-js/ui/components/Toast';

/** How many distinct warnings a toast quotes before it counts the rest. */
const QUOTED = 3;

/** What a file operation did, as a toast's title says it. */
export type FileDeed = 'Opened' | 'Imported' | 'Saved' | 'Exported';

/** What a toast says about what a file could not carry: how many, and the first few once each. */
export function describeFileWarnings(did: FileDeed, warnings: readonly string[]): { title: string; description: string } {
  const distinct = [...new Set(warnings)];
  const quoted = distinct.slice(0, QUOTED);
  const rest = distinct.length - quoted.length;
  return {
    title: distinct.length === 1 ? `${did} with 1 warning` : `${did} with ${distinct.length} warnings`,
    description: [...quoted, ...(rest > 0 ? [`and ${rest} more`] : [])].join('; '),
  };
}

/** Tells the user what a file operation left out, in one toast under `id`: the next one replaces it. Nothing for no warnings. */
export function reportFileWarnings(did: FileDeed, warnings: readonly string[], id: string): void {
  if (warnings.length === 0) return;
  const { title, description } = describeFileWarnings(did, warnings);
  toast.warn(title, { id, description });
}
