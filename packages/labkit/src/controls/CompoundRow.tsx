import type {
  PrefAliasTargets,
  PrefGroup,
  PrefLeaf,
  PrefList,
  PrefSection,
} from '@weasel-js/prefs';
import {
  entriesDisabled,
  entryDisabledAt,
  PrefControl,
  PrefTextList,
  prefListIsText,
  prefListTexts,
} from '@weasel-js/ui/components/Prefs';
import { withConfigValueAt } from '../config/path';
import type { LeafRenderer, ResolvedConfig } from '../config/types';
import { conditionedLeaf } from '../config/visible';
import { DraftDialogRow, type DraftDialogRowProps } from './DraftDialogRow';
import { useFieldChoices } from './fieldChoices';
import { extra } from './fields';

/** What a compound leaf's dialog holds: the leaf's control, with the conditions inside it applied. */
function CompoundControl({
  path,
  leaf,
  resolved,
  config,
  label,
  value,
  onChange,
  renderers,
  over,
  given,
}: {
  path: string;
  leaf: PrefLeaf;
  resolved: ResolvedConfig;
  config: Record<string, unknown>;
  over?: PrefGroup | PrefSection;

  /** What the leaf answers to when it is one of another schema, which `resolved` holds no conditions for. */
  given: PrefAliasTargets | undefined;
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  renderers: Record<string, LeafRenderer> | undefined;
}) {
  const choices = useFieldChoices();
  const inside = given ? { leaf, ...given } : conditionedLeaf(resolved, path, leaf, config, over);
  // Plain text entries keep the list's own fields, and the placeholder only they have.
  if (leaf.kind === 'list' && prefListIsText(leaf as PrefList, renderers?.string !== undefined)) {
    const list = leaf as PrefList;
    const texts = prefListTexts(value, list);
    const ctx = { path, disabledAt: inside.disabledAt, entryAt: inside.entryAt };
    return (
      <PrefTextList
        pref={list}
        aria-label={list.item.name || label}
        value={texts}
        onChange={onChange}
        minItems={list.minItems}
        maxItems={list.maxItems}
        placeholder={extra<string>(leaf, 'placeholder')}
        disabled={entriesDisabled(ctx)}
        entryDisabled={entryDisabledAt(ctx, list.item, texts)}
      />
    );
  }
  return (
    <PrefControl
      pref={inside.leaf}
      path={path}
      value={value}
      values={config}
      onChange={onChange}
      renderers={renderers}
      fields={choices}
      disabledAt={inside.disabledAt}
      entryAt={inside.entryAt}
    />
  );
}

type CompoundControlProps = Parameters<typeof CompoundControl>[0];

/** A compound leaf's row: a dialog whose control edits a draft of the value. */
export function CompoundRow({
  dialog,
  control,
  value,
  setValue,
}: {
  dialog: Omit<DraftDialogRowProps, 'value' | 'setValue' | 'children'>;
  control: Omit<CompoundControlProps, 'value' | 'onChange'>;
  value: unknown;
  setValue: (value: unknown) => void;
}) {
  return (
    <DraftDialogRow {...dialog} value={value} setValue={setValue}>
      {(draft, setDraft) => (
        <CompoundControl
          {...control}
          // A condition inside the leaf reads the value being edited, not the one stored.
          config={withConfigValueAt(control.config, control.path, draft)}
          value={draft}
          onChange={setDraft}
        />
      )}
    </DraftDialogRow>
  );
}
