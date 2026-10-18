import type { ReactNode } from 'react';
import { MatrixCell } from './MatrixCell';
import type { MatrixTarget } from './matrixTarget';

/** One crossing of a `ControlMatrix`: a dash where the column has no such setting, nothing where a `showIf`
 *  hides it, and otherwise the cell. */
export function MatrixSlot({
  cell,
  shown,
  value,
  name,
  absent,
  inherited,
  hint,
  canUnpin,
  disabled,
  summary,
  setConfig,
  onOpen,
}: {
  cell: MatrixTarget | undefined;
  shown: boolean;
  value: unknown;
  /** The cell's accessible name: column and row. */
  name: string;
  /** What a column with no such setting says in the cell's place. */
  absent: string;
  inherited: boolean;
  /** Present while the cell inherits: where from. */
  hint?: string;
  canUnpin: boolean;
  disabled: boolean;
  /** What the cell shows of its value, over the built-in reading. */
  summary?: (value: unknown) => ReactNode;
  setConfig: (path: string, value: unknown) => void;
  onOpen: (el: HTMLElement) => void;
}) {
  if (!cell) {
    return (
      <td className="lk-control-matrix__cell is-missing">
        <span role="img" aria-label={absent}>
          —
        </span>
      </td>
    );
  }
  if (!shown) return <td className="lk-control-matrix__cell" />;
  return (
    <td className={inherited ? 'lk-control-matrix__cell is-inherited' : 'lk-control-matrix__cell'}>
      <MatrixCell
        path={cell.at}
        leaf={cell.leaf}
        value={value}
        name={name}
        hint={hint}
        canUnpin={cell.own && canUnpin}
        disabled={disabled}
        summary={summary}
        setConfig={setConfig}
        onOpen={onOpen}
      />
    </td>
  );
}
