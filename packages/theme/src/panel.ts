/**
 * The vocabulary of panel stances, and the slots a theme styles a panel with.
 *
 * A panel's look reads `--wzl-panel-<slot>`, which a theme declares. A stanced
 * panel reads `--wzl-panel-<stance>-<slot>` first, and a nested one
 * `--wzl-panel-<stance>-nested-<slot>` before that, each falling back to the
 * next — so a theme declares only the slots where a stance differs, and every
 * other name here is read, with its fallback, and declared by nothing.
 */

/** What kind of content a panel holds — a class of content, never a position. */
export const PANEL_STANCES = [
  'scope',
  'aside',
  'advanced',
  'debug',
  'danger',
  'notice',
  'important',
  'preview',
] as const;

export type PanelStance = (typeof PANEL_STANCES)[number];

/** One styleable property of a panel. */
export interface PanelSlot {
  readonly name: string;
  /** The CSS property it drives, for tooling. */
  readonly drives: string;
  /** A stanced panel's fallback when neither the stance nor the theme's stance slot sets it; absent, the base slot. */
  readonly stanced?: string;
  /** Read only under a stance: the base panel has no such property. */
  readonly stanceOnly?: boolean;
}

export const PANEL_SLOTS: readonly PanelSlot[] = [
  { name: 'surface', drives: 'background' },
  { name: 'border-color', drives: 'border-color' },
  { name: 'border-style', drives: 'border-style' },
  { name: 'border-width', drives: 'border-width' },
  { name: 'radius', drives: 'border-radius' },
  { name: 'pad', drives: 'padding' },
  { name: 'blur', drives: 'backdrop-filter' },
  { name: 'tone-mix', drives: 'how much of the tone mixes into the surface' },
  { name: 'tone', drives: 'the tone used when the panel names none', stanceOnly: true },
  // Only a panel that names its own tone recolors its controls.
  { name: 'accent', drives: 'the accent the controls inside a panel with a tone take; unset, the tone' },
  // A stanced title takes the row-label recipe rather than the display title.
  { name: 'title-font', drives: 'font-family', stanced: 'var(--wzl-font-display)' },
  { name: 'title-weight', drives: 'font-weight', stanced: 'var(--wzl-font-weight-light)' },
  { name: 'title-size', drives: 'font-size', stanced: 'var(--wzl-font-size-sm)' },
  { name: 'title-case', drives: 'text-transform', stanced: 'var(--wzl-params-label-case, uppercase)' },
  {
    name: 'title-tracking',
    drives: 'letter-spacing',
    stanced: 'var(--wzl-params-label-tracking, var(--wzl-tracking-wide))',
  },
  { name: 'title-color', drives: 'color', stanced: 'var(--wzl-fg-muted)' },
  { name: 'title-inset', drives: 'the title’s padding' },
];

/** Every stance-slot name, `--wzl-`-prefixed, nested variants included. */
export function panelStanceSlotNames(): string[] {
  return PANEL_STANCES.flatMap((stance) =>
    PANEL_SLOTS.flatMap((slot) => [`--wzl-panel-${stance}-${slot.name}`, `--wzl-panel-${stance}-nested-${slot.name}`]),
  );
}
