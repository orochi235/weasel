type Join<A extends string, B extends string> = A extends '' ? B : `${A}.${B}`;

/** Every value's dotted path in a `PrefGroup` schema, where a group's key is a
 *  segment; an `object` leaf is one path, its fields are not, and an `action`
 *  leaf, holding no value, has none. A `PrefSection`
 *  has no such paths: each of its leaves is addressed by its own key. */
export type PrefPath<G, Prefix extends string = ''> =
  G extends { children: infer C }
    ? string extends keyof C
      ? Join<Prefix, string>
      : {
          [K in keyof C & string]: C[K] extends { kind: string }
            ? C[K] extends { kind: 'action' } ? never : Join<Prefix, K>
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
        ? C[H] extends { kind: string }
          ? never
          : PrefAtPath<C[H], Rest>
        : never
      : P extends keyof C
        ? C[P] extends { kind: string }
          ? C[P]
          : never
        : never
    : never;

/** What a leaf holds: its kind's value type for a built-in kind, the type of
 *  its `default` for an app-defined one. A list holds an array of what its
 *  `item` holds, and a map a record of it. */
export type PrefValueOf<L> =
  L extends { kind: 'number' } ? number
  : L extends { kind: 'boolean' } ? boolean
  : L extends { kind: 'string' | 'color' | 'field' } ? string
  : L extends { kind: 'paint' } ? unknown
  : L extends { kind: 'enum'; options: readonly { value: infer T }[] }
    ? L extends { clearable: true } ? T | undefined : T
  : L extends { kind: 'list'; item: infer I } ? PrefValueOf<I>[]
  : L extends { kind: 'map'; item: infer I } ? Record<string, PrefValueOf<I>>
  : L extends { default: infer D } ? D
  : unknown;

/** What the leaf at `P` holds. */
export type PrefValueAt<G, P extends string> = PrefValueOf<PrefAtPath<G, P>>;
