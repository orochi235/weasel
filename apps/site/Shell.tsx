import { ActionsProvider, IconRegistryProvider, SelectionContextProvider } from '@weasel-js/core';
import icons from 'virtual:weasel-icons';
import { registerDefaultFont } from '../shared/defaultFont';
import { WeaselDemos } from './WeaselDemos';

registerDefaultFont('weasel demo');

const ICON_VARIANTS = { all: () => import('virtual:weasel-icons/all') };

// Top-level <ActionsProvider> consolidates standalone hooks
// (useSelectAll / useEscape / etc.) onto a single keydown listener.
// Each demo's hook still works — when a registry is in scope, the hook
// registers an Action with the registry instead of attaching its own
// document keydown listener (back-compat path lives in each hook).
export default function Shell() {
  return (
    <IconRegistryProvider icons={icons} variants={ICON_VARIANTS}>
      <ActionsProvider>
        <SelectionContextProvider>
          <WeaselDemos />
        </SelectionContextProvider>
      </ActionsProvider>
    </IconRegistryProvider>
  );
}
