import {
  forwardRef, useRef, useState,
  type CSSProperties, type FocusEvent, type HTMLAttributes, type ReactNode, type Ref,
} from 'react';
import s from './Badge.module.css';
import { SHAPES, type BadgeShapeParams } from './shapes';
import type { BadgeBase, BadgeBaseParams } from './bases';
import type { BadgeEffectSpec } from './effects';
import { BadgeDeco } from './BadgeDeco';
import { useCrawlPhase } from './useCrawlPhase';
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
  /** Attributes for the label of a removable badge that has an action, the element that takes the action and
   *  focus: handlers that must see a press or a key on the label itself. Ignored where the label is not split off. */
  labelProps?: HTMLAttributes<HTMLElement>;
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
    labelProps,
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
  const shapeModule = SHAPES[shape] ?? SHAPES.pill;
  const resolvedShape = SHAPES[shape] ? shape : 'pill';
  const params = { ...(shapeModule.defaults ?? {}), ...(shapeParams ?? {}) };

  const phase = useCrawlPhase(crawl);
  const cls = [s.badge, className].filter(Boolean).join(' ');
  const appearance = useAppearance({ stance, grade, emphasis, tint });

  // Compose-mode: explicit `base` prop wins; otherwise the shape may declare its own
  // `compose()` spec.
  const compose = resolveCompose(shapeModule, params, { base, baseParams, effects });
  const { base: composeBase, baseParams: composeBaseParams, effects: resolvedEffects } = compose;
  const decoRef = useRef<SVGSVGElement>(null);
  const box = useSvgBox(decoRef, composeBase);

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
    ...appearance,
    ...(tooltipOnPlainBadge && !split && domProps.role === undefined && { role: 'img' }),
    className: cls,
    style,
    'data-shape': composeBase ? 'compose' : resolvedShape,
    'data-variant': variant,
    'data-size': size,
    'data-break': breakStyle,
    'data-focused': focused ? 'true' : undefined,
    onFocus: (e: FocusEvent<HTMLElement>) => { if (!split) setFocused(true); onFocus?.(e); },
    onBlur: (e: FocusEvent<HTMLElement>) => { if (!split) setFocused(false); onBlur?.(e); },
    'aria-label': split ? undefined : ariaLabel,
  };

  const decoSvg = (
    <BadgeDeco
      svgRef={decoRef}
      compose={compose}
      shapeModule={shapeModule}
      params={params}
      box={box}
      bloat={bloat ?? 0}
      variant={variant}
      focused={focused}
      phase={phase}
    />
  );

  const inner = (
    <>
      {decoSvg}
      <span ref={contentRef} className={s.content}>
        {split ? (
          <BadgeTarget element={element} href={href} onClick={onClick} aria-label={ariaLabel} tooltip={tooltip} onFocusChange={setFocused} extra={labelProps}>
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
