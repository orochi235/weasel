// The component's own entry, not the barrel: the barrel would bring every weasel-ui component into each frame.
import { Badge } from '@weasel-js/ui/components/Badge';

/** Each package's peer tone: its swatch mixed toward the foreground, so the
 *  badge text keeps its contrast in both modes. */
const LIBRARY_TONES: Readonly<Record<string, string>> = {
  ui: 'color-mix(in oklab, var(--wzl-swatch-blue), var(--wzl-fg) 35%)',
  labkit: 'color-mix(in oklab, var(--wzl-swatch-teal), var(--wzl-fg) 45%)',
  forge: 'color-mix(in oklab, var(--wzl-swatch-amber), var(--wzl-fg) 40%)',
  draw: 'color-mix(in oklab, var(--wzl-swatch-rose), var(--wzl-fg) 35%)',
};

/** A component's package, as a badge toned per package. */
export function LibraryBadge({ library, className }: { library: string; className?: string }) {
  return (
    <Badge status="muted" tone={LIBRARY_TONES[library]} variant="subtle" size="sm" {...(className ? { className } : {})}>
      {library}
    </Badge>
  );
}
