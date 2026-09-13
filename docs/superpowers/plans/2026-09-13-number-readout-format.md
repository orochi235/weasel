# Number Readout Formats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a number pref name a display format (`plain` or `compact`), so a slider readout shows `2.0M`, reads a typed `2.5m` back, and is never too narrow for its own values.

**Architecture:** The format is plain data on core's `ToolPrefNumber`. weasel-ui owns formatting and parsing (`format/number.ts`) and applies them in `SliderRow`'s readout, which also publishes its widest value as a CSS custom property. labkit adds a builder method and passes the leaf's format to `SliderRow`. Spec: `docs/superpowers/specs/2026-09-13-number-readout-format-design.md`.

**Tech Stack:** TypeScript, React, CSS modules, Vitest + Testing Library (projects `weasel-ui`, `labkit`).

Commands run from the worktree root. Typecheck is `npx tsc --noEmit` from the root.

---

### Task 1: The format type in core

**Files:**
- Modify: `packages/core/src/tools/prefs.ts` (types beside `ToolPrefNumberControl`, and `ToolPrefNumber`)
- Modify: `packages/core/src/tools/index.ts` (type export list)
- Modify: `packages/ui/src/components/Prefs/schema.ts`, `packages/ui/src/components/Prefs/index.ts` (re-export as `PrefNumberFormat`)

- [ ] **Step 1: Add the type and the field**

```ts
/** How a schema-driven UI should show a number pref's value. `compact`
 *  abbreviates from a thousand up, as in `2.0M`. */
export type ToolPrefNumberFormat = 'plain' | 'compact';
```

and on `ToolPrefNumber`: `format?: ToolPrefNumberFormat;`. Export it from `tools/index.ts`; re-export it from `schema.ts` as `ToolPrefNumberFormat as PrefNumberFormat` and from `Prefs/index.ts` as `type PrefNumberFormat`.

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`, expected clean.

### Task 2: `formatCompact` and `parseNumber`

**Files:**
- Modify: `packages/ui/src/format/number.ts`, `packages/ui/src/index.ts` (export both)
- Test: `packages/ui/src/format/number.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
describe('formatCompact', () => {
  it('keeps the given precision below a thousand', () => {
    expect(formatCompact(0)).toBe('0');
    expect(formatCompact(950)).toBe('950');
    expect(formatCompact(2.5, 1)).toBe('2.5');
  });

  it('abbreviates from a thousand up, at one decimal', () => {
    expect(formatCompact(1000)).toBe('1.0K');
    expect(formatCompact(40_000)).toBe('40.0K');
    expect(formatCompact(2_000_000)).toBe('2.0M');
    expect(formatCompact(12_345_678)).toBe('12.3M');
  });

  it('rolls over into the next magnitude rather than printing 1000.0K', () => {
    expect(formatCompact(999_950)).toBe('1.0M');
  });

  it('signs a negative with U+2212', () => {
    expect(formatCompact(-1500)).toBe('−1.5K');
  });
});

describe('parseNumber', () => {
  it('reads what parseSignedNumber reads', () => {
    expect(parseNumber('−42')).toBe(-42);
    expect(parseNumber('-3.5')).toBe(-3.5);
  });

  it('reads a magnitude suffix in either case, without float noise', () => {
    expect(parseNumber('2.5m')).toBe(2_500_000);
    expect(parseNumber('40K')).toBe(40_000);
    expect(parseNumber('1.1k')).toBe(1100);
    expect(parseNumber(formatCompact(-1500))).toBe(-1500);
  });

  it('reads thousands commas only in the thousands shape', () => {
    expect(parseNumber('40,000')).toBe(40_000);
    expect(parseNumber('2,5')).toBeNaN();
  });

  it('is NaN for empty text and for text that names no number', () => {
    expect(parseNumber('')).toBeNaN();
    expect(parseNumber('  ')).toBeNaN();
    expect(parseNumber('k')).toBeNaN();
    expect(parseNumber('abc')).toBeNaN();
  });
});
```

- [ ] **Step 2: Run to fail** — `npx vitest run --project=weasel-ui packages/ui/src/format/number.test.ts`, expected FAIL (not exported).

- [ ] **Step 3: Implement**

```ts
/** Powers of ten a typed magnitude suffix stands for. */
const EXPONENTS: Record<string, number> = { k: 3, m: 6, b: 9, t: 12 };

