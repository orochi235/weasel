import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DepRegistryProvider, type DepRegistry, useDepRegistry } from '@weasel-js/core';
import { defaultToastQueue, ToastRegion } from '@weasel-js/ui/components/Toast';
import { NoticesPublisher } from './adapterPublishers';
import { renderWithIcons } from './testIcons';

afterEach(() => act(() => defaultToastQueue.clear()));

describe('NoticesPublisher', () => {
  it("raises a kit action's notice as a warning toast", () => {
    let registry: DepRegistry | null = null;
    function Probe() {
      registry = useDepRegistry();
      return null;
    }
    renderWithIcons(
      <DepRegistryProvider>
        <NoticesPublisher />
        <Probe />
        <ToastRegion />
      </DepRegistryProvider>,
    );
    act(() => (registry as unknown as DepRegistry).get('notices')!.warn('Text in "Nowhere" can\'t be converted to outlines'));
    expect(screen.getByText('Text in "Nowhere" can\'t be converted to outlines')).toBeInTheDocument();
  });
});
