/**
 * The unit catalog: what each unit is called, how it is written, and how it
 * reads aloud. Conversion lives in a `UnitSystem`; this is everything else a
 * unit's name decides.
 */

/** One way of writing a unit: `in`, or `″` where space is short. */
export interface UnitForm {
  readonly text: string;
  /** The glyph hugs the number, with no space and on the number's line: `°`, `′`, `″`, `%`. */
  readonly attaches: boolean;
  /** Other text that reads as this form: `"` for `″`, `deg` for `°`. */
  readonly aliases: readonly string[];
}

/** A unit in the catalog. */
export interface CatalogUnit {
  /** Its canonical name: `inch`. */
  readonly name: string;
  /** How it is written by default. */
  readonly symbol: UnitForm;
  /** How it is written where space is at a premium. */
  readonly compact?: UnitForm;
  /** The `Intl.NumberFormat` unit that speaks it, where `Intl` has one. */
  readonly intl?: string;
  /** Singular and plural names, for a unit `Intl` cannot name. */
  readonly spoken?: readonly [one: string, other: string];
  /** The CSS unit a number in it is written with, for a unit CSS has. */
  readonly css?: string;
}

/** A form as {@link registerUnit} takes it: bare text is a form that does not attach and has no aliases. */
export type UnitFormDefinition = string | { text: string; attaches?: boolean; aliases?: readonly string[] };

/** A unit as {@link registerUnit} takes it. */
export interface UnitDefinition {
  name: string;
  symbol: UnitFormDefinition;
  compact?: UnitFormDefinition;
  intl?: string;
  spoken?: readonly [one: string, other: string];
  css?: string;
}

function formOf(def: UnitFormDefinition): UnitForm {
  return typeof def === 'string'
    ? { text: def, attaches: false, aliases: [] }
    : { text: def.text, attaches: def.attaches ?? false, aliases: def.aliases ?? [] };
}

function catalogUnitOf(def: UnitDefinition): CatalogUnit {
  return {
    name: def.name,
    symbol: formOf(def.symbol),
    ...(def.compact === undefined ? {} : { compact: formOf(def.compact) }),
    ...(def.intl === undefined ? {} : { intl: def.intl }),
    ...(def.spoken === undefined ? {} : { spoken: def.spoken }),
    ...(def.css === undefined ? {} : { css: def.css }),
  };
}

const attached = (text: string, ...aliases: string[]): UnitFormDefinition => ({ text, attaches: true, aliases });

const BUILTIN: readonly UnitDefinition[] = [
  { name: 'millimeter', symbol: 'mm', intl: 'millimeter' },
  { name: 'centimeter', symbol: 'cm', intl: 'centimeter' },
  { name: 'meter', symbol: 'm', intl: 'meter' },
  { name: 'kilometer', symbol: 'km', intl: 'kilometer' },
  // A keyboard's smart quotes turn the marks typed for feet and inches into curly ones.
  { name: 'inch', symbol: 'in', compact: attached('″', '"', '”'), intl: 'inch' },
  { name: 'foot', symbol: 'ft', compact: attached('′', "'", '’'), intl: 'foot' },
  { name: 'yard', symbol: 'yd', intl: 'yard' },
  { name: 'mile', symbol: 'mi', intl: 'mile' },
  { name: 'point', symbol: 'pt', spoken: ['point', 'points'], css: 'pt' },
  { name: 'pixel', symbol: 'px', spoken: ['pixel', 'pixels'], css: 'px' },
  { name: 'em', symbol: 'em', css: 'em' },
  { name: 'rem', symbol: 'rem', css: 'rem' },
  { name: 'ch', symbol: 'ch', css: 'ch' },
  { name: 'vw', symbol: 'vw', css: 'vw' },
  { name: 'vh', symbol: 'vh', css: 'vh' },
  { name: 'degree', symbol: attached('°', 'deg'), intl: 'degree', css: 'deg' },
  { name: 'radian', symbol: 'rad', spoken: ['radian', 'radians'], css: 'rad' },
  { name: 'turn', symbol: 'turn', spoken: ['turn', 'turns'], css: 'turn' },
  { name: 'percent', symbol: attached('%'), intl: 'percent', css: '%' },
  { name: 'millisecond', symbol: 'ms', intl: 'millisecond', css: 'ms' },
  { name: 'second', symbol: 's', intl: 'second', css: 's' },
  { name: 'minute', symbol: 'min', intl: 'minute' },
  { name: 'hour', symbol: 'h', intl: 'hour' },
  { name: 'gram', symbol: 'g', intl: 'gram' },
  { name: 'kilogram', symbol: 'kg', intl: 'kilogram' },
  { name: 'liter', symbol: 'L', intl: 'liter' },
  { name: 'byte', symbol: 'B', intl: 'byte' },
  { name: 'kilobyte', symbol: { text: 'kB', aliases: ['KB'] }, intl: 'kilobyte' },
  { name: 'megabyte', symbol: 'MB', intl: 'megabyte' },
  { name: 'gigabyte', symbol: 'GB', intl: 'gigabyte' },
  { name: 'terabyte', symbol: 'TB', intl: 'terabyte' },
  { name: 'petabyte', symbol: 'PB', intl: 'petabyte' },
  { name: 'kibibyte', symbol: 'KiB', spoken: ['kibibyte', 'kibibytes'] },
  { name: 'mebibyte', symbol: 'MiB', spoken: ['mebibyte', 'mebibytes'] },
  { name: 'gibibyte', symbol: 'GiB', spoken: ['gibibyte', 'gibibytes'] },
  { name: 'tebibyte', symbol: 'TiB', spoken: ['tebibyte', 'tebibytes'] },
  { name: 'pebibyte', symbol: 'PiB', spoken: ['pebibyte', 'pebibytes'] },
];

