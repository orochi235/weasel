import type { CSSProperties, ReactNode } from 'react';
import s from './Badge.module.css';
import { SHAPES } from './shapes';
import type { BadgeShape, BadgeTone, BadgeVariant, BadgeSize } from './types';

export interface BadgeProps {
  shape?: BadgeShape;
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  leadingIcon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Badge(props: BadgeProps) {
  const {
    shape = 'pill',
    tone = 'neutral',
    variant = 'outline',
    size = 'sm',
    dot,
    leadingIcon,
    children,
    className,
  } = props;

  const shapeModule = SHAPES[shape];
  const ShapeBody = shapeModule.Component;
  const cls = [s.badge, className].filter(Boolean).join(' ');

  const style = {
    '--badge-inset-top': `${shapeModule.insets.top}px`,
    '--badge-inset-right': `${shapeModule.insets.right}px`,
    '--badge-inset-bottom': `${shapeModule.insets.bottom}px`,
    '--badge-inset-left': `${shapeModule.insets.left}px`,
  } as CSSProperties;

  return (
    <span
      className={cls}
      data-shape={shape}
      data-tone={tone}
      data-variant={variant}
      data-size={size}
      style={style}
    >
      <svg
        className={s.deco}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <ShapeBody variant={variant} focused={false} />
      </svg>
      <span className={s.content}>
        {dot && <span className={s.dot} data-badge-dot />}
        {leadingIcon && <span className={s.icon} aria-hidden="true">{leadingIcon}</span>}
        <span>{children}</span>
      </span>
    </span>
  );
}
