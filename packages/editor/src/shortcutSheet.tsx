import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ShortcutTool, ToolSet, ToolsApi } from '@weasel-js/core';
import { ShortcutSheet, useShortcutSheetCommand } from '@weasel-js/ui/components/ShortcutSheet';
import type { EditorCommandOptions } from './editorCommands';

interface ShellTools {
  tools: { readonly registry: Readonly<Record<string, ShortcutTool>> };
  toolSets: readonly ToolSet[] | undefined;
}

const PublishTools = createContext<((tools: ShellTools | null) => void) | null>(null);

/**
 * Tells the `<EditorShell>` above which tools its canvas holds, grouped by `toolSets`, so its shortcut sheet lists
 * them by name and glyph. Does nothing outside a shell. The newest caller wins; unmounting withdraws them.
 */
export function useEditorTools(tools: ToolsApi | null, toolSets?: readonly ToolSet[]): void {
  const publish = useContext(PublishTools);
  const registry = tools?.registry;
  useEffect(() => {
    if (!publish || !registry) return;
    publish({ tools: { registry }, toolSets });
    return () => publish(null);
  }, [publish, registry, toolSets]);
}

/** {@link useEditorTools} as an element, for a host that holds its `ToolsApi` above the shell. */
export function EditorTools({ tools, toolSets }: { tools: ToolsApi | null; toolSets?: readonly ToolSet[] }): null {
  useEditorTools(tools, toolSets);
  return null;
}

function SheetCommand({ options, open }: { options: EditorCommandOptions; open: () => void }): null {
  useShortcutSheetCommand(open, options);
  return null;
}

/** The shell's `shortcuts.show` and the sheet it opens, listing the tools `useEditorTools` publishes. */
export function ShortcutSheetHost({ options, children }: { options: EditorCommandOptions | null; children: ReactNode }) {
  const [shown, setShown] = useState<ShellTools | null>(null);
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  return (
    <PublishTools.Provider value={setShown}>
      {children}
      {options !== null && (
        <>
          <SheetCommand options={options} open={open} />
          <ShortcutSheet
            isOpen={isOpen}
            onOpenChange={setOpen}
            tools={shown?.tools ?? null}
            {...(shown?.toolSets ? { toolSets: shown.toolSets } : {})}
          />
        </>
      )}
    </PublishTools.Provider>
  );
}