/** Every text a unit is found by: its name, then each form's text and aliases. */
function keysOf(u: CatalogUnit): string[] {
  return [u.name, ...spellingsOf(u)];
}

function spellingsOf(u: CatalogUnit): string[] {
  const forms = u.compact ? [u.symbol, u.compact] : [u.symbol];
  return forms.flatMap((f) => [f.text, ...f.aliases]);
}

function indexOf(units: readonly CatalogUnit[]): Map<string, CatalogUnit> {
  const index = new Map<string, CatalogUnit>();
  for (const u of units) for (const key of keysOf(u)) if (!index.has(key)) index.set(key, u);
  return index;
}

const builtin = BUILTIN.map(catalogUnitOf);
const builtinIndex = indexOf(builtin);
/** Consumer units, latest last; a later one shadows an earlier one and the built-ins at every key they share. */
const registered: CatalogUnit[] = [];

/**
 * Add a unit to the catalog, or replace one: every name, symbol, and alias it
 * gives now finds it. Returns a function that takes it back out, restoring
 * whatever it shadowed.
 */
export function registerUnit(def: UnitDefinition): () => void {
  const entry = catalogUnitOf(def);
  registered.push(entry);
  return () => {
    const at = registered.indexOf(entry);
    if (at >= 0) registered.splice(at, 1);
  };
}

/** The unit `text` names, by its name, a form's text, or an alias. Case counts: `m` is not `M`. */
export function catalogUnit(text: string): CatalogUnit | undefined {
  for (let i = registered.length - 1; i >= 0; i--) {
    const u = registered[i]!;
    if (keysOf(u).includes(text)) return u;
  }
  return builtinIndex.get(text);
}

/** Every unit in the catalog, a registered one in place of a built-in of the same name. */
export function catalogUnits(): readonly CatalogUnit[] {
  const names = new Set<string>();
  const out: CatalogUnit[] = [];
  for (const u of [...registered].reverse().concat(builtin)) {
    if (names.has(u.name)) continue;
    names.add(u.name);
    out.push(u);
  }
  return out;
}

/** How {@link unitSymbol} picks a form. */
export interface UnitSymbolOptions {
  /** The compact form, where the unit has one. */
  compact?: boolean;
}

/**
 * How the unit `text` names is written: its compact form when asked for and
 * there is one, else the form `text` is the text or an alias of, else its
 * symbol. Text the catalog does not know is written as given, and does not attach.
 */
export function unitSymbol(text: string, options: UnitSymbolOptions = {}): UnitForm {
  const u = catalogUnit(text);
  if (u === undefined) return { text, attaches: false, aliases: [] };
  if (u.compact && (options.compact || u.compact.text === text || u.compact.aliases.includes(text))) return u.compact;
  return u.symbol;
}

/** Every text that is written for the unit `text` names, its name aside: each form and its aliases. Just `text` for a unit the catalog does not know. */
export function unitSpellings(text: string): readonly string[] {
  const u = catalogUnit(text);
  return u === undefined ? [text] : spellingsOf(u);
}

/** Number text followed by the unit `text` names, as {@link unitSymbol} writes it: spaced when asked, unless the form attaches. */
export function withUnit(number: string, text: string | undefined, options: UnitSymbolOptions & { space?: boolean } = {}): string {
  if (text === undefined || text === '') return number;
  const shown = unitSymbol(text, options);
  return `${number}${options.space && !shown.attaches ? ' ' : ''}${shown.text}`;
}
