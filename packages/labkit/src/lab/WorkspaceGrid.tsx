import { Children, type CSSProperties, type ReactNode } from 'react';
import { gridDims } from './gridDims';

/** Props for `<WorkspaceGrid>`. */
export interface WorkspaceGridProps {
  children: ReactNode;
}

/** Lays its children out in the most nearly square grid that fits them. */
export function WorkspaceGrid({ children }: WorkspaceGridProps) {
  const count = Children.count(children);
  const { cols, rows } = gridDims(count);
  const style = {
    '--lk-grid-cols': String(cols),
    '--lk-grid-rows': String(rows),
  } as CSSProperties;
  return (
    <div className="lk-workspace-grid" style={style}>
      {children}
    </div>
  );
}
