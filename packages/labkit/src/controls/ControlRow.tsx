import {
  type PrefAction,
  type PrefActions,
  type PrefAlias,
  type PrefAliasTargets,
  type PrefGroup,
  type PrefLeaf,
  type PrefList,
  type PrefSection,
  prefAliasName,
  prefIsCompound,
} from '@weasel-js/prefs';
import {
  entriesDisabled,
  entryDisabledAt,
  PrefActionButton,
  PrefActionRows,
  PrefControl,
  PrefTextList,
  PrefWords,
  prefDrawsActionRow,
  prefDrawsNoControl,
  prefListIsText,
  prefListTexts,
  withRowControl,
} from '@weasel-js/ui/components/Prefs';
import {
  PropertyField,
  PropertyRow,
  type PropertyRowLayout,
  PropertySpan,
} from '@weasel-js/ui/components/Properties';
import type { ReactNode } from 'react';
import { drawsOwn, entryAt } from '../config/drawsOwn';
import { valueAtPath, withValueAtPath } from '../config/path';
import type { LeafRenderer, ResolvedConfig } from '../config/types';
import { aliasTargetsOf, conditionedLeaf, isLeafActive } from '../config/visible';
import { boundAction } from './boundAction';
import { CurveRow } from './CurveRow';
import { type ControlPack, spansGrid } from './controlPack';
import { DraftDialogRow, type DraftDialogRowProps } from './DraftDialogRow';
import { useFieldChoices } from './fieldChoices';
import { extra, labField, useLabSettles, useTextWaitMs } from './fields';
import { inDialog, summarizeLeaf } from './inDialog';
import { labRowContext } from './labSource';
import { useRowAuto } from './rowAuto';
import { UnwiredRow } from './rows';

export interface ControlRowProps<TC extends Record<string, unknown>> {
  path: string;
  leaf: PrefLeaf;
  resolved: ResolvedConfig;
  config: TC;
  /** `config` with every auto path resolved -- what the instrument reads. */
  shown: TC;
  setConfig: (path: string, value: unknown) => void;
  /** Where the values an edit passes through go, a typed number's keystrokes or a slider's drag, while
   *  `setConfig` hears the one it settles on. Without it a typed field writes only that settled value. */
  draftConfig?: (path: string, value: unknown) => void;
  /** What is wrong with the row's value, shown under it. */
  error?: ReactNode;
  renderers?: Record<string, LeafRenderer>;
  pack: ControlPack;
  layout?: PropertyRowLayout;
  auto?: ReadonlySet<string>;
  /** Hands a row to its resolver or takes it back. Without it no row can go
   *  auto, and its label is only a label. */
  setRowAuto?: (path: string, next: boolean, value: unknown) => void;
  /** The row takes no input: its `enableIf`, or that of a group above it, does not hold. */
  disabled?: boolean;
  /** Paths whose rows are marked as changed. */
  changed?: ReadonlySet<string>;
  /** The schema an alias points into, where that is not `resolved`'s: the row is drawn as the leaf of it at the
   *  alias's path, and reads and writes `config` there. A condition inside the row's leaf may read its settings. */
  over?: PrefGroup | PrefSection;
}

/** One leaf's row, as the panel draws it. Shared with `ControlMatrix`, whose
 *  popover edits one cell with exactly this row. An alias draws the row of the
 *  leaf it shows, at that leaf's path: its value, its auto state and whatever
 *  renders it are all the target's. */
export function ControlRow<TC extends Record<string, unknown>>(props: ControlRowProps<TC>) {
  const { leaf, resolved, renderers } = props;
  const drawn =
    (entryAt(renderers, props.path) ?? entryAt(resolved.renderers, props.path)) !== undefined;
  const custom = drawsOwn(resolved, renderers, props.path, leaf);
  if (prefDrawsNoControl(leaf) && !custom) {
    return (
      <PropertySpan className="lk-control-words">
        <PrefWords pref={leaf} />
      </PropertySpan>
    );
  }
  if (prefDrawsActionRow(leaf) && !custom) {
    // An action's button reads its own label, so it takes the row's whole width with none beside it.
    const action = boundAction(leaf, props.config, props.setConfig);
    return (
      <PropertySpan className="lk-control-actions">
        {leaf.kind === 'actions' ? (
          <PrefActionRows pref={leaf as PrefActions} path={props.path} disabled={props.disabled} />
        ) : (
          <PrefActionButton
            pref={action as PrefAction}
            path={props.path}
            disabled={props.disabled}
            active={isLeafActive(resolved, props.path, props.config, props.over)}
          />
        )}
      </PropertySpan>
    );
  }
  if (leaf.kind !== 'alias' || drawn) return <LeafRow {...props} />;
  const alias = leaf as PrefAlias;
  const targets = aliasTargetsOf(resolved, props.config, props.over);
  const target = targets.shown(alias);
  if (target) return <LeafRow {...props} {...target} inside={props.over && targets} />;
  // An alias of nothing is a wiring fault, shown where it sits and not dropped from the panel.
  return (
    <PropertyRow label={prefAliasName(alias)} description={alias.description} layout={props.layout}>
      <span>(alias: no control at {alias.of === '' ? 'an empty path' : alias.of})</span>
    </PropertyRow>
  );
}

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
}: Pick<
  ControlRowProps<Record<string, unknown>>,
  'path' | 'leaf' | 'resolved' | 'config' | 'over'
