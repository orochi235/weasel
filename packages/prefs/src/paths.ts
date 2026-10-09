type Join<A extends string, B extends string> = A extends '' ? B : `${A}.${B}`;

/** Every leaf's dotted path in a schema. A group's key is a segment; an
 *  `object` leaf is one path, its fields are not. */
export type PrefPath<G, Prefix extends string = ''> =
  G extends { children: infer C }
    ? {
        [K in keyof C & string]: C[K] extends { kind: string }
          ? Join<Prefix, K>
          : C[K] extends { children: Record<string, unknown> }
            ? PrefPath<C[K], Join<Prefix, K>>
            : never;
      }[keyof C & string]
    : never;

/** The leaf at `P`. */
export type PrefAtPath<G, P extends string> =
  G extends { children: infer C }
    ? P extends `${infer H}.${infer Rest}`
      ? H extends keyof C
        ? PrefAtPath<C[H], Rest>
        : never
      : P extends keyof C
        ? C[P] extends { kind: string }
          ? C[P]
          : never
        : never
    : never;

/** What a leaf holds: its kind's value type for a built-in kind, the type of
 *  its `default` for an app-defined one. */
export type PrefValueOf<L> =
  L extends { kind: 'number' } ? number
  : L extends { kind: 'boolean' } ? boolean
  : L extends { kind: 'string' | 'color' | 'field' } ? string
  : L extends { kind: 'enum'; options: readonly { value: infer T }[] } ? T
  : L extends { default: infer D } ? D
  : unknown;

/** What the leaf at `P` holds. */
export type PrefValueAt<G, P extends string> = PrefValueOf<PrefAtPath<G, P>>;
