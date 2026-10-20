import type { ActionItem } from '@weasel-js/core';
import { PrefsDialog } from '../Prefs/PrefsDialog';
import { useActionSettings } from './useActionSettings';

/** Props for {@link ActionSettingsDialog}. */
export interface ActionSettingsDialogProps {
  /** The entry whose action's settings to show; `null` keeps the dialog closed. */
  item: ActionItem | null;
  onClose: () => void;
}

/**
 * An action's settings form in a dialog, titled by its schema's name: what a
 * command palette opens for an entry that carries settings, since running it
 * bare would change nothing. Each change triggers the action.
 */
export function ActionSettingsDialog({ item, onClose }: ActionSettingsDialogProps) {
  const form = useActionSettings(item ?? undefined);
  if (!item || !form) return null;
  return (
    <PrefsDialog
      isOpen
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={form.schema.name || item.label}
      schema={form.schema}
      layout="list"
      values={form.values}
      mixed={form.mixed}
      onChange={form.onChange}
    />
  );
}
