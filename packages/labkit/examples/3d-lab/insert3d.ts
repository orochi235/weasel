/**
 * The lab's `insert` dep: kernel3d casts the drag onto the ground, and the box
 * it mints lands in the container the `insertInto` dep names, read at each
 * insert the way core's own insert reads it.
 */

import { useMemo } from 'react';
import { useDepRegistry, type InsertDep, type NodeId } from '@weasel-js/core';
import { createInsert, pose3, type ViewportSource } from '@weasel-js/kernel3d';
import type { SolidScene } from './scene3d';

export function useBoxInsert(scene: SolidScene, viewport: ViewportSource): InsertDep {
  const registry = useDepRegistry();
  return useMemo(() => {
    const parentOf = (): NodeId | null => {
      const into = registry.get('insertInto')?.get();
      return into != null && scene.get(into as NodeId)?.kind === 'group' ? into as NodeId : null;
    };
    return createInsert({
      viewport,
      mint: ({ center, width, depth }) => {
        const height = (width + depth) / 2;
        // Under the scene's identity composition a child's pose is a world
        // pose, so the box needs no conversion into its container.
        return scene.add({
          kind: 'mark',
          layer: 'solids',
          parent: parentOf(),
          pose: pose3({ x: center.x, y: height / 2, z: center.z }, { x: width, y: height, z: depth }),
          data: { kind: 'box', color: '#c49a3f' },
        });
      },
    });
  }, [registry, scene, viewport]);
}
