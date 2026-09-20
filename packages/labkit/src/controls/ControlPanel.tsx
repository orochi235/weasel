import { isBuiltinToolPref } from '@weasel-js/core';
import {
  CheckboxRow,
  ColorRow,
  isPrefLeaf,
  NumberRow,
  type PrefGroup,
  type PrefLeaf,
  type PrefNumber,
  type PrefNumberFormat,
  type PrefNumberUnit,
  type PropertyAlign,
  type PropertyDensity,
  PropertyGroup,
  PropertyList,
  type PropertyListPack,
  PropertyRow,
  type PropertyRowLayout,
  prefDisplayBounds,
  Select,
  SelectRow,
  SliderRow,
  Switch,
  SwitchRow,
  TextRow,
  ToggleRow,
} from '@weasel-js/ui';
import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { auto as autoValue } from '../config/auto';
import { resolveAutoConfig } from '../config/autoConfig';
import { fromConfigFields } from '../config/fromConfigField';
import { schemaNodeAtPath, valueAtPath } from '../config/path';
import type { ControlRenderer, ResolvedConfig, SectionSpec } from '../config/types';
import { isLeafVisible } from '../config/visible';
import type { ConfigField } from './types';

/** How a panel packs its rows into the two-column property grid.
 *   - `'auto'`: narrow controls (numbers, checkboxes, dropdowns, colors) sit
 *     two per row; the ones that need the width — text, sliders, segmented
 *     toggles — span it.
 *   - `'pairs'`: every row pairs. A control that needs the full width says so
 *     itself, with `<PropertyRow span>`.
 *   - `'one-up'`: one control per row, colors excepted.
 */
export type ControlPack = 'auto' | 'pairs' | 'one-up';

/** How the rows under one heading are laid out: the panel's, or a section's own. */
interface Rows {
  pack: ControlPack;
  layout: PropertyRowLayout | undefined;
  grid: PropertyListPack;
}

const gridOf = (pack: ControlPack): PropertyListPack =>
  pack === 'one-up' ? 'auto-color' : 'pairs';

function sectionRows(section: SectionSpec, rows: Rows): Rows {
  return {
    pack: section.pack ?? rows.pack,
    layout: section.layout ?? rows.layout,
    grid: section.pack ? gridOf(section.pack) : rows.grid,
  };
}

export interface ControlPanelProps<TC extends Record<string, unknown>> {
  /** The instrument's resolved config schema. */
  schema?: ResolvedConfig;
  /** @deprecated Pass `schema`. A field list is adapted into one internally. */
  fields?: ConfigField[];
  config: TC;
  /** Writes one value. The path is dotted for a leaf inside an `f.group`, and
   *  the bare key for one at the root. */
  setConfig: (path: string, value: unknown) => void;
  /**
   * Control overrides and app-defined kinds, PrefsForm-style. Keys are config
   * paths (checked first) or leaf kinds. A renderer returning `null` collapses
   * the row; entries override the built-in rows on collision.
   */
  renderers?: Record<string, ControlRenderer>;
  /** How rows pack into the two-column grid. Defaults to `'pairs'`. */
  pack?: ControlPack;
  /**
   * Where a row's label sits relative to its control. Unset takes each row's
   * own orientation — `block` (label above, which is what leaves a paired row
   * room for its value) for most, `inline` for colors and checkboxes.
   */
  layout?: PropertyRowLayout;
  /** Room the rows get. Passed straight to the property list. */
  density?: PropertyDensity;
  /** Cross-axis alignment of an inline row's label and control. */
  align?: PropertyAlign;
  /**
   * Fold each section away behind a twisty, starting `'open'` or `'closed'`.
   * Unset draws the heading alone, as the panel always has — unless a section
   * in the schema declares how it opens, which makes that section foldable on
   * its own and outranks this for that one section.
   */
  collapse?: 'open' | 'closed';
  /**
   * Which sections are folded, keyed as `onCollapse` reports them. Given, the
   * panel keeps no state of its own: every toggle arrives at `onCollapse`
   * instead, which is where a lab that remembers a trial's sections writes
   * them.
   */
  collapsed?: Readonly<Record<string, boolean>>;
  /** A fold moved. The key is a section's label — prefixed by its group's
   *  dotted path when the section sits inside one — or a group's own path. */
  onCollapse?: (key: string, collapsed: boolean) => void;
  /** Dotted paths currently unpinned. A row in this set draws ghosted and its
   *  dot reads as auto, and the dot writes the sentinel back through
   *  `setConfig`. Omitted, the panel keeps the set itself: the dots still work
   *  and the sentinel never reaches `setConfig`, which would otherwise store it
   *  as the row's value. */
  auto?: ReadonlySet<string>;
  /** Draw leaves marked `hidden`. */
  showHidden?: boolean;
  className?: string;
}

