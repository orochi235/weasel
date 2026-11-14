import type { PrefLeaf } from '@weasel-js/prefs';
import {
  PropertyCaption,
  PropertyRow,
  type PropertyRowLayout,
  RowScope,
} from '@weasel-js/ui/components/Properties';
import { Fragment, type ReactNode } from 'react';
import { valueAtPath } from '../config/path';
import { BareControl, leafValueAt } from './fields';

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

/** The messages of a pair's cells, as one. */
function pairError(
  cells: readonly PairCellSpec[],
  errors: Readonly<Record<string, ReactNode>> | undefined,
): ReactNode {
  const said = cells.filter(({ path }) => errors?.[path] != null);
  if (said.length < 2) return said[0] && errors?.[said[0].path];
  return said.map(({ path }, i) => (
    <Fragment key={path}>
      {i > 0 && ' '}
      {errors?.[path]}
    </Fragment>
  ));
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
  draftConfig,
  errors,
  layout,
  span,
  changed,
}: {
  label: string;
  cells: readonly PairCellSpec[];
  shown: TC;
  setConfig: (path: string, value: unknown) => void;
  draftConfig?: (path: string, value: unknown) => void;
  errors?: Readonly<Record<string, ReactNode>>;
  layout?: PropertyRowLayout;
  span?: boolean;
  changed?: boolean;
}) {
  return (
    <RowScope changed={changed} error={pairError(cells, errors)}>
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
            {leaf.name ? (
              <PropertyCaption className="lk-pair-label">{leaf.name}</PropertyCaption>
            ) : null}
            <BareControl
              leaf={leaf}
              value={leafValueAt(shown, path, leaf)}
              write={(value) => setConfig(path, value)}
              draft={draftConfig && ((value) => draftConfig(path, value))}
              disabled={disabled}
              read={(p) => valueAtPath(shown, p)}
            />
          </span>
        ))}
      </PropertyRow>
    </RowScope>
  );
}
