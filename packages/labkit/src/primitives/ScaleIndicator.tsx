export interface ScaleIndicatorProps {
  /** Current view zoom factor (1 = no zoom). */
  zoom: number;
  /** World pixels per unit at zoom=1. */
  pixelsPerUnit: number;
  /** Unit label (e.g., 'ft', 'm', 'px'). */
  unit: string;
  /** Target bar width in display pixels. Default: 100. */
  targetWidth?: number;
}

// Rounds n to a "nice" number — 1, 2, 5, 10, 20, 50, ...
function niceNumber(n: number): number {
  if (n <= 0) return 1;
  const exp = Math.floor(Math.log10(n));
  const fraction = n / 10 ** exp;
  let nice: number;
  if (fraction < 1.5) nice = 1;
  else if (fraction < 3.5) nice = 2;
  else if (fraction < 7.5) nice = 5;
  else nice = 10;
  return nice * 10 ** exp;
}

export function ScaleIndicator({ zoom, pixelsPerUnit, unit, targetWidth = 100 }: ScaleIndicatorProps) {
  const effectivePxPerUnit = pixelsPerUnit * zoom;
  const targetUnits = targetWidth / effectivePxPerUnit;
  const niceUnits = niceNumber(targetUnits);
  const barWidth = niceUnits * effectivePxPerUnit;
  return (
    <div className="lk-scale-indicator" aria-label={`Scale: ${niceUnits} ${unit}`}>
      <div className="lk-scale-indicator-bar" style={{ width: `${barWidth}px` }} />
      <span className="lk-scale-indicator-label">
        {niceUnits} {unit}
      </span>
    </div>
  );
}
