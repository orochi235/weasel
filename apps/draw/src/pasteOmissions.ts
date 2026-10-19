import type { PasteOmission } from '@weasel-js/core';
import { toast } from '@weasel-js/ui/components/Toast';

const REASON: Record<PasteOmission['reason'], string> = {
  'dependency-not-copied': 'A shape that follows other shapes needs them copied with it.',
  'derivation-not-registered': 'A shape built from other shapes cannot be rebuilt in this document.',
  'container-not-pasted': 'A shape inside one that was left out is left out too.',
};

/** What a toast says about the shapes a paste left out: how many, and each reason once. */
export function describePasteOmissions(omitted: readonly PasteOmission[]): { title: string; description: string } {
  const n = omitted.length;
  const reasons = [...new Set(omitted.map((o) => o.reason))];
  return {
    title: n === 1 ? '1 shape was not pasted' : `${n} shapes were not pasted`,
    description: reasons.map((r) => REASON[r]).join(' '),
  };
}

/** Tells the user a paste left shapes out. One toast: the next paste's replaces it. */
export function reportPasteOmissions(omitted: PasteOmission[]): void {
  const { title, description } = describePasteOmissions(omitted);
  toast.warning(title, { id: 'paste-omitted', description });
}
