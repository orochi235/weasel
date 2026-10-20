import type { PrefGroup, PrefKind, PrefLeaf } from '@weasel-js/prefs';

/** A row label on any params surface: PropertyRow's and SelectionPanel's, and labkit's paired cell. */
const LABEL = '[class*="rowLabel"], .lk-pair-label';
/** Controls whose value is their own text rather than a text node inside them. */
const TEXT_CONTROL = 'input:not([type="checkbox"], [type="radio"], [type="range"], [type="color"], [type="hidden"]), textarea, select';

export interface TextSize {
  /** What the text says, to name it in a failure. */
  readonly text: string;
  readonly size: string;
}

export interface RowText {
  /** The row's label text. */
  readonly label: string;
  readonly labelSize: string;
  /** Every other run of text in the row a reader sees, at its computed size. */
  readonly values: readonly TextSize[];
}

/** Titles inside a compound row head its parts; they are not its value. */
const HEADING = 'h1, h2, h3, h4, h5, h6, legend, [role="heading"]';

/** Drawn, and in no box clipped to the 1px a visually hidden element keeps: a native select behind a custom one. */
const shown = (el: Element) => {
  if (getComputedStyle(el).visibility === 'hidden') return false;
  for (let at: Element | null = el; at; at = at.parentElement) {
    if (getComputedStyle(at).display === 'contents') continue;
    const box = at.getBoundingClientRect();
    if (box.width <= 1 || box.height <= 1) return false;
  }
  return true;
};

const skipped = (el: Element) => el.closest('[data-wzl-subordinate]') !== null || el.closest(HEADING) !== null || !shown(el);

/**
 * Every row under `root`, with the size its label's text is set at and the size of each other run of text in
 * it. A mark inside `[data-wzl-subordinate]` is left out: a unit, a stepper glyph, a hint, which are smaller
 * than the value on purpose. So is a heading inside a compound row.
 */
export function rowTexts(root: ParentNode): RowText[] {
  const out: RowText[] = [];
  for (const label of root.querySelectorAll(LABEL)) {
    if (skipped(label)) continue;
    const row = label.parentElement!;
    const values: TextSize[] = [];
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement!;
      const text = node.textContent?.trim() ?? '';
      if (text === '' || skipped(el)) continue;
      values.push({ text, size: getComputedStyle(el).fontSize });
    }
    for (const control of row.querySelectorAll(TEXT_CONTROL)) {
      if (skipped(control)) continue;
      const text = (control as HTMLInputElement).value || control.getAttribute('aria-label') || control.tagName;
      values.push({ text, size: getComputedStyle(control).fontSize });
    }
    out.push({ label: label.textContent?.trim() ?? '', labelSize: getComputedStyle(label).fontSize, values });
  }
  return out;
}

/** Each run of text that is not at its row label's size, as `label → text: size (label size)`. */
export function mismatches(rows: readonly RowText[]): string[] {
  return rows.flatMap((r) =>
    r.values.filter((v) => v.size !== r.labelSize).map((v) => `${r.label} → ${v.text}: ${v.size} (label ${r.labelSize})`),
  );
}

/** Each label or value not at `size`. */
export function notAt(rows: readonly RowText[], size: string): string[] {
  return rows.flatMap((r) => [
    ...(r.labelSize === size ? [] : [`label ${r.label}: ${r.labelSize}`]),
    ...r.values.filter((v) => v.size !== size).map((v) => `${r.label} → ${v.text}: ${v.size}`),
  ]);
}

/**
 * One or more leaves of every built-in kind, each control a kind offers drawn once. A `Record` over
 * {@link PrefKind}, so a kind added to the union does not compile until it is drawn here too.
 */
export const LEAVES_BY_KIND: Record<PrefKind, Record<string, PrefLeaf>> = {
  number: {
    count: { kind: 'number', name: 'Count', description: '', default: 4 },
    gain: { kind: 'number', name: 'Gain', description: '', default: 3, min: 0, max: 10, control: 'slider' },
    x: { kind: 'number', name: 'X', description: '', default: 1, pair: { with: 'y', label: 'Offset' } },
    y: { kind: 'number', name: 'Y', description: '', default: 2 },
  },
  boolean: {
    visible: { kind: 'boolean', name: 'Visible', description: '', default: true },
    snap: { kind: 'boolean', name: 'Snap', description: '', default: false, control: 'switch' },
    bold: { kind: 'boolean', name: 'Bold', description: '', default: false, control: 'toggle' },
  },
  string: {
    title: { kind: 'string', name: 'Title', description: '', default: 'Untitled' },
    notes: { kind: 'string', name: 'Notes', description: '', default: 'Two words', control: 'textarea' },
  },
  enum: Object.fromEntries(
    (['select', 'toggle', 'radio', 'menu'] as const).map((control) => [
      `mode_${control}`,
      {
        kind: 'enum',
        name: `Mode ${control}`,
        description: '',
        default: 'fill',
        control,
        options: [
          { value: 'fill', label: 'Fill' },
          { value: 'fit', label: 'Fit' },
        ],
      } satisfies PrefLeaf,
    ]),
  ),
  color: { tint: { kind: 'color', name: 'Tint', description: '', default: '#336699' } },
  paint: { ground: { kind: 'paint', name: 'Ground', description: '', default: '#cc8844' } },
  object: {
    margin: {
      kind: 'object',
      name: 'Margin',
      description: '',
      default: { top: 1, side: 'a' },
      children: {
        top: { kind: 'number', name: 'Top', description: '', default: 1 },
        side: { kind: 'string', name: 'Side', description: '', default: 'a' },
      },
    },
  },
  list: {
    phases: {
      kind: 'list',
      name: 'Phases',
      description: '',
      default: [0.5, 2],
      item: { kind: 'number', name: 'Phase', description: '', default: 1 },
    },
  },
  map: {
    limits: {
      kind: 'map',
      name: 'Limits',
      description: '',
      default: { studio: 8 },
      item: { kind: 'number', name: 'Limit', description: '', default: 4 },
    },
  },
  union: {
    ramp: {
      kind: 'union',
      name: 'Ramp',
      description: '',
      tag: 'type',
      default: { type: 'linear', angle: 90 },
      variants: {
        linear: {
          kind: 'object',
          name: 'Linear',
          description: '',
          default: { angle: 90 },
          children: { angle: { kind: 'number', name: 'Angle', description: '', default: 90 } },
        },
      },
    },
  },
  field: { source: { kind: 'field', name: 'Source', description: '', default: 'count' } },
  action: { reset: { kind: 'action', name: 'Defaults', description: '', default: undefined, label: 'Reset', run: () => {} } },
  actions: { tools: { kind: 'actions', name: 'Tools', description: '', default: undefined, group: 'tools' } },
  alias: { also: { kind: 'alias', name: 'Also count', description: '', default: undefined, of: 'count' } },
  label: { note: { kind: 'label', name: 'A line of words', description: '', default: undefined } },
  separator: { rule: { kind: 'separator', name: '', description: '', default: undefined } },
};

/** {@link LEAVES_BY_KIND} as one group, every leaf at the root. */
export const EVERY_KIND: PrefGroup = {
  name: 'Every kind',
  children: Object.assign({}, ...Object.values(LEAVES_BY_KIND)) as PrefGroup['children'],
};
