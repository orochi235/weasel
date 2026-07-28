import { useRef, useState, useEffect } from 'react';
import { SceneCanvas, useScene } from '@weasel-js/core';
import type { SceneCanvasApi } from '@weasel-js/core';
import { useHud, useHudTool } from '../../../packages/hud/src/react';
import type { ButtonWidget } from '../../../packages/hud/src';

const W = 600, H = 400;

interface Empty { id: string }

export function HudDemo() {
  const ref = useRef<SceneCanvasApi>(null);
  const hud = useHud(ref);
  // The HUD's input routing rides an ambient tool: its bindings gate on the
  // affordance its own layer hit-test produces, so they never compete with
  // whatever tool is active.
  const hudTool = useHudTool();
  const [count, setCount] = useState(0);
  const btnRef = useRef<ButtonWidget | null>(null);

  // Empty scene — this demo's content is the HUD layer, not scene nodes.
  const scene = useScene<Empty>({ items: [] });

  // Create the button once, after the HUD attaches.
  useEffect(() => {
    if (!hud.attached || btnRef.current) return;
    const btn = hud.button({ id: 'inc', x: 12, y: 12, w: 140, h: 34, label: 'Click me' });
    btn.on('press', () => setCount(c => c + 1));
    btnRef.current = btn;
    return () => {
      btn.dispose();
      btnRef.current = null;
    };
  }, [hud, hud.attached]);

  // Sync the label on count changes.
  useEffect(() => {
    if (!btnRef.current) return;
    btnRef.current.setLabel(count === 0 ? 'Click me' : `Clicks: ${count}`);
  }, [count]);

  return (
    <div style={{ padding: 20 }}>
      <h1>HUD Demo</h1>
      <p>
        Click the button rendered in the WebGL canvas. The counter increments
        each click. The button is a HUD widget drawn in screen space via
        <code> @weasel-js/hud</code>.
      </p>
      <SceneCanvas
        ref={ref}
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        defaultTools={['select']}
        ambient={[hudTool]}
      />
      <p style={{ marginTop: 8, color: '#555' }}>
        React state counter: <strong>{count}</strong>
      </p>
    </div>
  );
}
