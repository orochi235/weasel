import type { ReactNode } from 'react';
import s from './Badge.module.css';
import { SHAPES } from './shapes';
import type { BadgeShape, BadgeTone, BadgeVariant, BadgeSize } from './types';

export interface BadgeProps {
  shape?: BadgeShape;
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
  className?: string;
}

export function Badge(props: BadgeProps) {
  const {
    shape = 'pill',
    tone = 'neutral',
    variant = 'outline',
    size = 'sm',
    children,
    className,
  } = props;

  const shapeModule = SHAPES[shape];
  const ShapeBody = shapeModule.Component;
  const cls = [s.badge, className].filter(Boolean).join(' ');

  return (
    <span
      className={cls}
      data-shape={shape}
      data-tone={tone}
      data-variant={variant}
      data-size={size}
    >
      <svg
        className={s.deco}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <ShapeBody variant={variant} focused={false} />
      </svg>
      <span className={s.content}>{children}</span>
    </span>
  );
}
