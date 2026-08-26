import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { useVisibleRaf } from '@weasel-js/core';
import s from './Badge.module.css';
import { SHAPES, type BadgeShapeParams } from './shapes';
import { BASES, type BadgeBase, type BadgeBaseParams } from './bases';
import { EFFECTS, type EffectSpec, type BadgeEffect } from './effects';
import type { BadgeShape, BadgeTone, BadgeVariant, BadgeSize } from './types';

interface BadgeBaseProps {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** "Edge bloat": offset every base perimeter sample outward by N CSS px along the normal
   *  before any compose effects run. Negative values shrink the silhouette. Photoshop-style
   *  expand-selection on the body. */
  bloat?: number;
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
  /** Optional style overrides merged with the badge's own style. Useful for setting CSS
   *  custom properties (e.g. `--badge-edge` to inject a custom tone color). */
  style?: CSSProperties;
  'aria-label'?: string;
}

type BadgePropsByShape = {
  [S in BadgeShape]: BadgeBaseProps & { shape?: S; shapeParams?: BadgeShapeParams[S] };
}[BadgeShape];

/**
 * Props for {@link Badge}. Discriminated on `shape` so `shapeParams` is typed
 * to the chosen shape's own parameters.
 */
export type BadgeProps = BadgePropsByShape;

function chooseElement(props: BadgeProps): 'span' | 'button' | 'a' {
  if (props.as) return props.as;
  if (props.href) return 'a';
  if (props.onClick) return 'button';
  return 'span';
}

