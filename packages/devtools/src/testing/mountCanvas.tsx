/** A `<SceneCanvas>` in jsdom with a small scene, for the panel's tests: a group holding one leaf, and a second leaf. */
import { vi } from 'vitest';
import { SceneCanvas, useScene, type NodeId } from '@weasel-js/core';
import type { DevtoolsRoot } from '@weasel-js/core/devtools-protocol';
import { makeGLRecorder } from '@weasel-js/renderer/testing/glRecorder';

type Data = { label: string; paint?: () => void };
type Pose = { x: number; y: number; width: number; height: number };

/** Hands every canvas a recording WebGL2 context, since jsdom has none. */
export function stubWebGL(): void {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
}

export function TestCanvas({ label = 'board' }: { label?: string }) {
  const scene = useScene<Data, 'main', Pose>({
    systemLayers: [{ id: 'main' }],
    initial: [
      { id: 'group' as NodeId, kind: 'container', layer: 'main', pose: { x: 0, y: 0, width: 50, height: 50 }, data: { label: 'g' } },
      {
        id: 'inner' as NodeId, kind: 'leaf', layer: 'main', parent: 'group' as NodeId, locked: true,
        pose: { x: 5, y: 5, width: 10, height: 10 }, data: { label: 'inner', paint() {} },
      },
      { id: 'solo' as NodeId, kind: 'leaf', layer: 'main', pose: { x: 60, y: 60, width: 20, height: 20 }, data: { label: 'solo' } },
    ],
  });
  return <SceneCanvas scene={scene} width={200} height={200} tools={{ hand: true }} aria-label={label} />;
}

/** The root a mounted canvas registered, by its label. */
export function rootByLabel(label: string): DevtoolsRoot {
  const hook = window.__weaselDevtools__!;
  const info = hook.roots().find((r) => r.label === label);
  if (!info) throw new Error(`no canvas labeled "${label}"`);
  return hook.root(info.id)!;
}
