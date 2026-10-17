/** One glyph: SVG body on a 20x20 viewBox stroked in currentColor, and how it is filed. */
export interface IconGlyph {
  readonly body: string;
  /** The enclosed region `<Icon filled>` shades, when there is one. */
  readonly fill?: string;
  readonly group: string;
  readonly tags: readonly string[];
}

/** Every glyph one publisher ships under one namespace. */
export interface IconTable {
  readonly namespace: string;
  /** The publishing package. Tables with one namespace merge only when their owners match. */
  readonly owner: string;
  readonly icons: Readonly<Record<string, IconGlyph>>;
}

/** What a variant's dynamic import resolves to. */
export interface IconVariantModule {
  readonly default: readonly IconTable[];
}

/** Loads one variant module: the icon tables that variant adds. */
export type IconVariantLoader = () => Promise<IconVariantModule>;
