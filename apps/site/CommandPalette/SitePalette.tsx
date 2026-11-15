import { useCallback, useState } from 'react';
import { ActionsProvider, ActiveToolContextProvider, DepRegistryProvider, useCommand, type BoundGesture } from '@weasel-js/core';
import { useEditorKeys } from '@weasel-js/editor';
import { CommandPalette } from '@weasel-js/ui/components/CommandPalette';

export const SITE_COMMANDS_ID = 'site.commands';

/** `/` as typed, with Shift where a layout needs it to type one. */
const PALETTE_KEY: BoundGesture = {
  spec: { kind: 'key', key: '/', mods: { shift: 'optional' } },
  opts: { id: `${SITE_COMMANDS_ID}.key` },
};

/**
 * The site's command palette and the registry it lists, which no demo shares: each demo's canvas keeps the
 * registries it would have on a page of its own. `/` opens it, except while typing in a field.
 */
export function SitePalette() {
  const [open, setOpen] = useState(false);
  return (
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>
          <SiteCommands openPalette={useCallback(() => setOpen(true), [])} />
          <CommandPalette open={open} onOpenChange={setOpen} />
        </ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>
  );
}

function SiteCommands({ openPalette }: { openPalette: () => void }) {
  useCommand(SITE_COMMANDS_ID, 'Commands', openPalette, { keys: PALETTE_KEY });
  useEditorKeys();
  return null;
}
