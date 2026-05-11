import { useRef, useState, useEffect } from 'react';
import { Canvas, useHandTool, useTools } from '../../src';
import type { CanvasExtensionApi } from '../../src';
import { useHud } from '../../packages/weasel-hud/src/react';
import type { ButtonWidget } from '../../packages/weasel-hud/src';

const W = 600, H = 400;

export function HudDemo() {
  const ref = useRef<CanvasExtensionApi>(null);
  const hud = useHud(ref);
  const [count, setCount] = useState(0);
  const btnRef = useRef<ButtonWidget | null>(null);

  // A hand tool is the simplest tool structure; it wires the pointer dispatcher
  // which is required for HUD hit-tests to fire.
  const hand = useHandTool();
  const tools = useTools({ active: 'hand', registry: { hand } });

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
        <code> @orochi235/weasel-hud</code>.
      </p>
      <Canvas
        ref={ref}
        width={W}
        height={H}
        className="ckd-canvas"
        tools={tools}
        layers={{}}
      />
      <p style={{ marginTop: 8, color: '#555' }}>
        React state counter: <strong>{count}</strong>
      </p>
    </div>
  );
}
