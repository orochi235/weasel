import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import s from './Badge.module.css';
import { SHAPES, type BadgeShapeParams } from './shapes';
import { BASES, type BadgeBase, type BadgeBaseParams } from './bases';
import { EFFECTS, type EffectSpec, type BadgeEffect } from './effects';
import type { BadgeShape, BadgeTone, BadgeVariant, BadgeSize } from './types';

interface BadgeBaseProps {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  strokeWidth?: number;
  padding?: number | string;
  /**
   * For CSS-rendered shapes (pill, plain) that fragment across line wraps, controls how the
   * background/border behaves at each break.
   * - `'slice'` (default): decoration is severed at the break (looks like one continuous badge cut by the line).
   * - `'clone'`: each fragment paints its own complete decoration (looks like two separate badges).
   */
  breakStyle?: 'slice' | 'clone';
  /** When set, perimeter-pattern shapes (beavis, cloud, postage, scalloped) continuously shift their pattern. */
  crawl?: boolean | number;
  /** Compose-mode: base shape underneath the badge content. When set, overrides the `shape` prop. */
  base?: BadgeBase;
  baseParams?: BadgeBaseParams[BadgeBase];
  /** Compose-mode: layered effects applied around / over the base. */
  effects?: EffectSpec[];
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
    onClick,
    onRemove,
    removeLabel,
    href,
    children,
    className,
    shapeParams,
    strokeWidth,
    padding,
    breakStyle,
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

  // Compose-mode: explicit `base` prop wins; otherwise the shape may declare its own
  // `compose()` spec to migrate legacy shapes through the new pipeline.
  const shapeComposeSpec = !base && shapeModule.compose ? shapeModule.compose(params) : null;
  const resolvedBaseKey = base ?? (shapeComposeSpec?.base as BadgeBase | undefined);
  const composeBase = resolvedBaseKey ? BASES[resolvedBaseKey] : null;
  const resolvedBaseParams = base
    ? baseParams
    : (shapeComposeSpec?.baseParams as BadgeBaseParams[BadgeBase] | undefined);
  const resolvedEffects: EffectSpec[] | undefined = base
    ? effects
    : (shapeComposeSpec?.effects as EffectSpec[] | undefined) ?? effects;
  const composeBaseParams = composeBase ? { ...(composeBase.defaults ?? {}), ...(resolvedBaseParams ?? {}) } : null;
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
    ...(breakStyle !== undefined && {
      boxDecorationBreak: breakStyle,
      WebkitBoxDecorationBreak: breakStyle,
    }),
  };

  const commonProps = {
    className: cls,
    style,
    'data-shape': composeBase ? 'compose' : resolvedShape,
    'data-tone': tone,
    'data-variant': variant,
    'data-size': size,
    'data-focused': focused ? 'true' : undefined,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    'aria-label': ariaLabel,
  };

  // Honest chaining: sample the base perimeter at COMPOSE_SAMPLES points and sum every
  // offset-style effect's contribution at each sample. Stacked transforms therefore compose
  // additively — `[bites, spikes]` produces a bitten outline with spikes radiating from
  // wherever bites haven't dented inward.
  const COMPOSE_SAMPLES = 600;
  const composedSampler = (() => {
    if (!composeBase || !sampler) return null;
    const offsetMods = (resolvedEffects ?? [])
      .map((eff) => {
        const mod = EFFECTS[eff.type as keyof typeof EFFECTS];
        if (!mod?.offsetAt) return null;
        const effParams = { ...(mod.defaults ?? {}), ...(eff.params ?? {}) };
        return { offsetAt: mod.offsetAt, params: effParams };
      })
      .filter(Boolean) as { offsetAt: NonNullable<typeof EFFECTS[BadgeEffect]['offsetAt']>; params: Record<string, unknown> }[];
    if (offsetMods.length === 0) return sampler;
    const sx = 100 / box.w;
    const sy = 100 / box.h;
    let d = '';
    for (let i = 0; i < COMPOSE_SAMPLES; i++) {
      const sCss = (i / COMPOSE_SAMPLES) * sampler.totalCss;
      const pt = sampler.perimeterAt(sCss);
      let dx = 0, dy = 0;
      for (const m of offsetMods) {
        const o = m.offsetAt(sCss, {
          params: m.params as never,
          phase,
          totalCss: sampler.totalCss,
          perimeterAt: sampler.perimeterAt,
        });
        dx += o.dx;
        dy += o.dy;
      }
      const x = pt.x + dx * sx;
      const y = pt.y + dy * sy;
      d += (i === 0 ? `M ${x.toFixed(3)} ${y.toFixed(3)}` : ` L ${x.toFixed(3)} ${y.toFixed(3)}`);
    }
    d += ' Z';
    return { bodyPath: d, perimeterAt: sampler.perimeterAt, totalCss: sampler.totalCss };
  })();

  const decoEffects = (resolvedEffects ?? []).filter((eff) => EFFECTS[eff.type as keyof typeof EFFECTS]?.Component);
  const backgroundDecorations = decoEffects.filter((eff) => (EFFECTS[eff.type as keyof typeof EFFECTS].zone ?? 'foreground') === 'background');
  const foregroundDecorations = decoEffects.filter((eff) => (EFFECTS[eff.type as keyof typeof EFFECTS].zone ?? 'foreground') === 'foreground');

  const renderDecoration = (eff: EffectSpec, i: number) => {
    const mod = EFFECTS[eff.type as keyof typeof EFFECTS];
    const EffComponent = mod?.Component;
    if (!EffComponent || !composedSampler) return null;
    const effParams = { ...(mod.defaults ?? {}), ...(eff.params ?? {}) };
    return <EffComponent key={`${eff.type as string}-${i}`} sampler={composedSampler} boxW={box.w} boxH={box.h} variant={variant} params={effParams} phase={phase} />;
  };

  const decoSvg = composeBase && composedSampler ? (
    <svg ref={decoRef} className={s.deco} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {backgroundDecorations.map(renderDecoration)}
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={composedSampler.bodyPath} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={composedSampler.bodyPath} />}
      {foregroundDecorations.map(renderDecoration)}
    </svg>
  ) : shapeModule.renderMode !== 'css' && ShapeBody ? (
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
            <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" focusable="false">
              <path d="M 2 2 L 8 8 M 8 2 L 2 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            </svg>
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
