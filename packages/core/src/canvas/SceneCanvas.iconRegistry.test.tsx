/** The icon registry's two wiring points: `<WeaselProvider>` and `<SceneCanvas>`. */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import type { IconTable } from '@weasel-js/icons';
import { createScene } from 'core/scene/scene';
import { IconRegistryProvider, useIconGlyph, useIconRegistry } from '../iconRegistry';
import { WeaselProvider } from '../WeaselProvider';
import { SceneCanvas } from './SceneCanvas';

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
});

const core: IconTable = {
  namespace: 'core', owner: '@weasel-js/core',
  icons: { undo: { body: '<path d="u"/>', group: 'History', tags: [] } },
};

function Probe({ seen }: { seen: { body?: string; registry?: unknown } }) {
  seen.body = useIconGlyph('core:undo')?.body;
  seen.registry = useIconRegistry();
  return null;
}

function canvas(seen: object) {
  const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  return (
    <SceneCanvas<D, L, P> scene={scene} width={100} height={100}>
      <Probe seen={seen} />
    </SceneCanvas>
  );
}

describe('icon registry wiring', () => {
  it('WeaselProvider with icons serves them to a child', () => {
    const seen: { body?: string } = {};
    render(<WeaselProvider icons={core}><Probe seen={seen} /></WeaselProvider>);
    expect(seen.body).toBe('<path d="u"/>');
  });

  it('WeaselProvider without icon props defers to the registry in scope', () => {
    const seen: { body?: string } = {};
    render(
      <IconRegistryProvider icons={core}>
        <WeaselProvider><Probe seen={seen} /></WeaselProvider>
      </IconRegistryProvider>,
    );
    expect(seen.body).toBe('<path d="u"/>');
  });

  it('SceneCanvas defers to the registry in scope', () => {
    const seen: { body?: string } = {};
    render(<IconRegistryProvider icons={core}>{canvas(seen)}</IconRegistryProvider>);
    expect(seen.body).toBe('<path d="u"/>');
  });

  it('a bare SceneCanvas gives its children a registry', () => {
    const seen: { registry?: unknown } = {};
    render(canvas(seen));
    expect(seen.registry).not.toBeNull();
    expect(seen.registry).toBeDefined();
  });
});
