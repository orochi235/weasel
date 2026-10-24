import { Badge } from '../Badge';
import s from './hidden.module.css';

/** On the element a surface draws for a node a `showIf` hides, when it is asked to draw those. */
export const HIDDEN_ATTR = 'data-pref-hidden';

/** What a surface that draws a schema takes to draw the nodes its conditions hide. */
export interface MarkHiddenProps {
  /**
   * Draw each node whose `showIf` fails, where the surface otherwise leaves
   * it out: dimmed, under a `hidden` badge on its row or its heading, and as
   * open to a press, a selection, or a drag as any other. For a surface that
   * authors the schema it draws, where a node not drawn cannot be picked. A
   * node an `enableIf` disables is drawn disabled either way.
   */
  markHidden?: boolean;
}

/**
 * Whether the node at `path` carries the mark: it is among `hidden`, and what
 * it sits in is not, which carries the mark for everything in it.
 */
export function marksHidden(hidden: ReadonlySet<string> | undefined, path: string): boolean {
  if (hidden === undefined || !hidden.has(path)) return false;
  const within = path.slice(0, Math.max(0, path.lastIndexOf('.')));
  return within === '' || !hidden.has(within);
}

/** The attribute a marked node's element carries. */
export function hiddenAttrs(marked: boolean): Record<string, string | undefined> {
  return { [HIDDEN_ATTR]: marked ? '' : undefined };
}

/**
 * The word a marked node carries: beside its name, with `lead` on a line of
 * its own above what has none, or `gapped` in a row that spaces its own children.
 */
export function HiddenBadge({ lead = false, gapped = false }: { lead?: boolean; gapped?: boolean }) {
  const badge = (
    <Badge size="xs" emphasis="low" variant="outline" className={[s.badge, lead && s.lead, gapped && s.gapped].filter(Boolean).join(' ')}>
      hidden
    </Badge>
  );
  // An outline badge is inline text, so with no break before it a name and its badge are one word, which a
  // narrow label column cannot wrap.
  return lead || gapped ? badge : <><wbr />{badge}</>;
}