> & {
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
    const texts = prefListTexts(value);
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
function CompoundRow({
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
          config={withValueAtPath(control.config, control.path, draft)}
          value={draft}
          onChange={setDraft}
        />
      )}
    </DraftDialogRow>
  );
}

/** What draws the row at `path` in place of the built-in. Most specific wins, and within a tier the lab's entry
 *  beats the instrument's: controls[path] -> node .render/.dialog -> controls[kind]. */
function customRow(
  resolved: ResolvedConfig,
  renderers: Record<string, LeafRenderer> | undefined,
  path: string,
  leaf: PrefLeaf,
): LeafRenderer | undefined {
  const dialog = entryAt(resolved.dialogs, path);
  return (
    entryAt(renderers, path) ??
    entryAt(resolved.renderers, path) ??
    (dialog ? inDialog(dialog.body, dialog) : undefined) ??
    entryAt(renderers, leaf.kind)
  );
}

/** `leaf` with no `auto`, for a renderer that reads it to decide whether to offer the toggle. */
const withoutAuto = (leaf: PrefLeaf): PrefLeaf => {
  const { auto: _auto, ...rest } = leaf;
  return rest as PrefLeaf;
};

const spanned = (row: ReactNode): ReactNode =>
  row === null || row === undefined || row === false ? null : (
    <PropertySpan className="lk-control-custom">{row}</PropertySpan>
  );

/** An action leaf's row: an icon alone, which the row's label names. Not a `<label>`: that would hand a click on
 *  its text to the button. */
function ActionRow({
  path,
  leaf,
  resolved,
  config,
  setConfig,
  layout,
  disabled,
  error,
  over,
  label,
  description,
}: Pick<
  ControlRowProps<Record<string, unknown>>,
  'path' | 'leaf' | 'resolved' | 'config' | 'setConfig' | 'layout' | 'error' | 'over'
> & { disabled: boolean; label: string; description: string | undefined }) {
  return (
    <PropertyRow
      group
      label={label}
      description={description}
      layout={layout}
      disabled={disabled}
      disabledReason={leaf.disabledReason}
      error={error}
    >
      <PrefActionButton
        pref={boundAction(leaf, config, setConfig) as PrefAction}
        path={path}
        disabled={disabled}
        active={isLeafActive(resolved, path, config, over)}
      />
    </PropertyRow>
  );
}

function LeafRow<TC extends Record<string, unknown>>({
  path,
  leaf,
  resolved,
  config,
  shown,
  setConfig,
  draftConfig,
  error,
  renderers,
  pack,
  layout,
  auto,
  setRowAuto,
  disabled = false,
  over,
  inside,
  changed: changedPaths,
}: ControlRowProps<TC> & { inside?: PrefAliasTargets }) {
  const write = (value: unknown): void => setConfig(path, value);
  const draft = draftConfig && ((value: unknown): void => draftConfig(path, value));
  const choices = useFieldChoices();
  const settles = useLabSettles();
  const textWaitMs = useTextWaitMs(leaf);
  const rowAuto = useRowAuto({ path, leaf, resolved, config, shown, auto, setRowAuto, setConfig });
  const { value, setAuto, readout: autoReadout, props: autoProps } = rowAuto;

  const changed = changedPaths?.has(path) === true;
  const custom = customRow(resolved, renderers, path, leaf);
  // The grid cannot see what a custom row draws, so the row takes the whole width rather than half a pair.
  if (custom) {
    // A renderer drawing its own row reads `pref.auto` to decide whether to offer the toggle.
    const offered = autoProps.onAutoChange !== undefined;
    const bound = boundAction(leaf, config, setConfig);
    return spanned(
      custom(
        labRowContext(
          { resolved, config, shown, setConfig, draftConfig, auto, setRowAuto, over },
          path,
          offered ? bound : withoutAuto(bound),
          { value, changed, draft, error, disabled, fields: choices },
          offered ? setAuto : undefined,
        ),
      ),
    );
  }

  const label = leaf.name;
  const description = leaf.description;
  const row = { label, description, layout, readout: autoReadout, changed, error, ...autoProps };

  if (leaf.kind === 'action')
    return (
      <ActionRow
        {...{ path, leaf, resolved, config, setConfig, layout, disabled, error, over }}
        label={label}
        description={description}
      />
    );

  // Too much for a row, so the row opens it in a dialog.
  if (prefIsCompound(leaf)) {
    const summary = summarizeLeaf(leaf, value);
    const dialog = {
      label,
      summary,
      readout: autoReadout,
      layout,
      description,
      disabled,
      changed,
      error,
    };
    return (
      <CompoundRow
        dialog={{ ...dialog, ...autoProps }}
        control={{ path, leaf, resolved, config, label, renderers, over, given: inside }}
        value={value}
        setValue={write}
      />
    );
  }

  if (leaf.kind === 'curve')
    return (
      <CurveRow
        leaf={leaf}
        value={value}
        write={write}
        draft={draft}
        disabled={disabled}
        row={row}
      />
    );

  const read = (p: string): unknown => valueAtPath(shown, p);
  const field = labField(leaf, value, write, choices, disabled, draft, read, settles, textWaitMs);
  if (field === null)
    return <UnwiredRow label={label} kind={leaf.kind} description={description} />;
  switch (field.kind) {
    case 'string':
    case 'number':
    case 'enum':
      return <PropertyField {...field} {...row} span={spansGrid(field, pack)} />;
    default:
      return <PropertyField {...withRowControl(field, 'lab')} {...row} />;
  }
}
