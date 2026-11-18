import { formatShortcut } from '@weasel-js/gestures';
import { Button } from '@weasel-js/ui/components/Button';
import { Icon } from '@weasel-js/ui/components/Icon';
import type { MouseEvent, PointerEvent, ReactNode } from 'react';
import type { TrialChromeContext, TrialContribution } from '../types';

/** Which end of the title bar a `<TitleBarRegion>` lays out: `'lead'` renders
 *  the contributions that leave `end` unset, before the title; `'actions'`
 *  renders the ones that set it, after everything else. */
export type TitleBarPlacement = 'lead' | 'actions';

/** Props for `<TitleBarRegion>`. */
export interface TitleBarRegionProps {
  contributions: readonly TrialContribution[];
  ctx: TrialChromeContext;
  /** Defaults to `'actions'`, where the built-ins live. */
  placement?: TitleBarPlacement;
}

function renderEntry(c: TrialContribution, ctx: TrialChromeContext): ReactNode {
  if (c.render) return <span key={c.id}>{c.render(ctx)}</span>;
  if (c.region !== 'titlebar' || !c.item) return null;
  const {
    icon,
    label,
    shortcut,
    disabled,
    disabledReason,
    danger,
    pressed,
    showLabel,
    onActivate,
  } = c.item;
  const glyph = <Icon name={icon} size={16} />;
  const keys = formatShortcut(shortcut);
  const common = {
    size: 'xs',
    variant: 'ghost',
    emphasis: 'low',
    grade: danger ? 'danger' : undefined,
    pressed,
    disabled,
    disabledReason,
    shortcut: keys,
    onClick: () => onActivate(ctx),
  } as const;
  return showLabel ? (
    <Button key={c.id} {...common} leadingIcon={glyph}>
      {label}
    </Button>
  ) : (
    <Button key={c.id} {...common} iconOnly aria-label={label} tooltip={keys ? undefined : label}>
      {glyph}
    </Button>
  );
}

// The bar behind these buttons is the tile's drag surface, so a press that lands on them must not also start a
// drag. Stopped here rather than on each button, since a button held for a reason drops its own press handlers.
const keepPress = {
  onPointerDown: (e: PointerEvent) => e.stopPropagation(),
  onMouseDown: (e: MouseEvent) => e.stopPropagation(),
};

/** Lays a trial's `titlebar` contributions out at one end of the bar. */
export function TitleBarRegion({ contributions, ctx, placement = 'actions' }: TitleBarRegionProps) {
  const wanted = placement === 'actions';
  const mine = contributions.filter((c) => (c.end ?? false) === wanted);
  if (mine.length === 0) return null;
  return (
    <span
      className={wanted ? 'lk-trial__titlebar-actions' : 'lk-trial__titlebar-lead'}
      {...keepPress}
    >
      {mine.map((c) => renderEntry(c, ctx))}
    </span>
  );
}
