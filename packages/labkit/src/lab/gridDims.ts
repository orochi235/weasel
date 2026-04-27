export interface GridDims {
  cols: number;
  rows: number;
}

export function gridDims(count: number): GridDims {
  if (count <= 1) return { cols: 1, rows: 1 };
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return { cols, rows };
}
