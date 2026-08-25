import { useEffect, useRef, useState } from 'react';
import {
  CheckboxRow,
  ColorRow,
  NumberRow,
  PropertyList,
  SelectRow,
  SliderRow,
  TextRow,
} from '../ui/properties/PropertyPanel';
import type { ConfigField, TextField } from './types';

export interface ControlPanelProps<TC extends Record<string, unknown>> {
  fields: ConfigField[];
  config: TC;
  setConfig: (key: keyof TC, value: unknown) => void;
  className?: string;
}

/** Render an instrument's config schema as a stack of controls, each writing
 *  back through `setConfig`. Built on the property rows, so a lab's controls
 *  are the same aligned, themed rows the rest of the kit uses. */
export function ControlPanel<TC extends Record<string, unknown>>({
  fields,
  config,
  setConfig,
  className,
}: ControlPanelProps<TC>) {
  return (
    <PropertyList className={className ? `lk-control-panel ${className}` : 'lk-control-panel'}>
      {fields.map((field) => (
        <ControlRow key={field.key} field={field} config={config} setConfig={setConfig} />
      ))}
    </PropertyList>
  );
}

interface ControlRowProps<TC extends Record<string, unknown>> {
  field: ConfigField;
  config: TC;
  setConfig: (key: keyof TC, value: unknown) => void;
}

function ControlRow<TC extends Record<string, unknown>>({
  field,
  config,
  setConfig,
}: ControlRowProps<TC>) {
  const write = (value: unknown): void => setConfig(field.key as keyof TC, value);
  const read = <T,>(fallback: T): T => (config[field.key] as T | undefined) ?? fallback;

  switch (field.type) {
    case 'slider':
      return (
        <SliderRow
          label={field.label}
          value={read(field.default)}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={write}
        />
      );
    case 'checkbox':
      return <CheckboxRow label={field.label} value={read(field.default)} onChange={write} />;
    case 'select':
      return (
        <SelectRow
          label={field.label}
          value={read(field.default)}
          options={field.options}
          onChange={write}
        />
      );
    case 'number': {
      // NumberRow commits every keystroke and does not clamp, so the bounds a
      // schema declares are enforced here — an instrument should never be
      // handed a config value outside the range it asked for.
      const lo = field.min ?? Number.NEGATIVE_INFINITY;
      const hi = field.max ?? Number.POSITIVE_INFINITY;
      return (
        <NumberRow
          label={field.label}
          value={read(field.default)}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(n) => write(Math.min(hi, Math.max(lo, n)))}
        />
      );
    }
    case 'text':
      return <DebouncedTextRow field={field} config={config} setConfig={setConfig} />;
    case 'color':
      return <ColorRow label={field.label} value={read(field.default)} onChange={write} />;
    default:
      // A schema can arrive from outside TypeScript, so an unknown type is
      // skipped rather than thrown — one bad field must not blank the panel.
      return null;
  }
}

/** Text writes are debounced so typing does not re-run the instrument on every
 *  keystroke, which means the row is locally controlled between commits and has
 *  to notice when the config changes underneath it. */
function DebouncedTextRow<TC extends Record<string, unknown>>({
  field,
  config,
  setConfig,
}: { field: TextField } & Omit<ControlRowProps<TC>, 'field'>) {
  const debounceMs = field.debounceMs ?? 150;
  const external = (config[field.key] as string | undefined) ?? field.default;
  const [local, setLocal] = useState(external);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExternal = useRef(external);

  useEffect(() => {
    if (external !== lastExternal.current) {
      lastExternal.current = external;
      setLocal(external);
    }
  }, [external]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <TextRow
      label={field.label}
      value={local}
      placeholder={field.placeholder}
      maxLength={field.maxLength}
      onChange={(next) => {
        setLocal(next);
        if (timer.current) clearTimeout(timer.current);
        const commit = () => {
          lastExternal.current = next;
          setConfig(field.key as keyof TC, next);
        };
        if (debounceMs === 0) commit();
        else timer.current = setTimeout(commit, debounceMs);
      }}
    />
  );
}