const NO_AUTO: ReadonlySet<string> = new Set();

/** Render an instrument's config schema as a stack of controls, each writing
 *  back through `setConfig`. Built on the property rows, so a lab's controls
 *  are the same aligned, themed rows the rest of the kit uses. */
export function ControlPanel<TC extends Record<string, unknown>>({
  schema,
  fields,
  config,
  setConfig,
  renderers,
  pack = 'pairs',
  layout,
  density,
  align,
  collapse,
  collapsed,
  onCollapse,
  auto: given,
  showHidden = false,
  className,
}: ControlPanelProps<TC>) {
  const resolved = useMemo(() => schema ?? fromConfigFields(fields ?? []), [schema, fields]);

  // An owner that tracks the set decides what a dot means; one that does not
  // gets a panel that decides for itself, because the alternative is handing it
  // a sentinel it would write into the config as though it were a value.
  const [ownAuto, setOwnAuto] = useState<ReadonlySet<string>>(NO_AUTO);
  const auto = given ?? ownAuto;
  const setRowAuto = (path: string, next: boolean, value: unknown): void => {
    if (given) {
      setConfig(path, next ? autoValue : value);
      return;
    }
    setOwnAuto((prev) => {
      const now = new Set(prev);
      if (next) now.add(path);
      else now.delete(path);
      return now;
    });
    // Pinning keeps whatever the row was showing, the same value the controlled
    // path writes back.
    if (!next) setConfig(path, value);
  };

  // What the instrument is reading. A row draws and reports from this rather
  // than calling its own resolver against the raw config, which would disagree
  // with the instrument whenever a resolver depends on another auto path.
  const shown = useMemo(
    () => (auto && auto.size > 0 ? resolveAutoConfig(resolved, config, auto) : config),
    [resolved, config, auto],
  );

  const listRef = useRef<HTMLDivElement>(null);
  const toggles = useRef(new Map<string, () => void>());
  // Capture phase, because `PropertyRow` is a <label>: a bubbled handler runs
  // after the browser has already begun a range drag or a native control's
  // activation, so the shift-click moves the very value it was meant to unpin.
  useEffect(() => {
    const host = listRef.current;
    if (!host) return;
    const onDown = (e: PointerEvent) => {
      if (!e.shiftKey) return;
      const row = (e.target as HTMLElement | null)?.closest('[data-auto-path]');
      const path = row?.getAttribute('data-auto-path');
      const toggle = path ? toggles.current.get(path) : undefined;
      if (!toggle) return;
      e.preventDefault();
      e.stopPropagation();
      toggle();
    };
    host.addEventListener('pointerdown', onDown, true);
    return () => host.removeEventListener('pointerdown', onDown, true);
  }, []);

  const gridPack = gridOf(pack);
  // A section that declares how it opens is foldable whether or not the lab
  // asked for folds — there is nothing else for the declaration to mean.
  const folds =
    collapse !== undefined ||
    collapsed !== undefined ||
    onCollapse !== undefined ||
    resolved.sections.some((s) => s.collapsed !== undefined);
  const startsFolded = collapse === 'closed';

  const fold = (key: string, declared?: boolean, grid: PropertyListPack = gridPack) => ({
    pack: grid,
    collapsible: folds,
    defaultCollapsed: declared ?? startsFolded,
    collapsed: collapsed ? (collapsed[key] ?? declared ?? startsFolded) : undefined,
    onCollapsedChange: onCollapse ? (next: boolean) => onCollapse(key, next) : undefined,
  });

  /** One node, which is either a group to recurse into or a row to draw. */
  const node = (path: string, rows: Rows): ReactNode => {
    const found = schemaNodeAtPath(resolved.group, path);
    if (!found) return null;
    if (!isLeafVisible(resolved, path, config as Record<string, unknown>, showHidden)) return null;
    if (isPrefLeaf(found)) {
      return (
        <ControlRow
          key={path}
          path={path}
          leaf={found}
          resolved={resolved}
          config={config}
          shown={shown}
          setConfig={setConfig}
          renderers={renderers}
          pack={rows.pack}
          layout={rows.layout}
          auto={auto}
          setRowAuto={setRowAuto}
          toggles={toggles.current}
        />
      );
    }
    // A group with no name organizes without heading it — core's rule for an
    // empty `PrefGroup.name` — so it contributes its rows and no chrome.
    if (found.name === '') return <Fragment key={path}>{body(found, path, rows)}</Fragment>;
    return (
      <PropertyGroup
        key={path}
        title={found.name}
        description={found.description}
        {...fold(path, undefined, rows.grid)}
      >
        {body(found, path, rows)}
      </PropertyGroup>
    );
  };

  /**
   * The leaf at `path` if it may share a row with its neighbours: `pair` is
   * presentational, so a leaf whose control the lab draws itself, or one whose
   * control needs the whole row, keeps its own row instead.
   */
  const pairable = (path: string): { leaf: PrefLeaf; pair: string } | undefined => {
    const found = schemaNodeAtPath(resolved.group, path);
    if (!found || !isPrefLeaf(found)) return undefined;
    const pair = extra<string>(found, 'pair');
    if (pair === undefined) return undefined;
    if (!isLeafVisible(resolved, path, config as Record<string, unknown>, showHidden))
      return undefined;
    if (renderers?.[path] ?? resolved.renderers[path] ?? renderers?.[found.kind]) return undefined;
    if (!isBuiltinToolPref(found)) return undefined;
    if (found.kind === 'paint' || found.kind === 'object' || isSliderLeaf(found)) return undefined;
    return { leaf: found, pair };
  };

  /** A run of sibling paths as rows, merging each run of adjacent leaves
   *  sharing a `pair` id into one row named by the pair. */
  const rowsFor = (paths: readonly string[], rows: Rows): ReactNode[] => {
    const out: ReactNode[] = [];
    for (let i = 0; i < paths.length; ) {
      const head = pairable(paths[i]);
      if (!head) {
        out.push(node(paths[i], rows));
        i += 1;
        continue;
      }
      const { pair } = head;
      const cells = [{ path: paths[i], leaf: head.leaf }];
      let j = i + 1;
      for (; j < paths.length; j += 1) {
        const next = pairable(paths[j]);
        if (!next || next.pair !== pair) break;
        cells.push({ path: paths[j], leaf: next.leaf });
      }
      out.push(
        <PairedRow
          key={paths[i]}
          label={pair}
          cells={cells}
          shown={shown}
          setConfig={setConfig}
          layout={rows.layout}
        />,
      );
      i = j;
    }
    return out;
  };

  /** One group's children: its loose nodes, then its sections. */
  const body = (group: PrefGroup, at: string, rows: Rows): ReactNode => {
    const sections = resolved.sections.filter((s) => s.at === at);
    const sectioned = new Set(sections.flatMap((s) => s.paths));
    const paths = Object.keys(group.children).map((key) => (at === '' ? key : `${at}.${key}`));
    return (
      <>
        {rowsFor(
          paths.filter((p) => !sectioned.has(p)),
          rows,
        )}
        {sections.map((section) => {
          const inner = sectionRows(section, rows);
          return (
            <PropertyGroup
              key={sectionKey(section)}
              title={section.label}
              {...fold(sectionKey(section), section.collapsed, inner.grid)}
            >
              {rowsFor(section.paths, inner)}
            </PropertyGroup>
          );
        })}
      </>
    );
  };

  return (
    <div ref={listRef}>
      <PropertyList
        pack={gridPack}
        density={density}
        align={align}
        className={className ? `lk-control-panel ${className}` : 'lk-control-panel'}
      >
        {body(resolved.group, '', { pack, layout, grid: gridPack })}
      </PropertyList>
    </div>
  );
}

