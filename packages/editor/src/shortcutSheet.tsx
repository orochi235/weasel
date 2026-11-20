import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ShortcutTool, ToolSet, ToolsApi } from '@weasel-js/core';
import { KIT_TOOL_GROUPS } from '@weasel-js/editing';
import { ShortcutSheet, useShortcutSheetCommand } from '@weasel-js/ui/components/ShortcutSheet';
import type { EditorCommandOptions } from './editorCommands';

interface ShellTools {
  tools: { readonly registry: Readonly<Record<string, ShortcutTool>> };
  toolSets: readonly ToolSet[] | undefined;
}

// Publishes one caller's tools and returns what withdraws that publication alone.
const PublishTools = createContext<((tools: ShellTools) => () => void) | null>(null);

/**
 * Tells the `<EditorShell>` above which tools its canvas holds, grouped by `toolSets`, so its shortcut sheet lists
 * them by name and glyph. Does nothing outside a shell. The newest caller still mounted wins; unmounting withdraws only
 * the caller's own, so the sheet goes back to the one published before it.
 */
export function usePublishEditorTools(tools: ToolsApi | null, toolSets?: readonly ToolSet[]): void {
  const publish = useContext(PublishTools);
  const registry = tools?.registry;
  useEffect(() => {
    if (!publish || !registry) return;
    return publish({ tools: { registry }, toolSets });
  }, [publish, registry, toolSets]);
}

/** {@link usePublishEditorTools} as an element, for a host that holds its `ToolsApi` above the shell. */
export function PublishEditorTools({ tools, toolSets }: { tools: ToolsApi | null; toolSets?: readonly ToolSet[] }): null {
  usePublishEditorTools(tools, toolSets);
  return null;
}

function SheetCommand({ options, open }: { options: EditorCommandOptions; open: () => void }): null {
  useShortcutSheetCommand(open, options);
  return null;
}

/** The shell's `shortcuts.show` and the sheet it opens, listing the tools `usePublishEditorTools` publishes. */
export function ShortcutSheetHost({ options, children }: { options: EditorCommandOptions | null; children: ReactNode }) {
  // Every publication still held, oldest first; the sheet shows the last.
  const [held, setHeld] = useState<readonly ShellTools[]>([]);
  const publish = useCallback((tools: ShellTools) => {
    setHeld((was) => [...was, tools]);
    return () => setHeld((was) => was.filter((t) => t !== tools));
  }, []);
  const shown = held.length > 0 ? held[held.length - 1] : null;
  const [sheetOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  return (
    <PublishTools.Provider value={publish}>
      {children}
      {options !== null && (
        <>
          <SheetCommand options={options} open={open} />
          <ShortcutSheet
            open={sheetOpen}
            onOpenChange={setOpen}
            tools={shown?.tools ?? null}
            toolSets={shown?.toolSets ?? KIT_TOOL_GROUPS}
          />
        </>
      )}
    </PublishTools.Provider>
  );
}
