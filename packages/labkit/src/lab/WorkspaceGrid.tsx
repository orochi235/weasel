import { Children, type CSSProperties, type ReactNode } from 'react';
import { gridDims } from './gridDims';

export interface WorkspaceGridProps {
  children: ReactNode;
}

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
