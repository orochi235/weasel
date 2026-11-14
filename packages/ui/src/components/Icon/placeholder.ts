import { isDev } from '@weasel-js/react';

/** `core:unknown`'s drawing: a circle with a question mark. Shown in dev where a name resolves to nothing. */
export const PLACEHOLDER_BODY =
  '<circle cx="10" cy="10" r="7.5"/><path d="M 7.5 8 Q 7.5 5.5 10 5.5 Q 12.5 5.5 12.5 8 Q 12.5 9.5 10 11 L 10 12.5" stroke-linecap="round"/><circle cx="10" cy="14.5" r="0.6" fill="currentColor" stroke="none"/>';

const warned = new Set<string>();

/** Warn once per ref, in dev only. */
export function warnMissing(ref: string | undefined): void {
  if (!isDev() || !ref || warned.has(ref)) return;
  warned.add(ref);
  console.warn(`weasel: no icon "${ref}" is registered. Is its package's table in <IconRegistryProvider icons> (or <WeaselProvider icons>), or its variant loaded?`);
}
