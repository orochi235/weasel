import { hexToRgba } from './color';
import type { FlatTokens, ResolvedTokenMap, TokenValue } from './types';

/** `{color.gray-100}` → `gray-100`. The type group is dropped, per the naming rule. */
const REF = /^\{([^}]+)\}$/;

function refTarget(value: TokenValue): string | null {
  if (typeof value !== 'string') return null;
  const m = REF.exec(value.trim());
  if (!m) return null;
  const path = m[1];
  const dot = path.indexOf('.');
  return dot === -1 ? path : path.slice(dot + 1);
}

/**
 * Quote family names containing whitespace; leave everything else bare.
 * Generic keywords (`sans-serif`) and hyphen-prefixed identifiers
 * (`-apple-system`) break if quoted, and neither contains a space.
 */
function fontStack(value: readonly (string | number)[]): string {
  return value.map((f) => (typeof f === 'string' && /\s/.test(f) ? `'${f}'` : String(f))).join(', ');
}

function serialize(type: string, value: TokenValue): string {
  if (Array.isArray(value)) {
    if (type === 'cubicBezier') return `cubic-bezier(${value.join(', ')})`;
    if (type === 'fontFamily') return fontStack(value);
    return value.join(', ');
  }
  return String(value);
}

/**
 * Resolve flat tokens to final CSS-ready strings.
 *
 * Merge modes before calling: this function has no notion of modes, only of a
 * complete token set.
 */
export function resolveTokens(tokens: FlatTokens): ResolvedTokenMap {
  const out: ResolvedTokenMap = {};
  const inProgress = new Set<string>();

  const resolveOne = (name: string): string => {
    const cached = out[name];
    if (cached !== undefined) return cached;

    const token = tokens[name];
    if (!token) throw new Error(`Unknown token "${name}"`);

    if (inProgress.has(name)) {
      throw new Error(`Reference cycle at token "${name}" (${[...inProgress].join(' → ')})`);
    }
    inProgress.add(name);

    const target = refTarget(token.value);
    let value: string;
    if (target === null) {
      value = serialize(token.type, token.value);
    } else if (!tokens[target]) {
      throw new Error(`Token "${name}" references "${target}", which is not defined`);
    } else {
      value = resolveOne(target);
    }

    if (token.alpha !== undefined) value = hexToRgba(value, token.alpha);

    inProgress.delete(name);
    out[name] = value;
    return value;
  };

  for (const name of Object.keys(tokens)) resolveOne(name);
  return out;
}

/** Merge a mode's tokens over the mode-invariant set. Later wins. */
export function mergeTokens(base: FlatTokens, mode: FlatTokens): FlatTokens {
  return { ...base, ...mode };
}
