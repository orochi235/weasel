// The component's own entry, not the barrel: the barrel would bring every weasel-ui component into each frame.
import { Badge } from '@weasel-js/ui/components/Badge';
import { useContext } from 'react';
import { LibrariesContext } from '../../story/library';

/** A component's library, as a badge in the tone the project gave that library. */
export function LibraryBadge({ library, className }: { library: string; className?: string }) {
  const tone = useContext(LibrariesContext).toneOf(library);
  return (
    <Badge status="muted" {...(tone === undefined ? {} : { tone })} variant="subtle" size="sm" {...(className ? { className } : {})}>
      {library}
    </Badge>
  );
}