/** How a section is keyed for folding: its label at the root, and its group's
 *  path in front of it anywhere else, so two groups may both have an
 *  `Advanced`. */
function sectionKey(section: SectionSpec): string {
  return section.at === '' ? section.label : `${section.at}.${section.label}`;
}

interface ControlRowProps<TC extends Record<string, unknown>> {
  path: string;
  leaf: PrefLeaf;
  resolved: ResolvedConfig;
  config: TC;
  /** `config` with every auto path resolved -- what the instrument reads. */
  shown: TC;
  setConfig: (path: string, value: unknown) => void;
  renderers?: Record<string, ControlRenderer>;
  pack: ControlPack;
  layout?: PropertyRowLayout;
  auto?: ReadonlySet<string>;
  setRowAuto: (path: string, next: boolean, value: unknown) => void;
  toggles: Map<string, () => void>;
}

/** Whether this leaf draws as a slider, mirroring the condition the `number`
 *  arm below branches on. A slider is the one control whose value cannot be
 *  read off the control itself. */
function isSliderLeaf(leaf: PrefLeaf): boolean {
  return (
    leaf.kind === 'number' &&
    extra<string>(leaf, 'control') === 'slider' &&
    extra<number>(leaf, 'min') !== undefined &&
    extra<number>(leaf, 'max') !== undefined
  );
}

