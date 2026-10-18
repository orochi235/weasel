import type { PrefLeaf } from '@weasel-js/prefs';
import {
  type PropertyControlProps,
  PropertyField,
  PropertyRow,
  type PropertyRowLayout,
} from '@weasel-js/ui';
import type { ReactNode } from 'react';
import { BareControl, leafValueAt, useDebouncedText, useTextWaitMs } from './fields';

/** A leaf this panel has no control for is named rather than dropped: a silent
 *  gap reads as "this control does not exist". */
export function UnwiredRow({
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
export function DebouncedTextRow({
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
  // The lab's policy leaves text live, so its writer is `onInput`.
  const text = useDebouncedText(
    field.value ?? '',
    field.onInput ?? field.onChange,
    useTextWaitMs(leaf),
  );
  return <PropertyField {...field} {...row} value={text.local} onInput={text.type} />;
}

/** One cell of a paired row, with its path and the leaf it draws. */
export interface PairCellSpec {
  path: string;
  leaf: PrefLeaf;
  disabled: boolean;
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
export function PairedRow<TC extends Record<string, unknown>>({
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
    <PropertyRow
      group
      span={span}
      label={label}
      layout={layout}
      disabled={cells.every((cell) => cell.disabled)}
    >
      {cells.map(({ path, leaf, disabled }) => (
        // The row is named by the pair, so a cell that shares it says which
        // knob it is — without a caption a paired switch reads only to a
        // screen reader. A cell whose leaf is deliberately unnamed keeps none.
        <span key={path} className="lk-pair-cell" title={leaf.description || undefined}>
          {leaf.name ? <span className="lk-pair-label">{leaf.name}</span> : null}
          <BareControl
            leaf={leaf}
            value={leafValueAt(shown, path, leaf)}
            write={(value) => setConfig(path, value)}
            disabled={disabled}
          />
        </span>
      ))}
    </PropertyRow>
  );
}
