import { parseTokenValue, type ThemeDefinition } from '@weasel-js/theme';
import type { DeriveResult } from '@weasel-js/theme/engine';
import { TokenPanel } from '@weasel-js/ui';
import { useEffect, useRef } from 'react';
import styles from './ThemeEditor.module.css';
import { layerEntries } from './theme/entries';
import { LAYERS, removePin, setPin, type LayerId } from './theme/model';

export interface TokenLayerProps {
  readonly layer: LayerId;
  readonly draft: ThemeDefinition;
  readonly result: DeriveResult;
  /** Tokens click-to-inspect jumped to; the first is scrolled into view. */
  readonly highlight: readonly string[];
  readonly onChange: (next: ThemeDefinition, key: string, label?: string) => void;
}

/** A seed keeps its number-ness: `4` edited to `8` stays a number, not `'8'`. */
const seedValue = (raw: string, previous: unknown) =>
  typeof previous === 'number' && raw.trim() !== '' && Number.isFinite(Number(raw)) ? Number(raw) : raw;

/** Seeds, Components and Pins, edited by token type through weasel-ui's `TokenPanel`. */
export function TokenLayer({ layer, draft, result, highlight, onChange }: TokenLayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const entries = layerEntries(layer, draft, result);
  const label = LAYERS.find((l) => l.id === layer)!.label;

  useEffect(() => {
    const first = highlight[0];
    if (first === undefined) return;
    // A token is a row's group label, and a swatch's in a color family.
    ref.current?.querySelector(`[aria-label="${first}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [highlight]);

  const write = (name: string, value: string | null) => {
    if (layer === 'seeds') {
      if (value === null) return;
      const key = name.slice('seeds.'.length);
      onChange(
        { ...draft, seeds: { ...draft.seeds, [key]: seedValue(value, draft.seeds?.[key]) } },
        `seed:${key}`,
        `Edit ${name}`,
      );
      return;
    }
    if (value === null) {
      onChange(removePin(draft, name), `pin:${name}`, `Reset ${name}`);
      return;
    }
    const token = result.tokens[name];
    onChange(
      setPin(draft, name, {
        value: parseTokenValue(token?.type ?? 'string', value),
        type: token?.type,
        ...(token?.alpha === undefined ? {} : { alpha: token.alpha }),
      }),
      `pin:${name}`,
      `Edit ${name}`,
    );
  };

  if (entries.length === 0) {
    return (
      <p className={styles.empty}>
        {draft.name} has no {label.toLowerCase()}.
      </p>
    );
  }
  return (
    <div ref={ref} className={styles.tableScroll}>
      <TokenPanel tokens={entries} onChange={write} density="tight" />
    </div>
  );
}
