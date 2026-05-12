import type { ReactNode } from 'react';
import type { BooleansAdapter, UseBooleansReturn } from '@orochi235/weasel';
import {
  UnionIcon,
  IntersectIcon,
  SubtractIcon,
  ExcludeIcon,
  DivideIcon,
} from './pathfinderIcons';
import s from './PathfinderPanel.module.css';

export type PathfinderOp =
  | 'union' | 'intersect' | 'subtract' | 'exclude' | 'divide';

export type PathfinderIcons = Partial<Record<PathfinderOp, ReactNode>>;

export interface PathfinderPanelProps {
  adapter: Pick<BooleansAdapter, 'getSelection' | 'getWorldPath'>;
  actions: UseBooleansReturn;
  icons?: PathfinderIcons;
  orientation?: 'horizontal' | 'vertical';
  labels?: Partial<Record<PathfinderOp, string>>;
  className?: string;
}

const OPS: readonly PathfinderOp[] = [
  'union', 'intersect', 'subtract', 'exclude', 'divide',
] as const;

const DEFAULT_LABELS: Record<PathfinderOp, string> = {
  union: 'Union',
  intersect: 'Intersect',
  subtract: 'Subtract',
  exclude: 'Exclude',
  divide: 'Divide',
};

const DEFAULT_ICONS: Record<PathfinderOp, ReactNode> = {
  union: <UnionIcon />,
  intersect: <IntersectIcon />,
  subtract: <SubtractIcon />,
  exclude: <ExcludeIcon />,
  divide: <DivideIcon />,
};

export function PathfinderPanel(props: PathfinderPanelProps) {
  const { actions, icons, orientation = 'horizontal', labels, className } = props;
  const cls = [s.panel, orientation === 'vertical' && s.vertical, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} role="toolbar" aria-label="Pathfinder operations">
      {OPS.map((op) => {
        const label = labels?.[op] ?? DEFAULT_LABELS[op];
        const icon = icons?.[op] ?? DEFAULT_ICONS[op];
        return (
          <button
            key={op}
            type="button"
            data-testid={`pathfinder-op-${op}`}
            aria-label={label}
            title={label}
            className={s.button}
            onClick={() => actions[op]()}
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}
