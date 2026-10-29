import { sameView, type View } from 'core/viewport/view';

/** A move within this of a whole device pixel is one: the renderer's own slack. */
const SLACK = 1e-4;

/**
 * The view a canvas draws each frame under. While the view moves, its
 * translation is rounded to whole device pixels from where the view last
 * held, so a retained layer's surface moves whole pixels and is composited
 * rather than drawn; once the view holds for a frame, it draws exactly.
 * Hit-testing and every other reader of the view keep the exact one.
 *
 * The rounding is from where the view last held rather than from zero
 * because that is where retained surfaces are drawn.
 */
export class ViewSnap {
  private last: View | undefined;
  /** The translation, CSS pixels, of the frame last drawn holding. */
  private grid: readonly [number, number] | undefined;
  private snapped = false;
  private moved = false;

  /** The view to draw `view` under, at `scale` device pixels to the CSS
   *  pixel. `snap` false draws every view exactly. */
  draw(view: View, scale: number, snap: boolean): View {
    const moving = this.last !== undefined && !sameView(this.last, view);
    this.last = view;
    const t = translationOf(view);
    const grid = this.grid;
    if (!snap || !moving || grid === undefined) {
      this.moved = snap && grid !== undefined && !(whole((t[0] - grid[0]) * scale) && whole((t[1] - grid[1]) * scale));
      this.grid = t;
      this.snapped = false;
      return view;
    }
    const x = grid[0] + Math.round((t[0] - grid[0]) * scale) / scale;
    const y = grid[1] + Math.round((t[1] - grid[1]) * scale) / scale;
    this.moved = false;
    this.snapped = x !== t[0] || y !== t[1];
    if (!this.snapped) return view;
    return { x: -x / view.scale.x, y: -y / view.scale.y, scale: view.scale };
  }

  /**
   * Whether the frame just drawn owes the canvas another: a snapped one, so
   * the view is drawn exactly once it holds; and the frame it holds on, when
   * that drew a retained layer straight through for being off the pixel grid
   * its surface was drawn on, so the next frame draws the surface again on
   * the grid the next move rounds to. `declined` is the renderer's count of
   * retained layers it drew straight through.
   */
  owesFrame(declined: number): boolean {
    return this.snapped || (this.moved && declined > 0);
  }
}

function translationOf(view: View): readonly [number, number] {
  return [-view.x * view.scale.x, -view.y * view.scale.y];
}

function whole(n: number): boolean {
  return Math.abs(n - Math.round(n)) <= SLACK;
}
