import { useRef, useState, useEffect } from 'react';
import { SceneCanvas, useScene } from '@weasel-js/core';
import { useHud, useHudContribution } from '@weasel-js/hud/react';
import type { ButtonWidget } from '@weasel-js/hud';

const W = 600, H = 400;

interface Empty { id: string }

export function HudDemo() {
  const hud = useHud();
  // One ambient entry installs the whole HUD: its layer, and input routing
  // gated on the affordance that layer's hit-test produces, so it never
  // competes with whatever tool is active. The app registers Inter as
  // `sans-serif` in main.tsx; without `font` the HUD fetches its own
  // byte-identical copy of the same atlas.
  const hudEntry = useHudContribution(hud, { font: 'sans-serif' });
  const [count, setCount] = useState(0);
  const btnRef = useRef<ButtonWidget | null>(null);

  // Empty scene — this demo's content is the HUD layer, not scene nodes.
  const scene = useScene<Empty>({ items: [] });

  // Widgets can be created before the HUD attaches; they paint once it does.
  useEffect(() => {
    if (btnRef.current) return;
    const btn = hud.button({ id: 'inc', x: 12, y: 12, w: 140, h: 34, label: 'Click me' });
    btn.on('press', () => setCount(c => c + 1));
    btnRef.current = btn;
    // Buttons take keyboard focus: Tab reaches them, Enter or Space presses.
    const reset = hud.button({ id: 'reset', x: 164, y: 12, w: 80, h: 34, label: 'Reset' });
    reset.on('press', () => setCount(0));
    return () => {
      reset.dispose();
      btn.dispose();
      btnRef.current = null;
    };
  }, [hud]);

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
        <code> @weasel-js/hud</code>. Focus the canvas and press Tab to move
        between the buttons, and Enter or Space to press the focused one.
      </p>
      <SceneCanvas features={['pick']}
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        ambient={[hudEntry]}
      />
      <p style={{ marginTop: 8, color: '#555' }}>
        React state counter: <strong>{count}</strong>
      </p>
    </div>
  );
}
