import { SceneCanvas, useSelection, WeaselProvider } from '@weasel-js/core';
import type { RectPose, Scene } from '@weasel-js/core';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/** Mounts a scene in a trial. The absolute child is load-bearing: SceneCanvas
 *  sizes its own `<canvas>`, and on a flow-layout parent that feeds the resize
 *  observer back into itself. */
export function SceneHost<TData>({ scene }: { scene: Scene<TData, 'default', RectPose> }) {
  const selection = useSelection();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      if (w <= 0 || h <= 0) return;
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="sl-scene-host">
      <div className="sl-scene-fill">
        <SceneCanvas width={size.w} height={size.h} scene={scene} selection={selection} />
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
