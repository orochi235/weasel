import { setOwn } from '@weasel-js/registry';
import type { RawToken } from '../dtcg/types.ts';
import { declaredSteps } from './steps.ts';
import type { Issue, Layer, Provenance } from './types.ts';

/** The tokens one `derive` produces, where each came from, and the names whose production failed. */
export interface TokenSink {
  readonly tokens: Record<string, RawToken>;
  readonly provenance: Record<string, Provenance>;
  /** Names whose production was attempted and failed at this selection. */
  readonly failed: Set<string>;
  /** Add a rule's token; reports a name some earlier rule already produced, and keeps that one. */
  put(name: string, token: RawToken, layer: Layer, rule: string, path: string): void;
  /** `steps`, when they settled, are this selection's; otherwise every step the entry could declare is exempt. */
  failEntry(name: string, entry: unknown, steps: readonly string[] | undefined): void;
}

export function createTokenSink(issues: Issue[]): TokenSink {
  const tokens: Record<string, RawToken> = {};
  const provenance: Record<string, Provenance> = {};
  const failed = new Set<string>();
  const producer = new Map<string, string>();
  return {
    tokens,
    provenance,
    failed,
    put(name, token, layer, rule, path) {
      const earlier = producer.get(name);
      if (earlier !== undefined) {
        issues.push({ kind: 'invalid', path, message: `"${name}" is already produced by ${earlier}` });
        return;
      }
      producer.set(name, path);
      setOwn(tokens, name, token);
      setOwn(provenance, name, { layer, rule, pinned: false });
    },
    failEntry(name, entry, steps) {
      for (const step of steps ?? declaredSteps(entry)) failed.add(`${name}-${step}`);
    },
  };
}
