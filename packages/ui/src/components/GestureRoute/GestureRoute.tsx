import {
  getGestureDescriptor,
  parseRoute,
  type GestureName,
  type ModifierKey,
  type ParsedModifiers,
} from '@weasel-js/core/routing';
import { Powerline, type PowerlineProps, type PowerlineSegment } from '../Powerline';
import { KeyCap, keySpecFromKey, keySpecsFromMods, type KeySpec, type LogicalModSpec } from '../Keycaps';
import s from './GestureRoute.module.css';

const MOD_DISPLAY_ORDER: readonly ModifierKey[] = ['mod', 'shift', 'alt', 'ctrl', 'meta'];

function modifierKeys(modifiers: ParsedModifiers): readonly KeySpec[] | undefined {
  const specs: LogicalModSpec[] = [];
  for (const name of MOD_DISPLAY_ORDER) {
    const req = modifiers[name];
    if (req !== undefined) specs.push({ name, optional: req === 'optional' });
  }
  if (specs.length === 0) return undefined;
  return keySpecsFromMods(specs);
}

/**
 * The segments {@link GestureRoute} draws for a route string: phase atoms, then
 * `gesture(arg)`, then the held modifiers as one chord, then the target.
 * A descriptor's default arg and a wildcard target stay visible, muted, so
 * the strip shows the whole binding.
 */
export function gestureRouteSegments(route: string): PowerlineSegment[] {
  const parsed = parseRoute(route);
  const desc = getGestureDescriptor(parsed.gesture as GestureName);
  const hasArg = !!desc.arg && parsed.arg !== undefined;
  const argIsKey = hasArg && desc.arg?.name === 'key';
  const argIsDefault = hasArg && desc.arg?.default !== undefined && parsed.arg === desc.arg.default;
  const hasTarget = desc.hasTarget && parsed.target !== undefined;
  const targetIsWildcard = hasTarget && parsed.target === '*';
  const modKeys = modifierKeys(parsed.modifiers);

  const segments: PowerlineSegment[] = [];
  for (const p of parsed.phases) {
    if (p.channel !== '&') segments.push({ text: p.channel, status: 'neutral', variant: 'subtle' });
    segments.push({ text: p.phase, status: 'accent', variant: 'subtle' });
  }
  segments.push({
    text: hasArg ? (
      argIsKey ? (
        <>
          {parsed.gesture}{' '}
          <KeyCap label={keySpecFromKey(parsed.arg!).label} variant="minimal" className={s.keyCap} />
        </>
      ) : (
        <>
          {parsed.gesture}
          <span className={argIsDefault ? s.muted : undefined}>({parsed.arg})</span>
        </>
      )
    ) : parsed.gesture,
    status: 'info',
    variant: 'outline',
  });
  if (modKeys) {
    // `+` marks a required modifier and `?` an optional one, so `+mod ?shift` reads `+⌘?⇧`.
    const text = modKeys.map((k) => `${k.optional ? '?' : '+'}${k.label}`).join('');
    segments.push({ text, status: 'muted', variant: 'solid' });
  }
  if (hasTarget) {
    segments.push({
      text: parsed.target,
      status: 'muted',
      variant: targetIsWildcard ? 'subtle' : 'outline',
    });
  }
  for (let i = 0; i < segments.length - 1; i++) segments[i].endCap = 'chevron';
  return segments;
}

/** Props for {@link GestureRoute}. */
export interface GestureRouteProps extends Omit<PowerlineProps, 'segments'> {
  /** A route in the dispatcher's grammar, e.g. `[initial] drag => node +shift`. */
  route: string;
}

/**
 * A dispatcher route drawn as a {@link Powerline}: phase, gesture, modifiers
 * and target as one chevron-linked chain.
 */
export function GestureRoute({ route, 'aria-label': ariaLabel, ...rest }: GestureRouteProps) {
  return <Powerline {...rest} segments={gestureRouteSegments(route)} aria-label={ariaLabel ?? route} />;
}
