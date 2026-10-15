import { type ReactNode, useState } from 'react';
import { type AnchorField, type AnchorFieldsApi, useAnchorFields } from '@weasel-js/core';
import type { UnitTable } from '@weasel-js/quantity';
import { PropertyField, PropertyList } from '../Properties';

/** How a lone anchor's handles read: as points, or as a turn and a reach from the anchor. */
export type HandleCoords = 'xy' | 'polar';

/** Props for {@link AnchorFields}. */
export interface AnchorFieldsProps {
  /** Units a person may type, each mapped to the factor that turns it into
   *  document units: `{ pt: 1, in: 72, mm: 72 / 25.4 }`. */
  accepts?: Readonly<UnitTable>;
  /** The suffix after each position and length. */
  unit?: ReactNode;
  /** How handles read, held by the caller; the panel's toggle asks to change it through
   *  `onHandleCoordsChange`. Absent, the panel holds it, starting at `defaultHandleCoords`. */
  handleCoords?: HandleCoords;
  onHandleCoordsChange?: (next: HandleCoords) => void;
  /** How handles read first when the panel holds it. Default `'xy'`. */
  defaultHandleCoords?: HandleCoords;
  /** Shown while no anchor is selected in path edit. Default: nothing. */
  emptyState?: ReactNode;
  /** The fields to show and write, in place of the canvas in scope's. */
  fields?: AnchorFieldsApi;
}

const COORD_OPTIONS = [
  { value: 'xy' as const, label: 'X / Y' },
  { value: 'polar' as const, label: 'Angle / length' },
];

const SIDE_LABEL = { in: 'In', out: 'Out' } as const;

/**
 * The anchors selected in path edit, as numbers to read and type: their X and
 * Y, and for a lone anchor each handle's X and Y or angle and length. A field
 * the anchors disagree on reads Mixed; typing a number there moves them all to
 * it, and `+=` or `-=` with an amount moves each by that much. Every entry is
 * one undo step.
 */
export function AnchorFields({
  accepts,
  unit,
  handleCoords,
  onHandleCoordsChange,
  defaultHandleCoords = 'xy',
  emptyState = null,
  fields: given,
}: AnchorFieldsProps) {
  const own = useAnchorFields();
  const { values, write } = given ?? own;
  const [ownCoords, setOwnCoords] = useState<HandleCoords>(defaultHandleCoords);
  const coords = handleCoords ?? ownCoords;
  const setCoords = (next: HandleCoords) => {
    setOwnCoords(next);
    onHandleCoordsChange?.(next);
  };
  if (values.x === undefined) return <>{emptyState}</>;

  const field = (key: AnchorField, label: string, isLength = true) => {
    const value = values[key];
    if (value === undefined) return null;
    return (
      <PropertyField
        key={key}
        kind="number"
        label={label}
        value={value ?? undefined}
        mixed={value === null}
        accepts={isLength ? accepts : undefined}
        unit={isLength ? unit : '°'}
        onChange={(to) => write(key, { to })}
        onOffset={(by) => write(key, { by })}
      />
    );
  };
  const hasHandle = values.inX !== undefined || values.outX !== undefined;
  return (
    <PropertyList>
      {field('x', 'X')}
      {field('y', 'Y')}
      {hasHandle && (
        <PropertyField kind="enum" control="toggle" label="Handles" value={coords} options={COORD_OPTIONS} onChange={setCoords} />
      )}
      {(['in', 'out'] as const).flatMap((side) => (coords === 'xy'
        ? [field(`${side}X`, `${SIDE_LABEL[side]} X`), field(`${side}Y`, `${SIDE_LABEL[side]} Y`)]
        : [field(`${side}Angle`, `${SIDE_LABEL[side]} angle`, false), field(`${side}Length`, `${SIDE_LABEL[side]} length`)]))}
    </PropertyList>
  );
}
