import { useRef, useState, useEffect } from 'react';
import { SceneCanvas, useScene } from '../../../src';
import type { CanvasExtensionApi } from '../../../src';
import { useHud } from '../../../packages/hud/src/react';
import type { ButtonWidget } from '../../../packages/hud/src';

const W = 600, H = 400;

interface Empty { id: string }

export function HudDemo() {
  const ref = useRef<CanvasExtensionApi>(null);
  const hud = useHud(ref);
  const [count, setCount] = useState(0);
  const btnRef = useRef<ButtonWidget | null>(null);

  // Empty scene — this demo's content is the HUD layer, not scene nodes.
  // SceneCanvas auto-mounts the gesture dispatcher (which HUD hit-tests
  // ride on top of), so we don't need to register a tool just to wire it.
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
      />
      <p style={{ marginTop: 8, color: '#555' }}>
        React state counter: <strong>{count}</strong>
      </p>
    </div>
  );
}
