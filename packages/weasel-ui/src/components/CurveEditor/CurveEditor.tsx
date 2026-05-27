// Placeholder — full implementation in Task 4. Exposes the ControlPoint
// type that setCurveOp depends on.

export interface ControlPoint {
  x: number;
  y: number;
}

export interface CurveEditorProps {
  value: readonly ControlPoint[];
  onChange: (next: ControlPoint[]) => void;
  width: number;
  height: number;
}

export function CurveEditor(_props: CurveEditorProps) {
  return null;
}
