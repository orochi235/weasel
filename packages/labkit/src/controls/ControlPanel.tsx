import { getAlpha01, isBuiltinToolPref, toHex8, withAlpha01 } from '@weasel-js/core';
import {
  DialogRow,
  isPrefLeaf,
  ListEditor,
  type PrefGroup,
  type PrefLeaf,
  type PropertyAlign,
  PropertyControl,
  type PropertyControlProps,
  type PropertyDensity,
  PropertyField,
  PropertyGroup,
  PropertyList,
  type PropertyListPack,
  PropertyPanel,
  PropertyRow,
  type PropertyRowLayout,
  prefFieldProps,
  type StanceProps,
} from '@weasel-js/ui';
import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { auto as autoValue } from '../config/auto';
import { resolveAutoConfig } from '../config/autoConfig';
import { fromConfigFields } from '../config/fromConfigField';
import { schemaNodeAtPath, valueAtPath } from '../config/path';
import type { ControlRenderer, ResolvedConfig, SectionSpec } from '../config/types';
import { isLeafVisible } from '../config/visible';
import { summarizeValue } from './inDialog';
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

export interface ControlPanelProps<TC extends Record<string, unknown>> extends StanceProps {
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
  /** Dotted paths currently unpinned. A row in this set hides its control and
   *  reads out `auto`, and clicking its label writes the sentinel back through
   *  `setConfig`. Omitted, the panel keeps the set itself: the labels still
   *  toggle and the sentinel never reaches `setConfig`, which would otherwise
   *  store it as the row's value. */
  auto?: ReadonlySet<string>;
  /** Draw leaves marked `hidden`. */
  showHidden?: boolean;
  /** Heads the panel. With `title`, `stance` or `tone` given, the rows sit in a
   *  `<PropertyPanel>` carrying them; with none, they are the bare list. */
  title?: ReactNode;
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
  title,
  stance,
  tone,
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
        // A nested group is a block of rows, not a control: half of a
        // two-column grid leaves it laying its own rows out inside a cell,
        // which overlaps them.
        span
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
          // A segmented cell carries every choice at once, so a pair holding
          // one needs the whole row the way a segmented row of its own does.
          span={cells.some(({ leaf }) => extra<string>(leaf, 'control') === 'radio')}
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

