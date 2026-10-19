import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createDispatchTrace, createTraceRing } from '@weasel-js/routing';
import { createDevtoolsRoot, installDevtoolsHook, type DevtoolsRootSource } from '@weasel-js/core/devtools';
import { portPair } from './testing/fakePorts';
import { PORT_PAGE } from './envelope';
import { createContentBridge } from './content/bridge';
import { createRelay } from './background/relay';
import { createPortTransport } from './panel/portTransport';
import { PanelPlaceholder } from './panel/PanelPlaceholder';

function source(label: string): DevtoolsRootSource {
  return {
    label: () => label,
    dimension: '2d',
    scene: () => null,
    selection: () => [],
    select: () => {},
    view: () => null,
    activeTool: () => null,
    tools: () => [],
    setTool: () => {},
    trace: createDispatchTrace(),
    coords: createTraceRing(),
    frame: () => null,
    overlays: () => null,
    setOverride: () => {},
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  delete window.__weaselDevtools__;
});

describe('the extension, end to end', () => {
  it('shows the panel the roots of the inspected page', async () => {
    // A browser gives a window's own posts `source: window`; jsdom leaves it null, and the bridge drops those.
    vi.spyOn(window, 'postMessage').mockImplementation((data: unknown) => {
      setTimeout(() => window.dispatchEvent(new MessageEvent('message', { data, source: window })));
    });
    const hook = installDevtoolsHook()!;
    const unregister = hook.register(createDevtoolsRoot(source('demo canvas')));

    const stops: (() => void)[] = [];
    const relay = createRelay({
      wake(tabId) {
        const [content, background] = portPair(PORT_PAGE, { tab: { id: tabId }, frameId: 0 });
        stops.push(createContentBridge(window, content));
        relay.connect(background);
      },
    });
    const transport = createPortTransport(12, (name) => {
      const [panel, background] = portPair(name);
      relay.connect(background);
      return panel;
    });

    const view = render(<PanelPlaceholder transport={transport} />);
    expect(await screen.findByText('demo canvas')).toBeInTheDocument();

    unregister();
    await waitFor(() => expect(screen.queryByText('demo canvas')).toBeNull());

    view.unmount();
    transport.close();
    for (const stop of stops) stop();
  });
});
