import {
  getGestureDescriptor,
  parseRoute,
  type GestureName,
  type ModifierKey,
  type ParsedModifiers,
  type ParsedRoute,
} from '@weasel-js/core/routing';
import type { ReactNode } from 'react';
import { Badge, type BadgeVariant } from '@weasel-js/ui/components/Badge';
import { Powerline, type EdgeCap, type PowerlineProps } from '@weasel-js/ui/components/Powerline';
import type { AppearanceProps } from '@weasel-js/ui/appearance';
import { KeyCap, type KeyLegend } from '@weasel-js/ui/components/Keycaps';
import { foldKeyRoute, keyLegendFromKey, keyLegendsFromMods, type LogicalModSpec } from '@weasel-js/gestures';
import s from './GestureRoute.module.css';

const MOD_DISPLAY_ORDER: readonly ModifierKey[] = ['mod', 'shift', 'alt', 'ctrl', 'meta'];

function modifierKeys(modifiers: ParsedModifiers): readonly KeyLegend[] | undefined {
  const specs: LogicalModSpec[] = [];
  for (const name of MOD_DISPLAY_ORDER) {
    const req = modifiers[name];
    if (req !== undefined) specs.push({ name, optional: req === 'optional' });
  }
  if (specs.length === 0) return undefined;
  return keyLegendsFromMods(specs);
}

/** One badge of a {@link GestureRoute}. */
export interface RouteSegment extends Pick<AppearanceProps, 'emphasis' | 'grade'> {
  text: ReactNode;
  variant: BadgeVariant;
  endCap?: EdgeCap;
}

/**
 * The segments {@link GestureRoute} draws for a route string: phase atoms, then
 * `gesture(arg)`, then the held modifiers as one chord, a hover's `held`, then the target.
 * A descriptor's default arg and a wildcard arg or target stay visible,
 * muted, so the strip shows the whole binding. A route the grammar rejects,
 * as from a page on another kit version, is drawn as its own text.
 */
export function gestureRouteSegments(route: string): RouteSegment[] {
  let parsed: ParsedRoute;
  try { parsed = parseRoute(route); } catch { return [{ text: route, variant: 'subtle' }]; }
  const desc = getGestureDescriptor(parsed.gesture as GestureName);
  const folded = foldKeyRoute(parsed);
  const hasArg = !!desc.arg && parsed.arg !== undefined;
  const argIsKey = hasArg && desc.arg?.name === 'key' && folded.arg !== undefined;
  const argIsMuted = hasArg && (parsed.arg === '*' || (desc.arg?.default !== undefined && parsed.arg === desc.arg.default));
  const hasTarget = desc.hasTarget && parsed.target !== undefined;
  const targetIsWildcard = hasTarget && parsed.target === '*';
  const modKeys = modifierKeys(folded.modifiers);

  const segments: RouteSegment[] = [];
  for (const p of parsed.phases) {
    if (p.channel !== '&') segments.push({ text: p.channel, variant: 'subtle' });
    segments.push({ text: p.phase, emphasis: 'high', variant: 'subtle' });
  }
  segments.push({
    text: hasArg ? (
      argIsKey ? (
        <>
          {parsed.gesture}{' '}
          <KeyCap label={keyLegendFromKey(folded.arg!).label} className={s.keyCap} />
        </>
      ) : (
        <>
          {parsed.gesture}
          <span className={argIsMuted ? s.muted : undefined}>({parsed.arg})</span>
        </>
      )
    ) : parsed.gesture,
    grade: 'info',
    variant: 'outline',
  });
  if (modKeys) {
    // `+` marks a required modifier and `?` an optional one, so `+mod ?shift` reads `+⌘?⇧`.
    const text = modKeys.map((k) => `${k.optional ? '?' : '+'}${k.label}`).join('');
    segments.push({ text, emphasis: 'low', variant: 'solid' });
  }
  if (parsed.held) segments.push({ text: `${parsed.held === 'required' ? '+' : '?'}held`, emphasis: 'low', variant: 'solid' });
  if (hasTarget) {
    segments.push({
      text: parsed.target,
      emphasis: 'low',
      variant: targetIsWildcard ? 'subtle' : 'outline',
    });
  }
  for (let i = 0; i < segments.length - 1; i++) segments[i].endCap = 'chevron';
  return segments;
}

/** Props for {@link GestureRoute}. */
export interface GestureRouteProps extends Omit<PowerlineProps, 'children'> {
  /** A route in the dispatcher's grammar, e.g. `[initial] drag => node +shift`. */
  route: string;
}

/**
 * A dispatcher route drawn as a {@link Powerline}: phase, gesture, modifiers
 * and target as one chevron-linked chain.
 */
export function GestureRoute({ route, 'aria-label': ariaLabel, ...rest }: GestureRouteProps) {
  return (
    <Powerline {...rest} aria-label={ariaLabel ?? route}>
      {gestureRouteSegments(route).map(({ text, ...look }, i) => <Badge key={i} {...look}>{text}</Badge>)}
    </Powerline>
  );
}
