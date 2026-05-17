import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import s from './Badge.module.css';
import { SHAPES, type BadgeShapeParams } from './shapes';
import { BASES, type BadgeBase, type BadgeBaseParams } from './bases';
import { EFFECTS, type EffectSpec } from './effects';
import type { BadgeShape, BadgeTone, BadgeVariant, BadgeSize } from './types';

interface BadgeBaseProps {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  strokeWidth?: number;
  padding?: number | string;
  /** When set, perimeter-pattern shapes (beavis, cloud, postage, scalloped) continuously shift their pattern. */
  crawl?: boolean | number;
  /** Compose-mode: base shape underneath the badge content. When set, overrides the `shape` prop. */
  base?: BadgeBase;
  baseParams?: BadgeBaseParams[BadgeBase];
  /** Compose-mode: layered effects applied around / over the base. */
  effects?: EffectSpec[];
  dot?: boolean;
  leadingIcon?: ReactNode;
  onClick?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  href?: string;
  as?: 'span' | 'button' | 'a';
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}

type BadgePropsByShape = {
  [S in BadgeShape]: BadgeBaseProps & { shape?: S; shapeParams?: BadgeShapeParams[S] };
}[BadgeShape];

export type BadgeProps = BadgePropsByShape;

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
    onRemove,
    removeLabel,
    href,
    children,
    className,
    shapeParams,
    strokeWidth,
    padding,
    crawl,
    base,
    baseParams,
    effects,
  } = props;
  const ariaLabel = props['aria-label'];
  const element = chooseElement(props);
  const [focused, setFocused] = useState(false);
  const [phase, setPhase] = useState(0);
  const shapeModule = SHAPES[shape] ?? SHAPES.pill;
  const resolvedShape = SHAPES[shape] ? shape : 'pill';
  const ShapeBody = shapeModule.Component;
  const params = { ...(shapeModule.defaults ?? {}), ...(shapeParams ?? {}) };

  useEffect(() => {
    if (!crawl) { setPhase(0); return; }
    const speed = typeof crawl === 'number' ? crawl : 0.2;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setPhase((p) => (p + speed * dt) % 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [crawl]);
  const cls = [s.badge, className].filter(Boolean).join(' ');

  // Compose-mode build: when `base` is set, we use the new base/effects pipeline.
  const composeBase = base ? BASES[base] : null;
  const composeBaseParams = composeBase ? { ...(composeBase.defaults ?? {}), ...(baseParams ?? {}) } : null;
  const decoRef = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState({ w: 100, h: 100 });
  useLayoutEffect(() => {
    if (!composeBase) return;
    const svg = decoRef.current;
    if (!svg) return;
    const update = () => {
      const r = svg.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setBox({ w: r.width, h: r.height });
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(svg);
    return () => ro.disconnect();
  }, [composeBase]);

  const sampler = composeBase ? composeBase.build(composeBaseParams, box.w, box.h) : null;

  const insetsSource = composeBase
    ? (typeof composeBase.insets === 'function' ? composeBase.insets(composeBaseParams) : composeBase.insets) ?? { top: 0, right: 0, bottom: 0, left: 0 }
    : (typeof shapeModule.insets === 'function' ? shapeModule.insets(params) : shapeModule.insets);
  const insets = insetsSource;
  const style: CSSProperties = {
    ['--badge-inset-top' as never]: `${insets.top}px`,
    ['--badge-inset-right' as never]: `${insets.right}px`,
    ['--badge-inset-bottom' as never]: `${insets.bottom}px`,
    ['--badge-inset-left' as never]: `${insets.left}px`,
    ...(strokeWidth !== undefined && { ['--badge-stroke-width' as never]: `${strokeWidth}px` }),
    ...(padding !== undefined && { padding: typeof padding === 'number' ? `${padding}px` : padding }),
  };

  const commonProps = {
    className: cls,
    style,
    'data-shape': resolvedShape,
    'data-tone': tone,
    'data-variant': variant,
    'data-size': size,
    'data-focused': focused ? 'true' : undefined,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    'aria-label': ariaLabel,
  };

  const decoSvg = composeBase && sampler ? (
    <svg ref={decoRef} className={s.deco} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={sampler.bodyPath} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={sampler.bodyPath} />}
      {effects?.map((eff, i) => {
        const mod = EFFECTS[eff.type];
        if (!mod) return null;
        const effParams = { ...(mod.defaults ?? {}), ...(eff.params ?? {}) };
        const EffComponent = mod.Component;
        return <EffComponent key={`${eff.type}-${i}`} sampler={sampler} boxW={box.w} boxH={box.h} variant={variant} params={effParams} phase={phase} />;
      })}
    </svg>
  ) : shapeModule.renderMode !== 'css' ? (
    <svg
      className={s.deco}
      viewBox="0 0 100 100"
      preserveAspectRatio={shapeModule.stretches === false ? 'xMidYMid meet' : 'none'}
      aria-hidden="true"
    >
      <ShapeBody variant={variant} focused={focused} params={params} phase={phase} />
    </svg>
  ) : null;

  const inner = (
    <>
      {decoSvg}
      <span className={s.content}>
        {dot && <span className={s.dot} data-badge-dot />}
        {leadingIcon && <span className={s.icon} aria-hidden="true">{leadingIcon}</span>}
        <span>{children}</span>
        {onRemove && (
          <button
            type="button"
            className={s.remove}
            aria-label={removeLabel ?? 'Remove'}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            ×
          </button>
        )}
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
