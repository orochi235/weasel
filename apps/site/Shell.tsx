import { ActionsProvider, IconRegistryProvider, SelectionContextProvider } from '@weasel-js/core';
import { icons as coreIcons } from '@weasel-js/core/icons';
import { icons as pathToolsIcons } from '@weasel-js/path-tools/icons';
import { icons as uiIcons } from '@weasel-js/ui/icons';
import { registerDefaultFont } from '../shared/defaultFont';
import { WeaselDemos } from './WeaselDemos';

registerDefaultFont('weasel demo');

const ICONS = [coreIcons, uiIcons, pathToolsIcons];

// Top-level <ActionsProvider> consolidates standalone hooks
// (useSelectAll / useEscape / etc.) onto a single keydown listener.
// Each demo's hook still works — when a registry is in scope, the hook
// registers an Action with the registry instead of attaching its own
// document keydown listener (back-compat path lives in each hook).
export default function Shell() {
  return (
    <IconRegistryProvider icons={ICONS}>
      <ActionsProvider>
        <SelectionContextProvider>
          <WeaselDemos />
        </SelectionContextProvider>
      </ActionsProvider>
    </IconRegistryProvider>
  );
}
