import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export type BadgeTone = 'default' | 'accent' | 'muted' | 'success' | 'warn' | 'danger';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = 'default', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn('lk-badge', tone !== 'default' && `lk-badge--${tone}`, className)}
      {...rest}
    />
  );
}