/** Reads a labkit-only extra off a leaf. `PrefLeaf` has no field for these,
 *  and extra keys survive the resolve pass at runtime. */
function extra<T>(leaf: PrefLeaf, key: string): T | undefined {
  return (leaf as unknown as Record<string, T | undefined>)[key];
}

function ControlRow<TC extends Record<string, unknown>>({
  path,
  leaf,
  resolved,
  config,
  shown,
  setConfig,
  renderers,
  pack,
  layout,
  auto,
  setRowAuto,
  toggles,
}: ControlRowProps<TC>) {
  const write = (value: unknown): void => setConfig(path, value);
  const fallback = extra<unknown>(leaf, 'default');
  const pinned = valueAtPath(config, path) ?? fallback;

  const isAutoRow = auto?.has(path) ?? false;
  const canAuto = !extra<boolean>(leaf, 'manual');
  // Read out of the resolved config rather than re-running this leaf's own
  // resolver, so the row reports the value the instrument actually got — the
  // two diverge as soon as a resolver reads another auto path.
  const resolvedValue = isAutoRow ? valueAtPath(shown, path) : undefined;
  // An auto row draws what the resolver decided, not the value underneath it —
  // a handle sitting at the pinned number while the readout says something else
  // reads as a rendering bug. Pinning then keeps what you were looking at.
  const value = resolvedValue ?? pinned;
  const setAuto = (next: boolean): void => setRowAuto(path, next, value);
  const onAutoChange = canAuto ? setAuto : undefined;
  // A slider's handle is a position, not a number, so the readout is the only
  // place its resolved value can be read. Every other control renders its own
  // value, and repeating it there says it twice and wraps the narrow slot.
  const readsItsOwnValue = !isSliderLeaf(leaf);
  // A readout says what the control would say, so it reads in the display
  // unit: a radian in a row that edits degrees is a different number.
  const readoutValue =
    leaf.kind === 'number' && typeof resolvedValue === 'number'
      ? numberField(leaf, resolvedValue).shown
      : resolvedValue;
  const autoReadout = !isAutoRow
    ? undefined
    : resolvedValue === undefined || readsItsOwnValue
      ? 'auto'
      : `auto · ${String(readoutValue)}`;
  const autoProps = { auto: isAutoRow, onAutoChange, 'data-auto-path': canAuto ? path : undefined };

  useEffect(() => {
    if (!canAuto) return;
    toggles.set(path, () => setAuto(!isAutoRow));
    return () => {
      toggles.delete(path);
    };
  });

  // Most specific wins, and within a tier the lab's entry beats the
  // instrument's: controls[path] -> node .render -> controls[kind] -> built-in.
  const custom = renderers?.[path] ?? resolved.renderers[path] ?? renderers?.[leaf.kind];
  // A custom row places itself like any other; one that needs the full width
  // says so with `<PropertyRow span>`, which is the same opt-out a built-in has.
  if (custom) return custom({ path, pref: leaf, value, setValue: write, auto: isAutoRow, setAuto });

  const label = leaf.name;
  const description = leaf.description;
  const read = <T,>(): T => value as T;
  // `auto` gives the whole width to the controls that read badly at half of a
  // sidebar's: free text, a slider track, a segmented toggle. `pairs` doesn't.
  const wide = pack === 'auto';

  if (!isBuiltinToolPref(leaf))
    return <UnwiredRow label={label} kind={leaf.kind} description={description} />;

  switch (leaf.kind) {
    case 'number': {
      const field = numberField(leaf, read<number>());
      const suffix = extra<string>(leaf, 'suffix') ?? field.unit?.suffix;
      const notation = extra<PrefNumberFormat>(leaf, 'format');
      if (isSliderLeaf(leaf)) {
        return (
          <SliderRow
            label={label}
            value={field.shown}
            min={field.min as number}
            max={field.max as number}
            step={field.step}
            notation={notation}
            unit={suffix}
            onChange={(n) => write(field.store(n))}
            readout={autoReadout}
            layout={layout}
            span={wide}
            description={description}
            {...autoProps}
          />
        );
      }
      // NumberRow commits every keystroke and does not clamp, so the bounds a
      // schema declares are enforced here — an instrument should never be
      // handed a config value outside the range it asked for.
      return (
        <NumberRow
          label={label}
          value={field.shown}
          min={field.min}
          max={field.max}
          step={field.step}
          unit={suffix}
          onChange={(n) => write(field.store(n))}
          readout={autoReadout}
          layout={layout}
          description={description}
          {...autoProps}
        />
      );
    }
    case 'boolean': {
      const Row = extra<string>(leaf, 'control') === 'switch' ? SwitchRow : CheckboxRow;
      return (
        <Row
          label={label}
          value={read<boolean>()}
          onChange={write}
          readout={autoReadout}
          layout={layout}
          description={description}
          {...autoProps}
        />
      );
    }
    case 'enum': {
      const options = extra<readonly { value: string; label: string }[]>(leaf, 'options') ?? [];
      const segmented = extra<string>(leaf, 'control') === 'radio';
      const Row = segmented ? ToggleRow : SelectRow;
      return (
        <Row
          label={label}
          value={read<string>()}
          options={options}
          onChange={write}
          readout={autoReadout}
          layout={layout}
          span={segmented && wide}
          description={description}
          {...autoProps}
        />
      );
    }
    case 'string':
      return (
        <DebouncedTextRow
          leaf={leaf}
          label={label}
          value={read<string>()}
          write={write}
          readout={autoReadout}
          layout={layout}
          span={wide}
          description={description}
          {...autoProps}
        />
      );
    case 'color': {
      // `ColorRow` takes alpha as a number beside a `#rrggbb` swatch, so an
      // `#rrggbbaa` value has to be split going in and rejoined coming out —
      // handed whole to the swatch, the browser cannot parse it and the first
      // edit writes back black.
      const common = {
        label,
        readout: autoReadout,
        layout,
        description,
        ...autoProps,
      };
      if (extra<boolean>(leaf, 'alpha') !== true)
        return <ColorRow {...common} value={read<string>()} onChange={write} />;
      const { rgb, alpha } = splitHexAlpha(read<string>());
      return (
        <ColorRow
          {...common}
          value={rgb}
          onChange={(next) => write(joinHexAlpha(next, alpha))}
          alpha={alpha}
          onAlphaChange={(next) => write(joinHexAlpha(rgb, next))}
        />
      );
    }
    case 'paint':
    case 'object':
      // Declined: a hex swatch would write a solid over a gradient, and a flat
      // row would write one field into a half-built object. Override with
      // `render` to edit either.
      return <UnwiredRow label={label} kind={leaf.kind} description={description} />;
    default: {
      // Not reachable while every built-in kind has an arm — and a new kind
      // that lacks one is a compile error here, never a blank row.
      const _exhaustive: never = leaf;
      throw new Error(
        `ControlPanel: no control for built-in pref kind "${(_exhaustive as { kind: string }).kind}"`,
      );
    }
  }
}

