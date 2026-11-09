/** The named export forge's vite plugin adds to a story module: the API of the meta's component. */
export const API_EXPORT = '__forgeApi';

export interface ApiProp {
  name: string;
  /** As its declaration spells it, else as the compiler prints it. */
  type: string;
  required: boolean;
  /** Source text: the component's destructuring default, else its `@default` tag. */
  default?: string;
  description?: string;
  /** The `@deprecated` tag's text; empty for a bare tag. */
  deprecated?: string;
  /** The type it is inherited from, where TypeDoc's output says. */
  inheritedFrom?: string;
}

export interface ApiMember {
  name: string;
  kind: 'method' | 'property';
  /** A method's signature, arrow style, or a property's type. */
  signature: string;
  readonly: boolean;
  description?: string;
  /** A method's further overloads, arrow style, where TypeDoc's output lists them. */
  overloads?: string[];
  /** The type it is inherited from, where TypeDoc's output says. */
  inheritedFrom?: string;
}

/** Props declared by the platform or a skipped package, counted per declaring type rather than listed. */
export interface ApiInherited {
  from: string;
  count: number;
}

/** What the component's `ref` takes. A platform type, such as an element, lists no members. */
export interface ApiRef {
  type: string;
  members: ApiMember[];
}

/** A type the project declares, named in a prop's or member's type: what a reader hovering the name sees. */
export interface ApiTypeDef {
  /** The declaration as written, comments and `export` dropped. */
  text: string;
  /** Its doc summary. */
  description?: string;
}

export interface ApiTable {
  props: ApiProp[];
  inherited: ApiInherited[];
  ref: ApiRef | null;
  /** The definitions of the project's own types named in `props` and `ref`, by name. */
  types?: Record<string, ApiTypeDef>;
  /** The component's page in the API reference, where TypeDoc's output documents it and forge was told its address. */
  href?: string;
}
