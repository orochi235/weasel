import {
  forwardRef, useEffect, useId, useRef, useState,
  type CSSProperties, type FocusEvent, type HTMLAttributes, type ReactNode, type Ref,
} from 'react';
import { useVisibleRaf } from '@weasel-js/core';
import s from './Badge.module.css';
import { SHAPES, type BadgeShapeParams } from './shapes';
import type { BadgeBase, BadgeBaseParams } from './bases';
import { EFFECTS, type BadgeEffectSpec } from './effects';
import { composeOutline, offsetOutline } from './composeOutline';
import { resolveCompose } from './composeSpec';
import { liftPadding, paddingStyle } from './paddingSides';
import { useInsets } from './useInsets';
import type { BadgeShape, BadgeVariant, BadgeSize } from './types';
import { useSvgBox } from './useSvgBox';
import { BadgeRemove, BadgeTarget } from './BadgeLabel';
import { Focusable, Tooltip, TooltipTrigger } from '../Tooltip';
import { type AppearanceProps, useAppearance } from '../appearance';

/** What {@link Badge} takes whatever its shape: every prop of {@link BadgeProps}
 *  but `shape`, `shapeParams`, and the DOM attributes it passes through. */
export interface BadgeOwnProps extends AppearanceProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** "Edge bloat": offset every base perimeter sample outward by N CSS px along the normal
   *  before any compose effects run. Negative values shrink the silhouette. */
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
  effects?: BadgeEffectSpec[];
  onClick?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  href?: string;
  as?: 'span' | 'button' | 'a';
  children: ReactNode;
  className?: string;
  /** Optional style overrides merged with the badge's own style. Useful for setting CSS
   *  custom properties. */
  style?: CSSProperties;
  'aria-label'?: string;
  /**
   * Tooltip content. Wraps the badge in a kit tooltip trigger. A tooltip
   * trigger must be focusable and carry a role that announces its
   * description, so a badge that is neither a button nor a link joins the tab
   * order as `role="img"`, named by `aria-label` or else by string content.
   * On a badge with `onRemove`, the label is the trigger rather than the root.
   */
  tooltip?: ReactNode;
}

/** DOM attributes a badge passes through to its root element, e.g. the ones
 *  `Focusable` supplies when a badge sits under a `TooltipTrigger`. */
export type BadgeDomProps = Omit<
  HTMLAttributes<HTMLElement>,
  keyof BadgeOwnProps | 'onClick' | 'children' | 'className' | 'style'
>;

/**
 * Props for {@link Badge}. Discriminated on `shape` so `shapeParams` is typed
 * to the chosen shape's own parameters.
 */
export type BadgeProps = {
  [S in BadgeShape]: BadgeOwnProps & BadgeDomProps & { shape?: S; shapeParams?: BadgeShapeParams[S] };
}[BadgeShape];

/** CSS px between a composed badge's outline and its focus ring. */
const FOCUS_RING_OFFSET = 2;

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
 * With `onRemove` the root is always a `<span>`, since neither a button nor a
 * link may hold the remove button. The label inside it takes the action
 * instead, as a `role="button"` element or an `<a>`, along with `aria-label`
 * and the tooltip, and the remove button sits beside it.
 *
 * Beyond the built-in {@link BadgeShape} silhouettes, a badge can be composed:
 * `base` picks the underlying outline and `effects` layer perimeter treatments
 * over it, which stack additively. `bloat` pushes the whole silhouette outward
 * along its normals before effects run, and `crawl` animates perimeter
 * patterns.
 *
 * `ref` and any other DOM attributes forward to the root element.
 */
