const MODE_DISPLAY: Record<string, string> = {
  'path-edit': 'Path Edit',
  'isolation': 'Isolation',
  'text-edit': 'Text Edit',
  'free-transform': 'Free Transform',
  'crop': 'Crop',
};

/** Human-readable name for a mode id; unknown ids show as themselves. */
export function modeDisplayName(modeId: string): string {
  return MODE_DISPLAY[modeId] ?? modeId;
}