/**
 * Formats a number the way a `compact` readout shows it: below 1,000 at
 * `decimals` places, from 1,000 up at one decimal with a magnitude suffix
 * (`40.0K`, `2.0M`). Always `en-US`, so {@link parseNumber} reads it back.
 */
export function formatCompact(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return formatNumber(value);
  const options: Intl.NumberFormatOptions =
    Math.abs(value) < 1000
      ? { useGrouping: false, minimumFractionDigits: decimals, maximumFractionDigits: decimals }
      : { notation: 'compact', minimumFractionDigits: 1, maximumFractionDigits: 1 };
  return value.toLocaleString('en-US', options).replace(/^-/, MINUS_SIGN);
}

/**
 * Reads a typed number: anything {@link parseSignedNumber} reads, plus
 * thousands commas in the `40,000` shape and a `k`/`m`/`b`/`t` suffix in either
 * case (`2.5m` is 2,500,000). Empty text is NaN rather than zero.
 */
export function parseNumber(text: string): number {
  let t = text.trim().replace(MINUS_SIGN, '-');
  const exponent = EXPONENTS[t.slice(-1).toLowerCase()];
  if (exponent !== undefined) t = t.slice(0, -1).trimEnd();
  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d*)?$/.test(t)) t = t.replace(/,/g, '');
  if (!/\d/.test(t)) return Number.NaN;
  // Scaled through the exponent rather than by multiplying: 1.1 * 1000 is 1100.0000000000002.
  return Number(exponent === undefined ? t : `${t}e${exponent}`);
}
```

- [ ] **Step 4: Run to pass**, same command.
- [ ] **Step 5: Commit** — `git add packages/core/src/tools packages/ui/src/components/Prefs packages/ui/src/format packages/ui/src/index.ts`, subject `name a compact number format, and parse what it prints`.

### Task 3: `SliderRow` notation, typed suffixes, and a readout that fits

**Files:**
- Modify: `packages/ui/src/components/Properties/PropertyPanel.tsx` (`SliderRowProps`, `SliderRow`, `EditableReadout`)
- Modify: `packages/ui/src/components/Properties/Properties.module.css` (`.readoutInput` width)
- Test: `packages/ui/src/components/Properties/PropertyPanel.test.tsx` (`describe('SliderRow')`)

- [ ] **Step 1: Write the failing tests**

```tsx
it('shows a compact notation and reads a typed suffix back', () => {
  const onChange = vi.fn();
  render(
    <SliderRow label="Glyphs" value={2_000_000} min={0} max={2_000_000} step={1000}
      notation="compact" onChange={onChange} />,
  );
  const readout = screen.getByRole('textbox');
  expect(readout).toHaveValue('2.0M');
  fireEvent.focus(readout);
  fireEvent.change(readout, { target: { value: '2.5k' } });
  fireEvent.blur(readout);
  expect(onChange).toHaveBeenCalledWith(2500);
});

it('reverts an empty readout instead of committing zero', () => {
  const onChange = vi.fn();
  render(<SliderRow label="Op" value={10} min={0} max={100} onChange={onChange} />);
  const readout = screen.getByRole('textbox');
  fireEvent.focus(readout);
  fireEvent.change(readout, { target: { value: '' } });
  fireEvent.blur(readout);
  expect(onChange).not.toHaveBeenCalled();
});

