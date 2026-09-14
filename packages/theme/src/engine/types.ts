import type { FlatTokens, RawToken } from '../dtcg/types';

export type Layer = 'ramps' | 'scales' | 'semantics' | 'components' | 'pins';

export interface Provenance {
  readonly layer: Layer;
  /** `lightness`, `categorical`, `linear`, `geometric`, `step`, `offset`, `contrast`, `ref`, `value`. */
  readonly rule: string;
  /** A pin replaced what the rule produced. Only these count as overridden. */
  readonly pinned: boolean;
  /** What the rule alone produced, when `pinned`. */
  readonly generated?: RawToken;
}

export type Issue =
  | { readonly kind: 'missing-axis-value'; readonly path: string; readonly axis: string; readonly value: string }
  | { readonly kind: 'untyped-pin'; readonly token: string }
  | { readonly kind: 'infeasible-ramp'; readonly ramp: string }
  | {
      readonly kind: 'contrast-unmet';
      readonly token: string;
      readonly min: number;
      readonly against: readonly string[];
      /** The step used anyway: the one with the best worst-case ratio across the whole ramp. */
      readonly picked: string;
      readonly ratio: number;
    }
  | { readonly kind: 'check-failed'; readonly token: string; readonly against: string; readonly min: number; readonly ratio: number }
  | { readonly kind: 'invalid'; readonly path: string; readonly message: string };

export interface DeriveResult {
  /** In layer order, then definition order within a layer. */
  readonly tokens: FlatTokens;
  readonly provenance: Readonly<Record<string, Provenance>>;
  readonly issues: readonly Issue[];
}
