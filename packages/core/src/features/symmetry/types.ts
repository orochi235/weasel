/** Which line the drawing mirrors across: `'vertical'` mirrors left and right,
 *  `'horizontal'` top and bottom, and `'both'` all four quarters. */
export type SymmetryAxis = 'vertical' | 'horizontal' | 'both';

/** A live symmetry setting: the axes, and the world point they cross at. */
export interface Symmetry {
  readonly axis: SymmetryAxis;
  readonly center: { readonly x: number; readonly y: number };
}

/**
 * The `symmetry` dep: the setting in force, read when an insert is built and
 * when an anchor drag starts, and where dragging the axis on canvas writes.
 */
export interface SymmetryDep {
  /** The setting, or `null` while symmetry is off. */
  get(): Symmetry | null;
  /** Replace the setting; `null` turns symmetry off. */
  set(next: Symmetry | null): void;
}

/** A {@link SymmetryDep} that says when its setting changes, so the axis
 *  layer can repaint and a toolbar can show the toggle's state. */
export interface SymmetryStore extends SymmetryDep {
  subscribe(listener: () => void): () => void;
}
