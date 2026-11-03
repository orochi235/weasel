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
}

export interface ApiMember {
  name: string;
  kind: 'method' | 'property';
  /** A method's signature, arrow style, or a property's type. */
  signature: string;
  readonly: boolean;
  description?: string;
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

export interface ApiTable {
  props: ApiProp[];
  inherited: ApiInherited[];
  ref: ApiRef | null;
}
