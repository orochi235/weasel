import type { ModifierKey, ParsedModifiers } from '@weasel-js/core/routing';
import { getGestureDescriptor, type GestureName } from '@weasel-js/core/routing';
import { Badge, type BadgeProps } from '@weasel-js/ui/components/Badge';
import { Code } from '@weasel-js/ui/components/Code';
import { KeyCap, KeySequence, type KeyLegend } from '@weasel-js/ui/components/Keycaps';
import { keyLegendFromKey, keyLegendsFromMods, type LogicalModSpec } from '@weasel-js/gestures';
import { Fragment } from 'react';
import s from '../RegistryInspector.module.css';
import { CHANNEL_BADGE_PROPS, GESTURE_BADGE_PROPS, PHASE_BADGE_PROPS } from '../badgeTokens';
import { parseRoute } from '../registryData';

export const MOD_DISPLAY_ORDER: readonly ModifierKey[] = ['mod', 'shift', 'alt', 'ctrl', 'meta'];

/** Render a `HotkeyTrigger` value (`'space' | 'alt' | 'ctrl' | 'meta' |
 *  'shift' | ...`) as a single platform-aware `KeyLegend`. The four modifier
 *  triggers flow through `keyLegendsFromMods` (so `mod`-flavored entries
 *  render correctly on every OS); `space` flows through `keyLegendFromKey`;
 *  anything else falls back to an upper-cased label. */
export function hotkeyTriggerToKeyLegend(trigger: string): KeyLegend {
  if (trigger === 'shift' || trigger === 'alt' || trigger === 'ctrl'
      || trigger === 'meta' || trigger === 'mod') {
    return keyLegendsFromMods([{ name: trigger }])[0]!;
  }
  if (trigger === 'space' || trigger === ' ') return keyLegendFromKey(' ');
  return { label: trigger.toUpperCase() };
}

export function modifierKeys(modifiers: ParsedModifiers): readonly KeyLegend[] | undefined {
  const specs: LogicalModSpec[] = [];
  for (const name of MOD_DISPLAY_ORDER) {
    const req = modifiers[name];
    if (req !== undefined) specs.push({ name, optional: req === 'optional' });
  }
  if (specs.length === 0) return undefined;
  return keyLegendsFromMods(specs);
}

/** Decomposes a v3 route string (`[phaseList] gesture(arg) => target +mod`)
 *  into its constituent tokens — bracketed phase list, gesture badge with
 *  fused arg, target tag, modifier sequence. Arg is rendered inside the
 *  gesture badge as `gesture(arg)`; descriptor defaults (e.g. `wheel(*)`)
 *  are kept visible but muted. Target is rendered whenever the descriptor
 *  has a target slot, with the wildcard `*` muted so specific targets
 *  visually dominate. */
export function RouteBadge({ route }: { route: string }) {
  const parsed = parseRoute(route);
  const desc = getGestureDescriptor(parsed.gesture as GestureName);
  const modKeys = modifierKeys(parsed.modifiers);
  const hasArg = !!desc.arg && parsed.arg !== undefined;
  const argIsKey = hasArg && desc.arg?.name === 'key';
  const argIsDefault = hasArg && desc.arg?.default !== undefined && parsed.arg === desc.arg.default;
  const hasTarget = desc.hasTarget && parsed.target !== undefined;
  const targetIsWildcard = hasTarget && parsed.target === '*';
  return (
    <span className={s.routeBadge}>
      <span className={s.phaseGroup}>
        {parsed.phases.map((p, i) => (
          <Fragment key={i}>
            {i > 0 && <span className={s.phaseSep}>,</span>}
            {p.channel !== '&' && (
              <Badge {...(CHANNEL_BADGE_PROPS as BadgeProps)}>{p.channel}</Badge>
            )}
            <Badge {...(PHASE_BADGE_PROPS as BadgeProps)}>{p.phase}</Badge>
          </Fragment>
        ))}
      </span>
      <Badge {...(GESTURE_BADGE_PROPS as BadgeProps)}>
        {parsed.gesture}
        {hasArg && (argIsKey ? (
          <> <KeyCap label={keyLegendFromKey(parsed.arg!).label} className={s.routeKeyCap} /></>
        ) : (
          <span className={argIsDefault ? s.routeMuted : undefined}>({parsed.arg})</span>
        ))}
      </Badge>
      {modKeys && (
        <span className={s.modGroup}>
          <span className={s.modSigil}>+</span>
          <KeySequence keys={modKeys} variant="inverse" />
        </span>
      )}
      {hasTarget && (
        <Code className={targetIsWildcard ? s.routeMuted : undefined}>{parsed.target}</Code>
      )}
    </span>
  );
}
