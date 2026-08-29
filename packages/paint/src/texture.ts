/**
 * A registered texture, named by the registry that holds it.
 *
 * The handle is here rather than beside the registry because `FillStyle`'s
 * pattern variant names it, and paint is a leaf: the registry lives in the
 * renderer and imports this back.
 */
export interface TextureHandle {
  readonly id: string;
}
