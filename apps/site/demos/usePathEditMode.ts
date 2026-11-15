import { useMemo, useState } from 'react';
import type { PathEditHost } from '@weasel-js/core';
import { createModeRegistry, DEFAULT_MODES } from '@weasel-js/modes';

/**
 * Path edit as a mode the trial holds, its target the open path. The mode
 * starts on the Anchors tool and leaving it puts back the tool it replaced;
 * the trial palette and the canvas share one active tool.
 */
export function usePathEditMode(seeded: string) {
  const [modes] = useState(() => createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' }));
  const [target, setTarget] = useState<string | null>(seeded);
  const pathEdit = useMemo<PathEditHost>(() => ({
    editingId: () => (modes.current().id === 'path-edit' ? target : null),
    setEditingId: (id) => {
      setTarget(id);
      modes.setMode(id ? 'path-edit' : 'normal');
    },
  }), [modes, target]);
  return { modes, pathEdit };
}
