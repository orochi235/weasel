import { SceneCanvas, WeaselProvider } from '@weasel-js/core';
import type { RectPose, Scene } from '@weasel-js/core';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { watchResize } from '@weasel-js/react';

/** Mounts a scene in a trial. The absolute child is load-bearing: SceneCanvas
 *  sizes its own `<canvas>`, and on a flow-layout parent that feeds the resize
 *  observer back into itself. */
export function SceneHost<TData>({ scene }: { scene: Scene<TData, 'default', RectPose> }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    return watchResize(el, ([entry]) => {
      if (!entry) return;
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      if (w <= 0 || h <= 0) return;
      setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    });
  }, []);

  return (
    <div ref={hostRef} className="sl-scene-host">
      <div className="sl-scene-fill">
        <SceneCanvas width={size.width} height={size.height} scene={scene} />
      </div>
    </div>
  );
}

/** `<SceneHost>` with the kit contexts it needs. */
export function SceneFrame<TData>({ scene }: { scene: Scene<TData, 'default', RectPose> }) {
  return (
    <WeaselProvider>
      <SceneHost scene={scene} />
    </WeaselProvider>
  );
}
