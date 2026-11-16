/** `ShellDevtools` gives a shell's canvases devtools in development, and its switches withhold it. */
import { cleanup, render, waitFor } from '@testing-library/react';
import { AmbientContributionsProvider, drawPreset, SceneCanvas, useScene } from '@weasel-js/core';
import { createGLRecorder } from '@weasel-js/renderer/testing/glRecorder';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { devtools } from './hook';
import { DEV_DEVTOOLS, devtoolsOff, lazyDevtools, ShellDevtools, shellDevtools } from './mount';

beforeAll(() => {
  const recorder = createGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

type Box = { x: number; y: number; width: number; height: number };

function Board({ label }: { label: string }) {
  const scene = useScene<null, 'main', Box>({ systemLayers: [{ id: 'main' }] });
  return <SceneCanvas features={[drawPreset]} scene={scene} width={100} height={100} aria-label={label} />;
}

const labels = (): string[] => window.__weaselDevtools__?.roots().map((r) => r.label) ?? [];

/** Lets the lazy contribution's import settle, so a canvas that would register has. */
async function settled(): Promise<void> {
  await import('./hook');
  await new Promise((r) => setTimeout(r, 0));
}

const OFF = [devtoolsOff];
const ON = [devtools];

describe('ShellDevtools', () => {
  it('registers the canvases below it in a development build', async () => {
    render(<ShellDevtools><Board label="shell board" /></ShellDevtools>);
    await waitFor(() => expect(labels()).toContain('shell board'));
  });

  it('withholds devtools given devtools={false}, even under a provided devtools entry', async () => {
    render(
      <AmbientContributionsProvider contributions={ON}>
        <ShellDevtools devtools={false}><Board label="switched off" /></ShellDevtools>
      </AmbientContributionsProvider>,
    );
    await settled();
    expect(labels()).not.toContain('switched off');
  });

  it('withholds devtools under a provided devtoolsOff', async () => {
    const app = (children: ReactNode) => (
      <AmbientContributionsProvider contributions={OFF}>{children}</AmbientContributionsProvider>
    );
    render(app(<ShellDevtools><Board label="app off" /></ShellDevtools>));
    await settled();
    expect(labels()).not.toContain('app off');
  });

  it('lets devtools={true} override a provided devtoolsOff', async () => {
    render(
      <AmbientContributionsProvider contributions={OFF}>
        <ShellDevtools devtools><Board label="forced on" /></ShellDevtools>
      </AmbientContributionsProvider>,
    );
    await waitFor(() => expect(labels()).toContain('forced on'));
  });

  it('removes the root when the canvas unmounts', async () => {
    const view = render(<ShellDevtools><Board label="leaving" /></ShellDevtools>);
    await waitFor(() => expect(labels()).toContain('leaving'));
    view.unmount();
    expect(labels()).not.toContain('leaving');
  });
});

describe('shellDevtools', () => {
  it('provides the lazy contribution in development and nothing in production', () => {
    expect(shellDevtools(undefined, [], true)).toEqual([lazyDevtools]);
    expect(shellDevtools(undefined, [], false)).toEqual([]);
  });

  it('defers to a devtools entry provided above, and its own switch decides over both', () => {
    expect(shellDevtools(undefined, OFF, true)).toEqual([]);
    expect(shellDevtools(undefined, ON, false)).toEqual([]);
    expect(shellDevtools(false, ON, true)).toEqual([devtoolsOff]);
    expect(shellDevtools(true, OFF, false)).toEqual([lazyDevtools]);
  });
});

describe('DEV_DEVTOOLS', () => {
  it('holds the lazy contribution under vitest, a development build', () => {
    expect(DEV_DEVTOOLS).toEqual([lazyDevtools]);
  });

  it('is empty in a production build', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    const fresh = await import('./mount');
    expect(fresh.DEV_DEVTOOLS).toEqual([]);
  });
});
