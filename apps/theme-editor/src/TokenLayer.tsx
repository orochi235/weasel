import { getOwn } from '@weasel-js/registry';
import type { AxisChoice, ThemeDefinition } from '@weasel-js/theme';
import type { DeriveResult } from '@weasel-js/theme/engine';
import { TokenPanel } from '@weasel-js/ui/components/TokenPanel';
import { useEffect, useRef } from 'react';
import styles from './ThemeEditor.module.css';
import { layerEntries } from './theme/entries';
import { LAYERS, keepNumberness, leafAt, tokenValueFromText, removePin, setPin, writeAt, type LayerId } from './theme/model';

export interface TokenLayerProps {
  readonly layer: LayerId;
  readonly draft: ThemeDefinition;
  readonly result: DeriveResult;
  /** The selection `result` was derived at; an edit to a value that varies by axis writes only its branch here. */
  readonly selection: AxisChoice;
  /** Tokens click-to-inspect jumped to; the first is scrolled into view. */
  readonly highlight: readonly string[];
  readonly onChange: (next: ThemeDefinition, key: string, label?: string) => void;
}

/** Seeds, Components and Pins, edited by token type through weasel-ui's `TokenPanel`. */
export function TokenLayer({ layer, draft, result, selection, highlight, onChange }: TokenLayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const entries = layerEntries(layer, draft, result, selection);
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
      const seed = getOwn(draft.seeds ?? {}, key);
      const leaf = keepNumberness(value, leafAt(seed, selection));
      onChange(
        { ...draft, seeds: { ...draft.seeds, [key]: writeAt(seed, selection, leaf) } },
        `seed:${key}`,
        `Edit ${name}`,
      );
      return;
    }
    if (value === null) {
      onChange(removePin(draft, name), `pin:${name}`, `Reset ${name}`);
      return;
    }
    const token = getOwn(result.tokens, name);
    const pin = {
      value: tokenValueFromText(token?.type, value, token?.value),
      type: token?.type,
      ...(token?.alpha === undefined ? {} : { alpha: token.alpha }),
    };
    onChange(
      setPin(draft, name, writeAt(getOwn(draft.pins ?? {}, name), selection, pin)),
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
      <TokenPanel tokens={entries} onChange={write} namePrefix={layer === 'seeds' ? 'seeds.' : ''} />
    </div>
  );
}