/** A leaf this panel has no control for is named rather than dropped: a silent
 *  gap reads as "this control does not exist". */
function UnwiredRow({
  label,
  kind,
  description,
}: {
  label: string;
  kind: string;
  description?: string;
}) {
  return (
    <PropertyRow label={label} description={description}>
      <span className="lk-control-panel__unknown">no control for “{kind}”</span>
    </PropertyRow>
  );
}

/** A text row whose writes are debounced — see {@link useDebouncedText}. */
function DebouncedTextRow({
  leaf,
  label,
  value,
  write,
  layout,
  span,
  description,
  readout,
  auto,
  onAutoChange,
  'data-auto-path': autoPath,
}: {
  leaf: PrefLeaf;
  label: string;
  value: string;
  write: (value: unknown) => void;
  layout?: PropertyRowLayout;
  span?: boolean;
  description?: string;
  readout?: ReactNode;
  auto?: boolean;
  onAutoChange?: (next: boolean) => void;
  'data-auto-path'?: string;
}) {
  const text = useDebouncedText(
    value,
    write as (v: string) => void,
    extra<number>(leaf, 'debounceMs') ?? 150,
  );

  return (
    <TextRow
      label={label}
      readout={readout}
      layout={layout}
      span={span}
      description={description}
      auto={auto}
      onAutoChange={onAutoChange}
      data-auto-path={autoPath}
      value={text.local}
      placeholder={extra<string>(leaf, 'placeholder')}
      maxLength={extra<number>(leaf, 'maxLength')}
      onChange={text.type}
    />
  );
}

