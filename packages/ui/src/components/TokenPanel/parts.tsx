import { ResetIcon } from '../../icons';
import { Button } from '../Button';
import s from './TokenPanel.module.css';
import type { TokenEntry } from './tokenTypes';

/** Each name's segments past those every name in the set shares; a name that is all shared keeps its last. */
export function stepLabels(names: readonly string[]): string[] {
  const split = names.map((name) => name.replace(/^--/, '').split('-'));
  let shared = 0;
  while (split.every((segments) => segments.length > shared && segments[shared] === split[0]?.[shared])) shared++;
  return split.map((segments) => segments.slice(shared).join('-') || (segments.at(-1) ?? ''));
}

export function shortName(name: string, prefix: string): string {
  return prefix && name.startsWith(prefix) && name.length > prefix.length ? name.slice(prefix.length) : name;
}

export function tipOf(token: TokenEntry): string {
  return token.description ? `${token.name} — ${token.description}` : token.name;
}

export function Reset({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Button className={s.reset} variant="ghost" size="sm" iconOnly ariaLabel={label} onClick={onPress}>
      <ResetIcon size={12} />
    </Button>
  );
}
