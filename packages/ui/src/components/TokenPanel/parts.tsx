import { ResetControl } from '../Properties/ResetControl';
import s from './TokenPanel.module.css';
import type { TokenEntry } from './tokenTypes';

/** Each name's segments past those every name in the set shares; a name that is all shared keeps its last. */
export function stepLabels(names: readonly string[]): string[] {
  const split = names.map((name) => name.replace(/^--/, '').split('-'));
  let shared = 0;
  while (split.every((segments) => segments.length > shared && segments[shared] === split[0]?.[shared])) shared++;
  return split.map((segments) => segments.slice(shared).join('-') || (segments.at(-1) ?? ''));
}

/** `name` as the panel draws it: without its `--`, and without `prefix`, which may be written with or without one. */
export function shortName(name: string, prefix: string): string {
  const bare = name.replace(/^--/, '');
  const lead = prefix.replace(/^--/, '');
  return lead && bare.startsWith(lead) && bare.length > lead.length ? bare.slice(lead.length) : bare;
}

export function tipOf(token: TokenEntry): string {
  return token.description ? `${token.name} — ${token.description}` : token.name;
}

export function Reset({ name, onPress }: { name: string; onPress: () => void }) {
  return <ResetControl className={s.reset} name={name} onReset={onPress} />;
}
