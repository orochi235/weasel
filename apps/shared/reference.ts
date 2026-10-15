/**
 * One package's API reference as the site draws it. `scripts/build-reference.ts`
 * reads TypeDoc's JSON into this shape, with every type already written out as
 * code and every comment already rendered, so the page that shows it walks no
 * type tree and parses no markdown.
 */
import type { MarkdownBlock } from './markdown';

/** A run of code, or a name in it that links to that export's page (`to` is a site hash). */
export type CodeToken = string | { readonly text: string; readonly to: string };
export type Code = readonly CodeToken[];
export type Prose = readonly MarkdownBlock[];

export interface ReferenceParam {
  name: string;
  type: Code;
  optional: boolean;
  doc: Prose;
}

/** Something callable: one overload of a function, a method, or a constructor. */
export interface ReferenceSignature {
  /** The declaration as it would be written: `function clamp(x: number): number`. */
  code: Code;
  doc: Prose;
  params: ReferenceParam[];
  /** `null` where there is nothing to say: a constructor, or a `void` with no `@returns`. */
  returns: { type: Code; doc: Prose } | null;
}

export type MemberKind = 'constructor' | 'property' | 'method' | 'accessor' | 'index' | 'call' | 'value';

/** One line of an interface, a class, an object type, or an enum. */
export interface ReferenceMember extends Partial<Pick<ReferenceSignature, 'params' | 'returns'>> {
  name: string;
  kind: MemberKind;
  code: Code;
  doc: Prose;
  /** The type this member is inherited from, when it is not declared here. */
  inheritedFrom?: Code;
}

interface SymbolBase {
  name: string;
  /** The comment's first sentence as inline markdown, for a list of exports. */
  summary: string;
  doc: Prose;
  /** Set when the export is marked `@deprecated`; holds what the tag says. */
  deprecated?: Prose;
  /** Where it is declared, and that line on the repository's host when TypeDoc knew it. */
  source?: { file: string; line: number; url?: string };
}

export interface FunctionSymbol extends SymbolBase {
  kind: 'function';
  signatures: ReferenceSignature[];
}

/** An interface, a type alias, a variable, or an enum: a declaration and, where it has them, members. */
export interface TypeSymbol extends SymbolBase {
  kind: 'interface' | 'type' | 'variable' | 'enum';
  code: Code;
  members: ReferenceMember[];
}

export interface ClassSymbol extends SymbolBase {
  kind: 'class';
  code: Code;
  members: ReferenceMember[];
}

/** An export this package passes along from the package that declares it. */
export interface AliasSymbol extends SymbolBase {
  kind: 'alias';
  /** The declaring export's page, or `null` when the reference does not document it. */
  to: string | null;
}

export type ReferenceSymbol = FunctionSymbol | TypeSymbol | ClassSymbol | AliasSymbol;
export type SymbolKind = ReferenceSymbol['kind'];

/** One entry of a package's `exports` map: the root, or a subpath. */
export interface ReferenceModule {
  /** The subpath, `booleans`; empty for the root entry. */
  name: string;
  /** What a consumer imports it by, `@weasel-js/geom/booleans`. */
  specifier: string;
  doc: Prose;
  /** The exports under their headings, in TypeDoc's order. */
  groups: { title: string; names: string[] }[];
  symbols: ReferenceSymbol[];
}

export interface PackageReference {
  /** Unscoped name, `geom`. */
  package: string;
  specifier: string;
  /** The root entry first. */
  modules: ReferenceModule[];
}
