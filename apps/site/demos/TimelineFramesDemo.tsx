import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SceneCanvas, asNodeId, easeInOutCubic, rasterToPng, renderTimelineFrames, scenePoseTarget, solid, useScene,
  type Fill, type RectPose,
} from '@weasel-js/core';
import { useAnimator } from '@weasel-js/animator/react';
import type { TimelineHandle } from '@weasel-js/animator';
import { Button } from '@weasel-js/ui/components/Button';
import { DemoStage } from './DemoStage';

const W = 480, H = 200, FPS = 12;
// Chromium drops downloads started closer together than about 100 ms past the first ten.
const DOWNLOAD_GAP_MS = 120;
const BALL = asNodeId('ball');
const at = (x: number, y: number): RectPose => ({ x, y, width: 40, height: 40 });

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function TimelineFramesDemo() {
  const scene = useScene<{ fill: Fill }, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    initial: useMemo(() => [
      { id: BALL, kind: 'mark' as const, layer: 'main' as const, pose: at(20, 140), data: { fill: { paint: solid('#5b8fd4') } } },
    ], []),
    subscribe: false,
  });
  const animator = useAnimator();
  const [timeline, setTimeline] = useState<TimelineHandle | null>(null);
  const [status, setStatus] = useState('');
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const target = scenePoseTarget(scene, BALL)!;
    const tl = animator.timeline({
      loop: true,
      tracks: [{
        kind: 'sampled', target,
        keys: [
          { t: 0, value: at(20, 140) },
          { t: 1000, value: at(220, 20), easing: easeInOutCubic },
          { t: 2000, value: at(420, 140), easing: easeInOutCubic },
        ],
      }],
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hands over the timeline this effect creates
    setTimeline(tl);
    return () => { tl.cancel(); };
  }, [animator, scene]);

  const save = async () => {
    if (!timeline) return;
    const ac = new AbortController();
    abort.current = ac;
    try {
      const frames = renderTimelineFrames({
        timeline, fps: FPS, includeEnd: true, signal: ac.signal,
        render: { scene, sourceRect: { x: 0, y: 0, width: W, height: H }, scale: { x: 1, y: 1 }, background: '#ffffff' },
        onProgress: ({ index, count }) => setStatus(`frame ${String(index + 1)} of ${String(count)}`),
      });
      for await (const frame of frames) {
        if (frame.index > 0) await new Promise((resolve) => setTimeout(resolve, DOWNLOAD_GAP_MS));
        download(await rasterToPng(frame.image), `frame-${String(frame.index).padStart(3, '0')}.png`);
      }
      setStatus('saved');
    } catch (e) {
      setStatus(ac.signal.aborted ? 'canceled' : String(e));
    } finally {
      abort.current = null;
    }
  };

  return (
    <div>
      <div className="ckd-toolbar">
        <Button onClick={() => { void save(); }}>save frames</Button>
        <Button onClick={() => abort.current?.abort()}>cancel</Button>
        <span>{status}</span>
      </div>
      <DemoStage width={W} height={H}>
        <SceneCanvas className="ckd-canvas" scene={scene} features={[]} animator={animator} />
      </DemoStage>
    </div>
  );
}
