// The component's own entry, not the barrel: the barrel would bring every weasel-ui component into each frame.
import { Badge } from '@weasel-js/ui/components/Badge';

/** Marks a story tagged `lab`: opening it opens a whole screen, not a specimen. */
export function LabBadge({ className }: { className?: string }) {
  return (
    <Badge status="info" variant="subtle" size="sm" {...(className ? { className } : {})}>
      Lab
    </Badge>
  );
}
