/** Font presets the keycap stories offer, keyed by the name the control shows. */
export const FONT_PRESETS: Record<string, string> = {
  'system sans': 'ui-sans-serif, system-ui, sans-serif',
  'system mono': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  'serif':       'ui-serif, Georgia, serif',
  'inter':       'Inter, system-ui, sans-serif',
  'oswald':      "'Oswald', sans-serif",
};

/** The preset names, for a select control. */
export const FONT_OPTIONS = Object.keys(FONT_PRESETS);

/** A preset's font-family, or the value itself when it names no preset. */
export function resolveFont(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return FONT_PRESETS[value] ?? value;
}