  const list = (
    <PropertyList
      pack={gridPack}
      density={density}
      align={align}
      className={className ? `lk-control-panel ${className}` : 'lk-control-panel'}
    >
      {body(resolved.group, '', { pack, layout, grid: gridPack })}
    </PropertyList>
  );
  if (title === undefined && stance === undefined && tone === undefined) return list;
  return (
    <PropertyPanel title={title} stance={stance} tone={tone} density={density}>
      {list}
    </PropertyPanel>
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
  // An auto row hides its control, so the word is all the row has to say.
  const autoReadout = isAutoRow ? 'auto' : undefined;
  const autoProps = { auto: isAutoRow, onAutoChange };

  // Most specific wins, and within a tier the lab's entry beats the
  // instrument's: controls[path] -> node .render -> controls[kind] -> built-in.
  const custom = renderers?.[path] ?? resolved.renderers[path] ?? renderers?.[leaf.kind];
  // A custom row places itself like any other; one that needs the full width
  // says so with `<PropertyRow span>`, which is the same opt-out a built-in has.
  if (custom) return custom({ path, pref: leaf, value, setValue: write, auto: isAutoRow, setAuto });

  const label = leaf.name;
  const description = leaf.description;
  // `auto` gives the whole width to the controls that read badly at half of a
  // sidebar's: free text, a slider track, a segmented toggle. `pairs` doesn't.
  const wide = pack === 'auto';
  const row = { label, description, layout, readout: autoReadout, ...autoProps };

  if (leaf.kind === 'list') {
    const entries = Array.isArray(value) ? (value as string[]) : [];
    return (
      <DialogRow
        label={label}
        summary={summarizeValue(entries)}
        readout={autoReadout}
        layout={layout}
        description={description}
        {...autoProps}
      >
        {() => (
          <ListEditor
            aria-label={label}
            value={entries}
            onChange={write}
            placeholder={extra<string>(leaf, 'placeholder')}
          />
        )}
      </DialogRow>
    );
  }

  const field = labField(leaf, value, write);
  if (field === null)
    return <UnwiredRow label={label} kind={leaf.kind} description={description} />;
  switch (field.kind) {
    case 'string':
      return <DebouncedTextRow leaf={leaf} field={field} span={wide} {...row} />;
    case 'number':
      return <PropertyField {...field} {...row} span={field.control === 'slider' && wide} />;
    case 'enum':
      return <PropertyField {...field} {...row} span={field.control === 'radio' && wide} />;
    default:
      return <PropertyField {...field} {...row} />;
  }
}

/**
 * A leaf as the field it draws, with the labkit-only extras `prefFieldProps`
 * knows nothing of. `null` for a kind the panel declines: a paint, which a
 * hex swatch would flatten to a solid, and an object, which a flat row would
 * write one field of. Override with `render` to edit either.
 */
function labField(
  leaf: PrefLeaf,
  value: unknown,
  write: (value: unknown) => void,
): PropertyControlProps | null {
  if (!isBuiltinToolPref(leaf) || leaf.kind === 'paint' || leaf.kind === 'object') return null;
  const field = prefFieldProps(leaf, { value, setValue: write });
  if (field === null) return null;
  switch (field.kind) {
    case 'number':
      // `prefFieldProps` clamps what it stores, so an instrument is never
      // handed a value outside the range it asked for.
      return {
        ...field,
        control: isSliderLeaf(leaf) ? 'slider' : 'input',
        unit: extra<string>(leaf, 'suffix') ?? field.unit,
      };
    case 'boolean':
      return {
        ...field,
        control: extra<string>(leaf, 'control') === 'switch' ? 'switch' : 'checkbox',
      };
    case 'enum':
      return { ...field, control: extra<string>(leaf, 'control') === 'radio' ? 'radio' : 'select' };
    case 'string':
      return {
        ...field,
        placeholder: extra<string>(leaf, 'placeholder'),
        maxLength: extra<number>(leaf, 'maxLength'),
      };
    default:
      return field;
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
  field,
  ...row
}: {
  leaf: PrefLeaf;
  field: PropertyControlProps & { kind: 'string' };
  label: string;
  layout?: PropertyRowLayout;
  span?: boolean;
  description?: string;
  readout?: ReactNode;
  auto?: boolean;
  onAutoChange?: (next: boolean) => void;
}) {
  const text = useDebouncedText(
    field.value ?? '',
    field.onChange,
    extra<number>(leaf, 'debounceMs') ?? 150,
  );
  return <PropertyField {...field} {...row} value={text.local} onChange={text.type} />;
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
 * as a title. For the same reason the row's label does not toggle auto — it
 * names one path, and this row has several.
 */
function PairedRow<TC extends Record<string, unknown>>({
  label,
  cells,
  shown,
  setConfig,
  layout,
  span,
}: {
  label: string;
  cells: readonly PairCellSpec[];
  shown: TC;
  setConfig: (path: string, value: unknown) => void;
  layout?: PropertyRowLayout;
  span?: boolean;
}) {
  return (
    <PropertyRow group span={span} label={label} layout={layout}>
      {cells.map(({ path, leaf }) => (
        // The row is named by the pair, so a cell that shares it says which
        // knob it is — without a caption a paired switch reads only to a
        // screen reader. A cell whose leaf is deliberately unnamed keeps none.
        <span key={path} className="lk-pair-cell" title={leaf.description || undefined}>
          {leaf.name ? <span className="lk-pair-label">{leaf.name}</span> : null}
          <PairCell
            leaf={leaf}
            value={valueAtPath(shown, path) ?? extra<unknown>(leaf, 'default')}
            write={(value) => setConfig(path, value)}
          />
        </span>
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
  const text = useDebouncedText(
    typeof value === 'string' ? value : '',
    write,
    extra<number>(leaf, 'debounceMs') ?? 150,
  );
  const field = labField(leaf, value, write);
  // Unreachable for null: `pairable` admits only kinds with a field.
  if (field === null) return null;
  switch (field.kind) {
    case 'string':
      return (
        <PropertyControl {...field} name={leaf.name} value={text.local} onChange={text.type} />
      );
    case 'number':
      // The pair names the row, so a cell has no room for a unit.
      return <PropertyControl {...field} name={leaf.name} control="input" unit={undefined} />;
    case 'color': {
      // The alpha track needs a row of its own to sit under, so a paired
      // swatch edits the color and carries the stored alpha through untouched.
      const stored = typeof value === 'string' ? toHex8(value) : '#000000';
      return (
        <PropertyControl
          {...field}
          name={leaf.name}
          alpha={undefined}
          onChange={(rgb: string) =>
            write(field.alpha ? withAlpha01(rgb, getAlpha01(stored)) : rgb)
          }
        />
      );
    }
    default:
      return <PropertyControl {...field} name={leaf.name} />;
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
