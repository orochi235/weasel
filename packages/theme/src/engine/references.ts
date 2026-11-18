import { getOwn, hasOwnKey, setOwn } from '@weasel-js/registry';
import type { RawToken, TokenValue } from '../dtcg/types.ts';
import type { Issue, Provenance } from './types.ts';

const REF = /^\{([^}]+)\}$/;
/** The type of a token nothing has typed yet. */
export const UNTYPED = 'unknown';

function refName(value: TokenValue): string | undefined {
  return typeof value === 'string' ? REF.exec(value.trim())?.[1] : undefined;
}

/** Throws on a cycle, and on a reference to a missing name unless producing that name failed at this selection, which was reported then. */
export function checkReferences(tokens: Readonly<Record<string, RawToken>>, failed: ReadonlySet<string>): void {
  const done = new Set<string>();
  for (const start of Object.keys(tokens)) {
    const trail: string[] = [];
    let name: string | undefined = start;
    while (name !== undefined && !done.has(name)) {
      if (trail.includes(name)) throw new Error(`Reference cycle at token "${name}" (${[...trail, name].join(' → ')})`);
      trail.push(name);
      const target = refName(getOwn(tokens, name)!.value);
      if (target !== undefined && !hasOwnKey(tokens, target)) {
        if (!failed.has(target)) throw new Error(`Token "${name}" references "${target}", which is not defined`);
        name = undefined;
      } else {
        name = target;
      }
    }
    for (const n of trail) done.add(n);
  }
}

/**
 * Types every untyped token from what its reference chain ends on; a pin with nothing to go on takes the type of what the
 * rule under it reaches, which is also written into `generated`. Final tokens are typed before rule values are read, and
 * again whenever a rule value typed one, so no lookup sees a half-typed chain. Runs after `checkReferences`, so chains end.
 */
export function inferTypes(tokens: Record<string, RawToken>, provenance: Record<string, Provenance>, failed: ReadonlySet<string>, issues: Issue[]): void {
  for (let changed = true; changed; ) {
    changed = false;
    const memo = new Map<string, string>();
    const typeOf = (start: string): string => {
      const trail: string[] = [];
      let type = UNTYPED;
      for (let name = start, token = getOwn(tokens, name); token !== undefined; ) {
        const known = memo.get(name);
        if (known !== undefined) {
          type = known;
          break;
        }
        trail.push(name);
        if (token.type !== UNTYPED) {
          type = token.type;
          break;
        }
        const next = refName(token.value);
        if (next === undefined) break;
        name = next;
        token = getOwn(tokens, name);
      }
      for (const name of trail) {
        const token = getOwn(tokens, name)!;
        if (type !== UNTYPED && token.type === UNTYPED) setOwn(tokens, name, { ...token, type });
        memo.set(name, type);
      }
      return type;
    };
    for (const name of Object.keys(tokens)) typeOf(name);
    for (const name of Object.keys(tokens)) {
      const p = getOwn(provenance, name)!;
      const generated = p.generated;
      const target = generated?.type === UNTYPED ? refName(generated.value) : undefined;
      const type = target === undefined ? UNTYPED : typeOf(target);
      if (!generated || type === UNTYPED) continue;
      setOwn(provenance, name, { ...p, generated: { ...generated, type } });
      if (tokens[name].type === UNTYPED) {
        setOwn(tokens, name, { ...tokens[name], type });
        changed = true;
      }
    }
  }
  for (const [name, token] of Object.entries(tokens)) {
    // A reference is typed by what it reaches, reported there; a name whose production failed was reported then.
    if (token.type !== UNTYPED || refName(token.value) !== undefined || failed.has(name)) continue;
    issues.push({ kind: 'untyped-pin', token: name });
  }
}
