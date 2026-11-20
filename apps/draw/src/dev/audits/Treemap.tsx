import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SceneCanvas, asNodeId, type SelectionApi } from '@weasel-js/core';
import { useAnimator } from '@weasel-js/animator/react';
import { usePrefersReducedMotion, watchResize } from '@weasel-js/react';
import * as presets from '@weasel-js/editing/presets';
import { auditNodeSpecs, breathe, syncAuditScene, type AuditPalette, type AuditScene } from './auditScene';
import { layoutMap } from './mapLayout';
import type { AuditArea } from './skulkMap.types';
import s from './Treemap.module.css';

const FEATURES = [presets.pick];
const SELECTION_OPTIONS = { mode: 'single' } as const;

export interface TreemapProps {
  readonly scene: AuditScene;
  readonly selection: SelectionApi;
  readonly areas: readonly AuditArea[];
  readonly palette: AuditPalette;
  readonly onHover: (id: string | null) => void;
}

/** Every audit area as a cell of a treemap drawn on the scene graph: hover and click pick through the canvas's
 *  own hit testing and selection. */
export function Treemap({ scene, selection, areas, palette, onHover }: TreemapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => setSize((was) => {
      const width = Math.floor(host.clientWidth), height = Math.floor(host.clientHeight);
      return was.width === width && was.height === height ? was : { width, height };
    });
    measure();
    return watchResize(host, measure);
  }, []);

  const layout = useMemo(() => layoutMap(areas, size.width, size.height), [areas, size]);
  useLayoutEffect(() => {
    syncAuditScene(scene, auditNodeSpecs(areas, layout, palette));
  }, [scene, areas, layout, palette]);

  const liveIds = useMemo(() => areas.filter((a) => a.status === 'tonight').map((a) => asNodeId(a.id)), [areas]);
  const animator = useAnimator();
  const still = usePrefersReducedMotion();
  useEffect(() => {
    if (still || liveIds.length === 0) return;
    const pulse = animator.tweenLoop({
      from: 1, to: 0.35, ms: 1100, direction: 'alternate', easing: 'easeInOutCubic',
      onTick: (v: number) => breathe(scene, liveIds, v),
    });
    return () => {
      pulse.cancel();
      breathe(scene, liveIds, 1);
    };
  }, [animator, still, scene, liveIds]);

  return (
    <div className={s.chart}>
      <div ref={hostRef} className={s.host} role="img" aria-label="Treemap of every audit area, sized by source files">
        <SceneCanvas
          className={s.canvas}
          scene={scene}
          features={FEATURES}
          selection={selection}
          selectionOptions={SELECTION_OPTIONS}
          backgroundFill={{ color: palette.panel }}
          animator={animator}
          onHover={onHover}
        />
      </div>
      <div className={s.legend}>
        <span><i className={`${s.key} ${s.uncharted}`} />never audited</span>
        <span>
          audited, estimated defects left after the last pass:
          <span className={s.ramp}>
            <i className={s.depth0} /><i className={s.depth1} /><i className={s.depth2} /><i className={s.depth3} /><i className={s.depth4} />
          </span>
          0 → 6+
        </span>
        <span><i className={`${s.key} ${s.settled}`} />settled</span>
        <span><i className={`${s.key} ${s.live}`} />in a live run</span>
        <span>· a dot per pass · numbers are queue order</span>
      </div>
    </div>
  );
}
