import { ShortcutSheet, useShortcutSheetCommand } from '@weasel-js/ui/components/ShortcutSheet';
import { useCallback, useMemo, useState } from 'react';
import type { TrialTool } from '../tools/types';

/** The lab's `shortcuts.show`, on Shift+/, and the sheet it opens: every key bound in the lab and the focused trial,
 *  the lab's tools named as its rail names them. */
export function LabShortcutSheet({ tools }: { tools: readonly TrialTool[] }) {
  const [isOpen, setOpen] = useState(false);
  useShortcutSheetCommand(useCallback(() => setOpen(true), []));
  const registry = useMemo(
    () => ({
      registry: Object.fromEntries(
        tools.map((t) => [t.id, { presentation: { label: t.label, icon: t.icon } }]),
      ),
    }),
    [tools],
  );
  return <ShortcutSheet isOpen={isOpen} onOpenChange={setOpen} tools={registry} toolSets={[]} />;
}
