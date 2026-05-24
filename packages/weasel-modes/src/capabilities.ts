/** The full vocabulary of capability tags shipped in the default preset.
 *  Apps and other consumers can add their own tags; this list is what
 *  `weasel-modes` itself uses. */
export const ALL_TAGS = [
  'navigation',
  'selection',
  'creates-paths',
  'creates-shapes',
  'creates-text',
  'edits-anchors',
  'edits-text',
  'transforms-selection',
  'samples-color',
  'applies-fill',
  'edits-page',
] as const;

export type CapabilityTag = (typeof ALL_TAGS)[number] | (string & {});

/** Tags that are implicitly allowed in every mode — never listed per-mode.
 *  A tool tagged with any of these is always eligible. */
export const IMPLICIT_TAGS: readonly CapabilityTag[] = ['navigation'];

export function isCapabilityTag(value: string): value is CapabilityTag {
  return (ALL_TAGS as readonly string[]).includes(value);
}
