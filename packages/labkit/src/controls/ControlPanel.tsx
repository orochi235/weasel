import { isBuiltinToolPref } from '@weasel-js/core';
import {
  CheckboxRow,
  ColorRow,
  NumberRow,
  type PrefLeaf,
  PropertyGroup,
  PropertyList,
  type PropertyRowLayout,
  PropertyRow,
  SelectRow,
  SliderRow,
  TextRow,
  ToggleRow,
} from '@weasel-js/ui';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { fromConfigFields } from '../config/fromConfigField';
import type { ControlRenderer, ResolvedConfig } from '../config/types';
import { isLeafVisible } from '../config/visible';
import type { ConfigField } from './types';

/** How a panel packs its rows into the two-column property grid.
 *   - `'auto'`: narrow controls (numbers, checkboxes, dropdowns, colours) sit
 *     two per row; the ones that need the width — text, sliders, segmented
 *     toggles — span it.
 *   - `'pairs'`: every row pairs. A control that needs the full width says so
 *     itself, with `<PropertyRow span>`.
 *   - `'one-up'`: one control per row, colours excepted.
 */
export type ControlPack = 'auto' | 'pairs' | 'one-up';

export interface ControlPanelProps<TC extends Record<string, unknown>> {
  /** The instrument's resolved config schema. */
  schema?: ResolvedConfig;
  /** @deprecated Pass `schema`. A field list is adapted into one internally. */
  fields?: ConfigField[];
  config: TC;
  setConfig: (key: keyof TC, value: unknown) => void;
  /**
   * Control overrides and app-defined kinds, PrefsForm-style. Keys are config
   * paths (checked first) or leaf kinds. A renderer returning `null` collapses
   * the row; entries override the built-in rows on collision.
   */
  renderers?: Record<string, ControlRenderer>;
  /** How rows pack into the two-column grid. Defaults to `'pairs'`. */
  pack?: ControlPack;
  /** Where a row's label sits relative to its control. Defaults to `'block'`
   *  — above it, which is what leaves a paired row room for its value. */
  layout?: PropertyRowLayout;
  /** Draw leaves marked `hidden`. */
  showHidden?: boolean;
  className?: string;
}

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
  layout = 'block',
  showHidden = false,
  className,
}: ControlPanelProps<TC>) {
  const resolved = useMemo(() => schema ?? fromConfigFields(fields ?? []), [schema, fields]);

  const paths = Object.keys(resolved.group.children);
  const sectioned = new Set(resolved.sections.flatMap((s) => s.paths));
  const loose = paths.filter((p) => !sectioned.has(p));

  const row = (path: string): ReactNode => (
    <ControlRow
      key={path}
      path={path}
      resolved={resolved}
      config={config}
      setConfig={setConfig}
      renderers={renderers}
      pack={pack}
      layout={layout}
      showHidden={showHidden}
    />
  );

  const gridPack = pack === 'one-up' ? 'auto-color' : 'pairs';
  return (
    <PropertyList
      pack={gridPack}
      className={className ? `lk-control-panel ${className}` : 'lk-control-panel'}
    >
      {loose.map(row)}
      {resolved.sections.map((section) => (
        <PropertyGroup key={section.label} title={section.label} pack={gridPack}>
          {section.paths.map(row)}
        </PropertyGroup>
      ))}
    </PropertyList>
  );
}

interface ControlRowProps<TC extends Record<string, unknown>> {
  path: string;
  resolved: ResolvedConfig;
  config: TC;
  setConfig: (key: keyof TC, value: unknown) => void;
  renderers?: Record<string, ControlRenderer>;
  pack: ControlPack;
  layout: PropertyRowLayout;
  showHidden: boolean;
}

/** Reads a labkit-only extra off a leaf. `PrefLeaf` has no field for these,
 *  and extra keys survive the resolve pass at runtime. */
function extra<T>(leaf: PrefLeaf, key: string): T | undefined {
  return (leaf as unknown as Record<string, T | undefined>)[key];
}

function ControlRow<TC extends Record<string, unknown>>({
  path,
  resolved,
  config,
  setConfig,
  renderers,
  pack,
  layout,
  showHidden,
}: ControlRowProps<TC>) {
  const leaf = resolved.group.children[path] as PrefLeaf | undefined;
  if (!leaf || !('kind' in leaf)) return null;
  if (!isLeafVisible(resolved, path, config as Record<string, unknown>, showHidden)) return null;

  const write = (value: unknown): void => setConfig(path as keyof TC, value);
  const fallback = extra<unknown>(leaf, 'default');
  const value = config[path] ?? fallback;

  // Most specific wins, and within a tier the lab's entry beats the
  // instrument's: controls[path] -> node .render -> controls[kind] -> built-in.
  const custom = renderers?.[path] ?? resolved.renderers[path] ?? renderers?.[leaf.kind];
  // A custom row places itself like any other; one that needs the full width
  // says so with `<PropertyRow span>`, which is the same opt-out a built-in has.
  if (custom) return custom({ path, pref: leaf, value, setValue: write });

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
      const min = extra<number>(leaf, 'min');
      const max = extra<number>(leaf, 'max');
      const step = extra<number>(leaf, 'step');
      if (extra<string>(leaf, 'control') === 'slider' && min !== undefined && max !== undefined) {
        return (
          <SliderRow
            label={label}
            value={read<number>()}
            min={min}
            max={max}
            step={step}
            onChange={write}
            layout={layout}
            span={wide}
            description={description}
          />
        );
      }
      // NumberRow commits every keystroke and does not clamp, so the bounds a
      // schema declares are enforced here — an instrument should never be
      // handed a config value outside the range it asked for.
      const lo = min ?? Number.NEGATIVE_INFINITY;
      const hi = max ?? Number.POSITIVE_INFINITY;
      return (
        <NumberRow
          label={label}
          value={read<number>()}
          min={min}
          max={max}
          step={step}
          onChange={(n) => write(Math.min(hi, Math.max(lo, n)))}
          layout={layout}
          description={description}
        />
      );
    }
    case 'boolean':
      return (
        <CheckboxRow
          label={label}
          value={read<boolean>()}
          onChange={write}
          description={description}
        />
      );
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
          layout={layout}
          span={segmented && wide}
          description={description}
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
          layout={layout}
          span={wide}
          description={description}
        />
      );
    case 'color':
      return (
        <ColorRow label={label} value={read<string>()} onChange={write} description={description} />
      );
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

/** Text writes are debounced so typing does not re-run the instrument on every
 *  keystroke, which means the row is locally controlled between commits and has
 *  to notice when the config changes underneath it. */
function DebouncedTextRow({
  leaf,
  label,
  value,
  write,
  layout,
  span,
  description,
}: {
  leaf: PrefLeaf;
  label: string;
  value: string;
  write: (value: unknown) => void;
  layout?: PropertyRowLayout;
  span?: boolean;
  description?: string;
}) {
  const debounceMs = extra<number>(leaf, 'debounceMs') ?? 150;
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

  return (
    <TextRow
      label={label}
      layout={layout}
      span={span}
      description={description}
      value={local}
      placeholder={extra<string>(leaf, 'placeholder')}
      maxLength={extra<number>(leaf, 'maxLength')}
      onChange={(next) => {
        setLocal(next);
        if (timer.current) clearTimeout(timer.current);
        const commit = () => {
          lastExternal.current = next;
          write(next);
        };
        if (debounceMs === 0) commit();
        else timer.current = setTimeout(commit, debounceMs);
      }}
    />
  );
}
