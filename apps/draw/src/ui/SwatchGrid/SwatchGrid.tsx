import s from './SwatchGrid.module.css';

/** Grid of color swatches.
 *
 *  A `value: null` entry renders as the transparent/"no paint" swatch
 *  (checkerboard + red diagonal). The consumer maps null to whatever
 *  "no fill" / "no stroke" state means in its model. */
export function SwatchGrid(props: {
  value: string | null;
  options: { value: string | null; label?: string }[];
  onChange: (v: string | null) => void;
  /** Alt-target handler — fires on right-click (browser menu suppressed)
   *  AND on shift-click. Used by the Colors panel to route left-click →
   *  fill, right-click / shift-click → stroke. */
  onAltChange?: (v: string | null) => void;
  /** Number of columns in the swatch grid (default 6). */
  columns?: number;
}) {
  const cols = props.columns ?? 6;
  const { onAltChange } = props;
  return (
    <div
      className={s.swatchGrid}
      style={cols === 6 ? undefined : { gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {props.options.map((o, i) => {
        const isNull = o.value === null;
        const active = o.value === props.value;
        return (
          <button
            key={o.value ?? `__null_${i}`}
            type="button"
            className={`${s.swatch}${isNull ? ` ${s.swatchTransparent}` : ''}${active ? ` ${s.swatchActive}` : ''}`}
            style={isNull ? undefined : { background: o.value! }}
            title={o.label ?? (isNull ? 'None' : o.value!)}
            onClick={(e) => {
              if (onAltChange && e.shiftKey) onAltChange(o.value);
              else props.onChange(o.value);
            }}
            onContextMenu={onAltChange ? (e) => { e.preventDefault(); onAltChange(o.value); } : undefined}
          />
        );
      })}
    </div>
  );
}