/**
 * A number leaf's field in the unit it is edited in: what the control shows,
 * the bounds it shows them against, and what a typed number stores once it is
 * clamped and converted back. Without a `unit` this is what the leaf declares,
 * unchanged.
 */
function numberField(
  leaf: PrefLeaf,
  value: number,
): {
  unit: PrefNumberUnit | undefined;
  min: number | undefined;
  max: number | undefined;
  step: number | undefined;
  shown: number;
  store: (shown: number) => number;
} {
  const unit = extra<PrefNumberUnit>(leaf, 'unit');
  // `min`, `max` and `step` are declared in the stored unit alongside the
  // value, so they convert with it — a leaf storing radians and showing
  // degrees would otherwise clamp typed degrees against 0..6.28.
  const bounds = unit
    ? prefDisplayBounds(leaf as PrefNumber)
    : {
        min: extra<number>(leaf, 'min'),
        max: extra<number>(leaf, 'max'),
        step: extra<number>(leaf, 'step'),
      };
  const lo = bounds.min ?? Number.NEGATIVE_INFINITY;
  const hi = bounds.max ?? Number.POSITIVE_INFINITY;
  return {
    unit,
    min: bounds.min,
    max: bounds.max,
    step: bounds.step,
    shown: unit ? unit.toDisplay(value) : value,
    store: (shown) => {
      const clamped = Math.min(hi, Math.max(lo, shown));
      return unit ? unit.fromDisplay(clamped) : clamped;
    },
  };
}

/** `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` as the `#rrggbb` an
 *  `<input type="color">` can hold and the 0..1 alpha beside it. Anything else
 *  reads as opaque black, which is what the input would show for it anyway. */
function splitHexAlpha(value: string): { rgb: string; alpha: number } {
  const digits = /^#([0-9a-f]{3,8})$/i.exec(value?.trim() ?? '')?.[1];
  const twice = (s: string): string =>
    s
      .split('')
      .map((c) => c + c)
      .join('');
  const byte = (s: string): number => Number.parseInt(s, 16) / 255;
  switch (digits?.length) {
    case 3:
      return { rgb: `#${twice(digits)}`, alpha: 1 };
    case 4:
      return { rgb: `#${twice(digits.slice(0, 3))}`, alpha: byte(twice(digits.slice(3))) };
    case 6:
      return { rgb: `#${digits}`, alpha: 1 };
    case 8:
      return { rgb: `#${digits.slice(0, 6)}`, alpha: byte(digits.slice(6)) };
    default:
      return { rgb: '#000000', alpha: 1 };
  }
}

/** A `#rrggbb` and a 0..1 alpha back into the `#rrggbbaa` the config holds. */
function joinHexAlpha(rgb: string, alpha: number): string {
  const byte = Math.max(0, Math.min(255, Math.round(alpha * 255)));
  return `${rgb}${byte.toString(16).padStart(2, '0')}`;
}

/** One cell of a paired row, with its path and the leaf it draws. */
interface PairCellSpec {
  path: string;
  leaf: PrefLeaf;
}

