import { useState, type ReactNode, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
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
  onClick?: () => void;
  href?: string;
  as?: 'span' | 'button' | 'a';
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}

function chooseElement(props: BadgeProps): 'span' | 'button' | 'a' {
  if (props.as) return props.as;
  if (props.href) return 'a';
  if (props.onClick) return 'button';
  return 'span';
}

export function Badge(props: BadgeProps) {
  const {
    shape = 'pill',
    tone = 'neutral',
    variant = 'outline',
    size = 'sm',
    dot,
    leadingIcon,
    onClick,
    href,
    children,
    className,
  } = props;
  const ariaLabel = props['aria-label'];
  const element = chooseElement(props);
  const [focused, setFocused] = useState(false);
  const shapeModule = SHAPES[shape];
  const ShapeBody = shapeModule.Component;
  const cls = [s.badge, className].filter(Boolean).join(' ');

  const style: CSSProperties = {
    ['--badge-inset-top' as never]: `${shapeModule.insets.top}px`,
    ['--badge-inset-right' as never]: `${shapeModule.insets.right}px`,
    ['--badge-inset-bottom' as never]: `${shapeModule.insets.bottom}px`,
    ['--badge-inset-left' as never]: `${shapeModule.insets.left}px`,
  };

  const commonProps = {
    className: cls,
    style,
    'data-shape': shape,
    'data-tone': tone,
    'data-variant': variant,
    'data-size': size,
    'data-focused': focused ? 'true' : undefined,
    onFocus: () => flushSync(() => setFocused(true)),
    onBlur: () => flushSync(() => setFocused(false)),
    'aria-label': ariaLabel,
  };

  const inner = (
    <>
      <svg className={s.deco} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <ShapeBody variant={variant} focused={focused} />
      </svg>
      <span className={s.content}>
        {dot && <span className={s.dot} data-badge-dot />}
        {leadingIcon && <span className={s.icon} aria-hidden="true">{leadingIcon}</span>}
        <span>{children}</span>
      </span>
    </>
  );

  if (element === 'button') {
    return (
      <button type="button" {...commonProps} onClick={onClick}>
        {inner}
      </button>
    );
  }
  if (element === 'a') {
    return (
      <a href={href} {...commonProps} onClick={onClick}>
        {inner}
      </a>
    );
  }
  return <span {...commonProps}>{inner}</span>;
}
