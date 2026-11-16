import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { createModeRegistry, DEFAULT_MODES } from '@weasel-js/modes';
import { DepRegistryProvider, useDepRegistry } from '@weasel-js/routing/react';
import { useEffect } from 'react';
import { useDepChangeNotices } from './changes';

describe('useDepChangeNotices', () => {
  it('tells the dep registry when the active mode switches', () => {
    const modes = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });
    let notices = 0;
    function Probe() {
      useDepChangeNotices(undefined, modes);
      const registry = useDepRegistry();
      useEffect(() => registry.subscribe?.(() => { notices++; }), [registry]);
      return null;
    }
    render(<DepRegistryProvider><Probe /></DepRegistryProvider>);
    const before = notices;
    act(() => modes.setMode('path-edit'));
    expect(notices).toBeGreaterThan(before);
  });
});