/**
 * Leaves sharing a `pair` id, side by side on one row the pair names — the
 * compact `X` / `Y` idiom `SelectionPanel` draws for the same annotation.
 *
 * The cells are bare controls: a row holds one label column, so each leaf's
 * own name stays with its control as the accessible name and its description
 * as a title. For the same reason the row carries no pin dot — a dot names one
 * path, and this row has several.
 */
function PairedRow<TC extends Record<string, unknown>>({
  label,
  cells,
  shown,
  setConfig,
  layout,
}: {
  label: string;
  cells: readonly PairCellSpec[];
  shown: TC;
  setConfig: (path: string, value: unknown) => void;
  layout?: PropertyRowLayout;
}) {
  return (
    <PropertyRow group label={label} layout={layout}>
      {cells.map(({ path, leaf }) => (
        <PairCell
          key={path}
          leaf={leaf}
          value={valueAtPath(shown, path) ?? extra<unknown>(leaf, 'default')}
          write={(value) => setConfig(path, value)}
        />
      ))}
    </PropertyRow>
  );
}

/** The control a paired cell holds, without the row chrome a whole row of its
 *  own would bring. */
function PairCell({
  leaf,
  value,
  write,
}: {
  leaf: PrefLeaf;
  value: unknown;
  write: (value: unknown) => void;
}) {
  const name = leaf.name;
  const title = leaf.description;
  const text = useDebouncedText(
    typeof value === 'string' ? value : '',
    write,
    extra<number>(leaf, 'debounceMs') ?? 150,
  );
  switch (leaf.kind) {
    case 'number': {
      const field = numberField(leaf, typeof value === 'number' ? value : 0);
      return (
        <input
          type="number"
          aria-label={name}
          title={title}
          value={field.shown}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (e.target.value !== '' && Number.isFinite(n)) write(field.store(n));
          }}
        />
      );
    }
    case 'boolean':
      return extra<string>(leaf, 'control') === 'switch' ? (
        <Switch aria-label={name} isSelected={value === true} onChange={write} />
      ) : (
        <input
          type="checkbox"
          aria-label={name}
          title={title}
          checked={value === true}
          onChange={(e) => write(e.target.checked)}
        />
      );
    case 'string':
      return (
        <input
          type="text"
          aria-label={name}
          title={title}
          value={text.local}
          placeholder={extra<string>(leaf, 'placeholder')}
          maxLength={extra<number>(leaf, 'maxLength')}
          onChange={(e) => text.type(e.target.value)}
        />
      );
    case 'color': {
      // The alpha track needs a row of its own to sit under, so a paired
      // swatch edits the color and carries the stored alpha through untouched.
      const { rgb, alpha } = splitHexAlpha(typeof value === 'string' ? value : '');
      const carriesAlpha = extra<boolean>(leaf, 'alpha') === true;
      return (
        <input
          type="color"
          aria-label={name}
          title={title}
          value={rgb}
          onChange={(e) =>
            write(carriesAlpha ? joinHexAlpha(e.target.value, alpha) : e.target.value)
          }
        />
      );
    }
    case 'enum': {
      const options = extra<readonly { value: string; label: string }[]>(leaf, 'options') ?? [];
      // `Select` takes no `title`, so the cell's help hangs off a wrapper.
      return (
        <span title={title}>
          <Select<string>
            variant="bare"
            aria-label={name}
            options={options}
            selectedKey={typeof value === 'string' ? value : null}
            onSelectionChange={write}
          />
        </span>
      );
    }
    default:
      // Unreachable: `pairable` admits only the kinds above.
      return null;
  }
}

/**
 * Live text held locally between debounced commits, so typing does not re-run
 * the instrument on every keystroke. Locally controlled between commits, which
 * means it has to notice the value changing underneath it.
 */
function useDebouncedText(
  value: string,
  write: (value: string) => void,
  debounceMs: number,
): { local: string; type: (next: string) => void } {
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExternal = useRef(value);

  useEffect(() => {
    if (value !== lastExternal.current) {
      lastExternal.current = value;
      setLocal(value);
    }
  }, [value]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return {
    local,
    type: (next) => {
      setLocal(next);
      if (timer.current) clearTimeout(timer.current);
      const commit = () => {
        lastExternal.current = next;
        write(next);
      };
      if (debounceMs === 0) commit();
      else timer.current = setTimeout(commit, debounceMs);
    },
  };
}