it('publishes the widest value its range can show', () => {
  render(<SliderRow label="Op" value={5} min={0} max={200_000} onChange={() => {}} />);
  // jsdom does no layout, so this reads the custom property the width is taken from.
  expect(
    screen.getByRole('textbox').style.getPropertyValue('--wzl-property-readout-fit'),
  ).toBe('6ch');
});
```

- [ ] **Step 2: Run to fail** — `npx vitest run --project=weasel-ui packages/ui/src/components/Properties/PropertyPanel.test.tsx`.

- [ ] **Step 3: Implement**

`SliderRowProps` gains `notation?: PrefNumberFormat` (type import from `../Prefs/schema`), documented as "A named display for the value; `format` wins when both are given." `SliderRow` destructures it and builds its default format as `notation === 'compact' ? (n) => formatCompact(n, decimals) : <the existing formatNumber call>`.

In `EditableReadout`, replace `parseSignedNumber(draft)` with `parseNumber(draft)`, and give the input its widest value:

```tsx
const text = (n: number) => {
  const formatted = fmt(n);
  return typeof formatted === 'string' ? formatted : String(formatted);
};
const fit = Math.max(text(min).length, text(max).length);
// …on the <input>:
style={{ '--wzl-property-readout-fit': `${fit}ch` } as CSSProperties}
```

In `.readoutInput`:

```css
width: max(var(--wzl-property-readout-w, calc(5em - 24px)), var(--wzl-property-readout-fit, 0px));
```

- [ ] **Step 4: Run to pass**, same command.
- [ ] **Step 5: Check the width in a browser** — the `SliderRow` story with `max={200000}` and with `notation="compact"`; every digit visible, and a 0–100 row no wider than before.
- [ ] **Step 6: Commit** — subject `let a slider readout show a compact notation, read suffixes, and fit its values`.

### Task 4: labkit builder and `ControlPanel`

**Files:**
- Modify: `packages/labkit/src/config/types.ts` (`Annotations.format`)
- Modify: `packages/labkit/src/config/builder.ts` (`NumberNode.format`)
- Modify: `packages/labkit/src/controls/ControlPanel.tsx` (`case 'number'`)
- Test: `packages/labkit/src/config/builder.test.ts`, `packages/labkit/src/controls/ControlPanel.test.tsx`

- [ ] **Step 1: Write the failing tests**

```ts
it('annotates a number with a display format', () => {
  expect(f.number(0).format('compact').annotations.format).toBe('compact');
});
```

```tsx
describe('<ControlPanel> format', () => {
  it('shows a slider readout in the format the leaf declares', () => {
    render(
      <ControlPanel
        schema={resolveConfigSchema(
          f.schema({ glyphs: f.number(0).range(0, 2_000_000).format('compact') }),
          [],
        )}
        config={{ glyphs: 2_000_000 }}
        setConfig={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue('2.0M')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to fail** — `npx vitest run --project=labkit packages/labkit/src/config/builder.test.ts packages/labkit/src/controls/ControlPanel.test.tsx`.

- [ ] **Step 3: Implement**

```ts
// types.ts, in Annotations
/** How a number's value is shown. `compact` abbreviates from a thousand up. */
format?: PrefNumberFormat;

// builder.ts, in NumberNode
/** Show the value in a named format — `'compact'` reads `2.0M`. Presentation
 *  only: the stored value stays a plain number, and a typed `2.5m` reads back. */
format(format: PrefNumberFormat): this {
  return this.ann({ format });
}
```

In `ControlPanel`'s `case 'number'`: `const notation = extra<PrefNumberFormat>(leaf, 'format');` and pass `notation={notation}` to `SliderRow`.

- [ ] **Step 4: Run to pass**, same command.
- [ ] **Step 5: Commit** — subject `give labkit number leaves a display format`.

### Task 5: Changeset and verification

- [ ] **Step 1:** `.changeset/number-readout-format.md`, `patch` for `@weasel-js/core`, `@weasel-js/ui` and `@weasel-js/labkit`, in the prose register of the existing changesets.
- [ ] **Step 2:** `npx tsc --noEmit`, `npm run lint`, `npx vitest run --project=weasel-ui --project=labkit`, `npm run check:bumps`.
- [ ] **Step 3: Commit**, then merge `readout-format` into `main` and delete this plan in the merge.
