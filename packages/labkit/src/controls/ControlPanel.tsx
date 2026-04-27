import { useEffect, useRef, useState } from 'react';
import type {
  CheckboxField,
  ColorField,
  ConfigField,
  NumberField,
  SelectField,
  SliderField,
  TextField,
} from './types';

export interface ControlPanelProps<TC extends Record<string, unknown>> {
  fields: ConfigField[];
  config: TC;
  setConfig: (key: keyof TC, value: unknown) => void;
  className?: string;
}

export function ControlPanel<TC extends Record<string, unknown>>({
  fields,
  config,
  setConfig,
  className,
}: ControlPanelProps<TC>) {
  return (
    <div className={className ? `lk-control-panel ${className}` : 'lk-control-panel'}>
      {fields.map((field) => (
        <ControlRow key={field.key} field={field} config={config} setConfig={setConfig} />
      ))}
    </div>
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
  switch (field.type) {
    case 'slider':
      return <SliderRow field={field} config={config} setConfig={setConfig} />;
    case 'checkbox':
      return <CheckboxRow field={field} config={config} setConfig={setConfig} />;
    case 'select':
      return <SelectRow field={field} config={config} setConfig={setConfig} />;
    case 'number':
      return <NumberRow field={field} config={config} setConfig={setConfig} />;
    case 'text':
      return <TextRow field={field} config={config} setConfig={setConfig} />;
    case 'color':
      return <ColorRow field={field} config={config} setConfig={setConfig} />;
    default:
      return null;
  }
}

type RowProps<F extends ConfigField, TC extends Record<string, unknown>> = {
  field: F;
  config: TC;
  setConfig: (key: keyof TC, value: unknown) => void;
};

function SliderRow<TC extends Record<string, unknown>>({
  field,
  config,
  setConfig,
}: RowProps<SliderField, TC>) {
  const value = (config[field.key] as number | undefined) ?? field.default;
  return (
    <div className="lk-control-row">
      <label className="lk-control-label" htmlFor={`lk-ctrl-${field.key}`}>
        {field.label}
      </label>
      <div className="lk-control-slider-row">
        <input
          id={`lk-ctrl-${field.key}`}
          className="lk-control-input lk-control-input--range"
          type="range"
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          value={value}
          onChange={(e) => setConfig(field.key as keyof TC, Number(e.target.value))}
        />
        <span className="lk-control-slider-value">{value}</span>
      </div>
    </div>
  );
}

function CheckboxRow<TC extends Record<string, unknown>>({
  field,
  config,
  setConfig,
}: RowProps<CheckboxField, TC>) {
  const value = (config[field.key] as boolean | undefined) ?? field.default;
  return (
    <div className="lk-control-row lk-control-row--inline">
      <input
        id={`lk-ctrl-${field.key}`}
        className="lk-control-input lk-control-input--checkbox"
        type="checkbox"
        checked={value}
        onChange={(e) => setConfig(field.key as keyof TC, e.target.checked)}
      />
      <label className="lk-control-label" htmlFor={`lk-ctrl-${field.key}`}>
        {field.label}
      </label>
    </div>
  );
}

function SelectRow<TC extends Record<string, unknown>>({
  field,
  config,
  setConfig,
}: RowProps<SelectField, TC>) {
  const value = (config[field.key] as string | undefined) ?? field.default;
  return (
    <div className="lk-control-row">
      <label className="lk-control-label" htmlFor={`lk-ctrl-${field.key}`}>
        {field.label}
      </label>
      <select
        id={`lk-ctrl-${field.key}`}
        className="lk-control-input"
        value={value}
        onChange={(e) => setConfig(field.key as keyof TC, e.target.value)}
      >
        {field.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberRow<TC extends Record<string, unknown>>({
  field,
  config,
  setConfig,
}: RowProps<NumberField, TC>) {
  const value = (config[field.key] as number | undefined) ?? field.default;
  return (
    <div className="lk-control-row">
      <label className="lk-control-label" htmlFor={`lk-ctrl-${field.key}`}>
        {field.label}
      </label>
      <input
        id={`lk-ctrl-${field.key}`}
        className="lk-control-input"
        type="number"
        value={value}
        min={field.min}
        max={field.max}
        step={field.step}
        onChange={(e) => setConfig(field.key as keyof TC, Number(e.target.value))}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          let clamped = n;
          if (field.min !== undefined && clamped < field.min) clamped = field.min;
          if (field.max !== undefined && clamped > field.max) clamped = field.max;
          if (clamped !== n) setConfig(field.key as keyof TC, clamped);
        }}
      />
    </div>
  );
}

function TextRow<TC extends Record<string, unknown>>({
  field,
  config,
  setConfig,
}: RowProps<TextField, TC>) {
  const debounceMs = field.debounceMs ?? 150;
  const initial = (config[field.key] as string | undefined) ?? field.default;
  const [local, setLocal] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExternal = useRef(initial);

  useEffect(() => {
    const ext = (config[field.key] as string | undefined) ?? field.default;
    if (ext !== lastExternal.current) {
      lastExternal.current = ext;
      setLocal(ext);
    }
  }, [config, field.key, field.default]);

  return (
    <div className="lk-control-row">
      <label className="lk-control-label" htmlFor={`lk-ctrl-${field.key}`}>
        {field.label}
      </label>
      <input
        id={`lk-ctrl-${field.key}`}
        className="lk-control-input"
        type="text"
        value={local}
        placeholder={field.placeholder}
        maxLength={field.maxLength}
        onChange={(e) => {
          const next = e.target.value;
          setLocal(next);
          if (timer.current) clearTimeout(timer.current);
          if (debounceMs === 0) {
            lastExternal.current = next;
            setConfig(field.key as keyof TC, next);
          } else {
            timer.current = setTimeout(() => {
              lastExternal.current = next;
              setConfig(field.key as keyof TC, next);
            }, debounceMs);
          }
        }}
      />
    </div>
  );
}

function ColorRow<TC extends Record<string, unknown>>({
  field,
  config,
  setConfig,
}: RowProps<ColorField, TC>) {
  const value = (config[field.key] as string | undefined) ?? field.default;
  return (
    <div className="lk-control-row lk-control-row--inline">
      <label className="lk-control-label" htmlFor={`lk-ctrl-${field.key}`}>
        {field.label}
      </label>
      <input
        id={`lk-ctrl-${field.key}`}
        className="lk-control-input lk-control-input--color"
        type="color"
        value={value}
        onChange={(e) => setConfig(field.key as keyof TC, e.target.value)}
      />
    </div>
  );
}
