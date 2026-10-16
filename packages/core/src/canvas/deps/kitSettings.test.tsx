import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { KitSettingsProvider } from '@weasel-js/react';
import { useKitSettingsDepSource } from './kitSettings';

function Wire({ onR }: { onR: (r: DepRegistry) => void }) {
  useKitSettingsDepSource();
  onR(useDepRegistry());
  return null;
}

describe('useKitSettingsDepSource', () => {
  it('publishes the nearest provider\'s store as the kitSettings dep', () => {
    let reg!: DepRegistry;
    render(
      <KitSettingsProvider value={{ gestures: { dragPx: 12 } }}>
        <DepRegistryProvider>
          <Wire onR={(r) => { reg = r; }} />
        </DepRegistryProvider>
      </KitSettingsProvider>,
    );
    expect(reg.get('kitSettings')?.get('gestures.dragPx')).toBe(12);
  });

  it('publishes a store that sets nothing with no provider', () => {
    let reg!: DepRegistry;
    render(
      <DepRegistryProvider>
        <Wire onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    expect(reg.get('kitSettings')?.get('gestures.dragPx')).toBeUndefined();
  });
});
