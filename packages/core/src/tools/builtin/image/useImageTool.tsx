import { useMemo } from 'react';
import { defineTool } from '../../defineTool';
import { ImageIcon } from '../../../icons';
import type { Tool } from '../../types';

export interface UseImageToolOptions {
  /** Image source for inserted nodes — a URL, a `blob:` URL, or a
   *  `data:image/…;base64,…` URI. Stored verbatim on each new node's
   *  `data.image.src`. */
  src: string;
  label?: string;
}

/**
 * Drag-to-insert image tool. A drag-rect commits a leaf node with
 * `data: { image: { src } }` through the dispatcher's `insertAction` + the
 * kit's `insert` dep (the same path the shape tools use); the `kit:image`
 * painter renders it once the bitmap decodes.
 *
 * Thin declarative veneer — the node is minted by `useInsertDepSource`'s
 * `'image'` case, not the tool. `src` is baked into the binding's `params`
 * so the insert dep can stamp it onto the new node.
 */
export function useImageTool(options: UseImageToolOptions): Tool<null> {
  const { src, label = 'Image' } = options;
  return useMemo(
    () =>
      defineTool<null>({
        id: 'image',
        capabilities: ['creates-shapes'],
        hookName: 'useImageTool',
        cursor: 'crosshair',
        presentation: {
          label,
          group: 'shape',
          icon: <ImageIcon />,
        },
        // Declarative binding routes empty-space drags through the
        // dispatcher + insertAction; `kind: 'image'` selects the insert
        // dep's image factory and `src` rides along on the new node.
        bindings: [
          {
            spec: { kind: 'drag' },
            actionId: 'insert',
            opts: { params: { kind: 'image', src } },
          },
        ],
      }),
    [src, label],
  );
}
