// The component's own entry, not the barrel: the barrel would bring every weasel-ui component into each frame.
import { Badge } from '@weasel-js/ui/components/Badge';

/** `swatch` mixed toward the foreground, further in light mode: a bright swatch needs more of the dark foreground to
 *  hold 4.5:1 as small text on its own tint, and a dark swatch less of the light one. */
const tone = (swatch: string, light: number, dark: number): string =>
  `light-dark(color-mix(in oklab, var(--wzl-swatch-${swatch}), var(--wzl-fg) ${light}%), ` +
  `color-mix(in oklab, var(--wzl-swatch-${swatch}), var(--wzl-fg) ${dark}%))`;

/** Each package's peer tone. */
const LIBRARY_TONES: Readonly<Record<string, string>> = {
  ui: tone('blue', 55, 35),
  labkit: tone('teal', 55, 45),
  forge: tone('amber', 55, 40),
  draw: tone('rose', 55, 35),
};

/** A component's package, as a badge toned per package. */
export function LibraryBadge({ library, className }: { library: string; className?: string }) {
  return (
    <Badge status="muted" tone={LIBRARY_TONES[library]} variant="subtle" size="sm" {...(className ? { className } : {})}>
      {library}
    </Badge>
  );
}
