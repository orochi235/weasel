import { createModeRegistry, DEFAULT_MODES, type ModeDefinition, type ModeRegistry } from '@weasel-js/modes';
import { useLatest } from '@weasel-js/react';
import { useState } from 'react';
import { createPathEditHost, type PathEditHostOptions, type PathEditStore } from './createPathEditHost';

/** Options for {@link usePathEditMode}: the host's, read as the component mounts, apart from
 *  `editable`, read as of the last render. */
export interface UsePathEditModeOptions extends Omit<PathEditHostOptions, 'modes' | 'target'> {
  /** The modes the registry holds. Default `@weasel-js/modes`' `DEFAULT_MODES`. */
  definitions?: readonly ModeDefinition[];
}

/** What `<SceneCanvas>` takes for path edit as a mode: `modes` and `pathEdit`. */
export interface PathEditMode {
  modes: ModeRegistry;
  pathEdit: PathEditStore;
}

/**
 * A mode registry and a path-edit host driving it, made once for the component's life. It starts
 * in the path-edit mode on `id` when given one, and in `exitMode` otherwise.
 */
export function usePathEditMode(opts: UsePathEditModeOptions = {}): PathEditMode {
  const editable = useLatest(opts.editable);
  const [made] = useState((): PathEditMode => {
    const { definitions = DEFAULT_MODES, mode = 'path-edit', exitMode = 'normal' } = opts;
    const modes = createModeRegistry({ modes: definitions, initial: opts.id ? mode : exitMode });
    const pathEdit = createPathEditHost({
      ...opts, modes,
      editable: (id) => editable.current?.(id) ?? true,
    });
    return { modes, pathEdit };
  });
  return made;
}
