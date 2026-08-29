import { isBuiltinToolPref } from '@weasel-js/core';
import type { PrefLeaf } from '@weasel-js/ui';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { fromConfigFields } from '../config/fromConfigField';
import type { ControlRenderer, ResolvedConfig } from '../config/types';
import { isLeafVisible } from '../config/visible';
import { PropertyGroup } from '../ui/properties/PropertyGroup';
import {
  CheckboxRow,
  ColorRow,
  NumberRow,
  PropertyList,
  PropertyRow,
  SelectRow,
  TextRow,
  ToggleRow,
  SliderRow,
} from '../ui/properties/PropertyPanel';
import type { ConfigField } from './types';

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
  showHidden = false,
  className,
}: ControlPanelProps<TC>) {
  const resolved = useMemo(
    () => schema ?? fromConfigFields(fields ?? []),
    [schema, fields],
  );

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
      showHidden={showHidden}
    />
  );

  return (
    <PropertyList className={className ? `lk-control-panel ${className}` : 'lk-control-panel'}>
      {loose.map(row)}
      {resolved.sections.map((section) => (
        <PropertyGroup key={section.label} title={section.label}>
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
  const custom =
    renderers?.[path] ?? resolved.renderers[path] ?? renderers?.[leaf.kind];
  if (custom) return custom({ path, pref: leaf, value, setValue: write });

  const label = leaf.name;
  const read = <T,>(): T => value as T;

  if (!isBuiltinToolPref(leaf)) return <UnwiredRow label={label} kind={leaf.kind} />;

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
        />
      );
    }
    case 'boolean':
      return <CheckboxRow label={label} value={read<boolean>()} onChange={write} />;
    case 'enum': {
      const options = extra<readonly { value: string; label: string }[]>(leaf, 'options') ?? [];
      const Row = extra<string>(leaf, 'control') === 'radio' ? ToggleRow : SelectRow;
      return (
        <Row label={label} value={read<string>()} options={options} onChange={write} />
      );
    }
    case 'string':
      return <DebouncedTextRow leaf={leaf} label={label} value={read<string>()} write={write} />;
    case 'color':
      return <ColorRow label={label} value={read<string>()} onChange={write} />;
    case 'paint':
    case 'object':
      // Declined: a hex swatch would write a solid over a gradient, and a flat
      // row would write one field into a half-built object. Override with
      // `render` to edit either.
      return <UnwiredRow label={label} kind={leaf.kind} />;
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
function UnwiredRow({ label, kind }: { label: string; kind: string }) {
  return (
    <PropertyRow label={label}>
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
}: {
  leaf: PrefLeaf;
  label: string;
  value: string;
  write: (value: unknown) => void;
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
