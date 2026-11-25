import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createModeRegistry } from '@weasel-js/modes';
import { useContributions } from './useContributions';
import { useOpenKeymap } from '../keymaps/useOpenKeymap';
import { ActiveToolContextProvider } from '../interactions/actions/activeToolContext';
import { DepRegistryProvider } from '../interactions/actions/depRegistry';
import { ActionsProvider } from '../interactions/actions/ActionsProvider';

describe('server rendering', () => {
  it('renders a tree reading contributions and the open keymap', () => {
    const modes = createModeRegistry({ modes: [{ id: 'draw', label: 'Draw', allows: [] }], initial: 'draw' });
    function Probe() {
      useContributions({ entries: [], focused: null, modes });
      useOpenKeymap();
      return <i>ok</i>;
    }
    const html = renderToString(
      <DepRegistryProvider><ActionsProvider><ActiveToolContextProvider><Probe /></ActiveToolContextProvider></ActionsProvider></DepRegistryProvider>,
    );
    expect(html).toContain('ok');
  });
});