/**
 * A small labelled chip. Renders as a `<span>`, or as a `<button>`/`<a>` when
 * given `onClick`/`href` — override with `as`.
 *
 * Beyond the built-in {@link BadgeShape} silhouettes, a badge can be composed:
 * `base` picks the underlying outline and `effects` layer perimeter treatments
 * over it, which stack additively. `bloat` pushes the whole silhouette outward
 * along its normals before effects run, and `crawl` animates perimeter
 * patterns.
 */
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
    bloat,
    padding,
    style: styleOverride,
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

  const lastCrawlRef = useRef<number | null>(null);
  const crawlLoop = useVisibleRaf(
    (now) => {
      const speed = typeof crawl === 'number' ? crawl : 0.2;
      const last = lastCrawlRef.current;
      lastCrawlRef.current = now;
      if (last !== null) setPhase((p) => (p + (speed * (now - last)) / 1000) % 1);
      crawlLoop.request();
    },
    // A crawl does not advance while nobody is watching it, so the frame that
    // resumes it must not apply the whole interval at once.
    { onResume: () => { lastCrawlRef.current = null; } },
  );

  useEffect(() => {
    if (!crawl) {
      setPhase(0);
      return;
    }
    lastCrawlRef.current = null;
    crawlLoop.request();
    return () => crawlLoop.cancel();
  }, [crawl, crawlLoop]);
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
    ...(padding !== undefined && { padding: typeof padding === 'number' ? `${padding}px` : padding }),
    ...(breakStyle !== undefined && {
      boxDecorationBreak: breakStyle,
      WebkitBoxDecorationBreak: breakStyle,
    }),
    ...styleOverride,
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
    const bloatCss = bloat ?? 0;
    if (offsetMods.length === 0 && bloatCss === 0) return sampler;
    const sx = 100 / box.w;
    const sy = 100 / box.h;
    const totalCss = sampler.totalCss;
    // Compute the warped sample point at any CSS arc length s — base perimeter sample
    // bloated outward by a constant CSS distance plus the sum of every offset effect's
    // contribution at that sample.
    const warpedXY = (sCss: number) => {
      const sm = ((sCss % totalCss) + totalCss) % totalCss;
      const pt = sampler.perimeterAt(sm);
      let dx = pt.nx * bloatCss;
      let dy = pt.ny * bloatCss;
      for (const m of offsetMods) {
        const o = m.offsetAt(sm, {
          params: m.params as never,
          phase,
          totalCss,
          perimeterAt: sampler.perimeterAt,
        });
        dx += o.dx;
        dy += o.dy;
      }
      return { x: pt.x + dx * sx, y: pt.y + dy * sy };
    };
    let d = '';
    for (let i = 0; i < COMPOSE_SAMPLES; i++) {
      const sCss = (i / COMPOSE_SAMPLES) * totalCss;
      const w = warpedXY(sCss);
      d += (i === 0 ? `M ${w.x.toFixed(3)} ${w.y.toFixed(3)}` : ` L ${w.x.toFixed(3)} ${w.y.toFixed(3)}`);
    }
    d += ' Z';
    // Replace perimeterAt with a warped version: warped point + normal recomputed from
    // the warped tangent (clockwise rotation of unit tangent). This is what decorations
    // like Bevel and Perforations need to follow the actual bumpy outline.
    const warpedPerimeterAt = (s: number) => {
      const sm = ((s % totalCss) + totalCss) % totalCss;
      const pt = warpedXY(sm);
      const eps = totalCss / (COMPOSE_SAMPLES * 2);
      const wA = warpedXY(sm - eps);
      const wB = warpedXY(sm + eps);
      // Convert finite-difference tangent back to "CSS px" by un-scaling per-axis.
      const tx = (wB.x - wA.x) / sx;
      const ty = (wB.y - wA.y) / sy;
      const tl = Math.hypot(tx, ty) || 1;
      // Outward normal: clockwise rotation of tangent (in CSS space), then renormalize
      // for unit length in viewBox terms when returned.
      const nxC = ty / tl;
      const nyC = -tx / tl;
      // Convert that CSS-space normal back to a viewBox-space unit-ish normal: the
      // existing PerimeterPoint contract has nx/ny used multiplicatively with sx/sy in
      // call sites, matching the convention base perimeters use.
      return { x: pt.x, y: pt.y, nx: nxC, ny: nyC };
    };
    return { bodyPath: d, perimeterAt: warpedPerimeterAt, totalCss };
  })();

  const decoEffects = (resolvedEffects ?? []).filter((eff) => EFFECTS[eff.type as keyof typeof EFFECTS]?.Component);
  const backgroundDecorations = decoEffects.filter((eff) => (EFFECTS[eff.type as keyof typeof EFFECTS].zone ?? 'foreground') === 'background');
  const foregroundDecorations = decoEffects.filter((eff) => (EFFECTS[eff.type as keyof typeof EFFECTS].zone ?? 'foreground') === 'foreground');
  const maskDecorations = decoEffects.filter((eff) => EFFECTS[eff.type as keyof typeof EFFECTS].zone === 'mask');
  const bodyMaskId = `badge-mask-${useId().replace(/:/g, '')}`;

  const renderDecoration = (eff: EffectSpec, i: number) => {
    const mod = EFFECTS[eff.type as keyof typeof EFFECTS];
    const EffComponent = mod?.Component;
    if (!EffComponent || !composedSampler) return null;
    const effParams = { ...(mod.defaults ?? {}), ...(eff.params ?? {}) };
    return <EffComponent key={`${eff.type as string}-${i}`} sampler={composedSampler} boxW={box.w} boxH={box.h} variant={variant} params={effParams} phase={phase} />;
  };

  const decoSvg = composeBase && composedSampler ? (
    <svg ref={decoRef} className={s.deco} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {maskDecorations.length > 0 && (
        <defs>
          <mask id={bodyMaskId} maskUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120">
            <rect x="-10" y="-10" width="120" height="120" fill="white" />
            {maskDecorations.map(renderDecoration)}
          </mask>
        </defs>
      )}
      {backgroundDecorations.map(renderDecoration)}
      <g {...(maskDecorations.length > 0 ? { mask: `url(#${bodyMaskId})` } : {})}>
        {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={composedSampler.bodyPath} />}
        {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={composedSampler.bodyPath} />}
      </g>
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