export const Badge = forwardRef(function Badge(props: BadgeProps, ref: Ref<HTMLElement>) {
  const {
    shape = 'pill',
    stance,
    grade,
    emphasis,
    tint,
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
    tooltip,
    as: _as,
    'aria-label': ariaLabelProp,
    onFocus,
    onBlur,
    ...domProps
  } = props;
  const element = chooseElement(props);
  const tooltipOnPlainBadge = tooltip != null && element === 'span';
  const split = onRemove != null && (element !== 'span' || tooltip != null);
  const ariaLabel = ariaLabelProp
    ?? (tooltipOnPlainBadge && (typeof children === 'string' || typeof children === 'number') ? String(children) : undefined);
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
  const appearance = useAppearance({ stance, grade, emphasis, tint });

  // Compose-mode: explicit `base` prop wins; otherwise the shape may declare its own
  // `compose()` spec.
  const { base: composeBase, baseParams: composeBaseParams, effects: resolvedEffects } =
    resolveCompose(shapeModule, params, { base, baseParams, effects });
  const decoRef = useRef<SVGSVGElement>(null);
  const box = useSvgBox(decoRef, composeBase);

  const sampler = composeBase ? composeBase.build(composeBaseParams, box.w, box.h) : null;

  const contentRef = useRef<HTMLSpanElement>(null);
  const insets = useInsets<unknown>(
    composeBase ?? shapeModule,
    composeBase ? composeBaseParams : params,
    contentRef,
    composeBase ? { effects: resolvedEffects, bloat: bloat ?? 0 } : undefined,
  );
  const style: CSSProperties = {
    ...appearance.style,
    ['--badge-inset-top' as never]: `${insets.top}px`,
    ['--badge-inset-right' as never]: `${insets.right}px`,
    ['--badge-inset-bottom' as never]: `${insets.bottom}px`,
    ['--badge-inset-left' as never]: `${insets.left}px`,
    ...paddingStyle(padding),
    ...(breakStyle !== undefined && {
      boxDecorationBreak: breakStyle,
      WebkitBoxDecorationBreak: breakStyle,
    }),
    ...liftPadding(styleOverride),
  };

  const commonProps = {
    ...domProps,
    ...(tooltipOnPlainBadge && !split && domProps.role === undefined && { role: 'img' }),
    className: cls,
    style,
    'data-shape': composeBase ? 'compose' : resolvedShape,
    'data-stance': appearance['data-stance'],
    'data-grade': appearance['data-grade'],
    'data-emphasis': appearance['data-emphasis'],
    'data-tint': appearance['data-tint'],
    'data-variant': variant,
    'data-size': size,
    'data-break': breakStyle,
    'data-focused': focused ? 'true' : undefined,
    onFocus: (e: FocusEvent<HTMLElement>) => { if (!split) setFocused(true); onFocus?.(e); },
    onBlur: (e: FocusEvent<HTMLElement>) => { if (!split) setFocused(false); onBlur?.(e); },
    'aria-label': split ? undefined : ariaLabel,
  };

  const composedSampler = composeBase && sampler
    ? composeOutline(sampler, resolvedEffects, bloat ?? 0, box, phase)
    : null;

  const decoEffects = (resolvedEffects ?? []).filter((eff) => EFFECTS[eff.type as keyof typeof EFFECTS]?.Component);
  const backgroundDecorations = decoEffects.filter((eff) => (EFFECTS[eff.type as keyof typeof EFFECTS].zone ?? 'foreground') === 'background');
  const foregroundDecorations = decoEffects.filter((eff) => (EFFECTS[eff.type as keyof typeof EFFECTS].zone ?? 'foreground') === 'foreground');
  const maskDecorations = decoEffects.filter((eff) => EFFECTS[eff.type as keyof typeof EFFECTS].zone === 'mask');
  const bodyMaskId = `badge-mask-${useId().replace(/:/g, '')}`;

  const renderDecoration = (eff: BadgeEffectSpec, i: number) => {
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
      {focused && <path className="badge-focus" d={offsetOutline(composedSampler, FOCUS_RING_OFFSET, box)} />}
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
      <span ref={contentRef} className={s.content}>
        {split ? (
          <BadgeTarget element={element} href={href} onClick={onClick} aria-label={ariaLabel} tooltip={tooltip} onFocusChange={setFocused}>
            {children}
          </BadgeTarget>
        ) : <span>{children}</span>}
        {onRemove && <BadgeRemove label={removeLabel} onRemove={onRemove} />}
      </span>
    </>
  );

  if (split) return <span {...commonProps} ref={ref}>{inner}</span>;
  let badge;
  if (element === 'button') {
    badge = (
      <button type="button" {...commonProps} ref={ref as Ref<HTMLButtonElement>} onClick={onClick}>
        {inner}
      </button>
    );
  } else if (element === 'a') {
    badge = (
      <a href={href} {...commonProps} ref={ref as Ref<HTMLAnchorElement>} onClick={onClick}>
        {inner}
      </a>
    );
  } else {
    badge = <span {...commonProps} ref={ref}>{inner}</span>;
  }
  if (tooltip == null) return badge;
  return (
    <TooltipTrigger>
      <Focusable>{badge}</Focusable>
      <Tooltip>{tooltip}</Tooltip>
    </TooltipTrigger>
  );
});
