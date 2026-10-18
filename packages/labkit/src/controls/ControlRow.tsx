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
  DialogRow,
  entriesDisabled,
  entryDisabledAt,
  ListEditor,
  PrefActionButton,
  PrefActionRows,
  PrefControl,
  PrefWords,
  PropertyField,
  PropertyRow,
  type PropertyRowLayout,
  prefDrawsActionRow,
  prefDrawsNoControl,
  prefListIsText,
  prefListTexts,
  withRowControl,
} from '@weasel-js/ui';
import { valueAtPath } from '../config/path';
import type { ControlRenderer, ResolvedConfig } from '../config/types';
import { aliasTargetsOf, conditionedLeaf } from '../config/visible';
import { boundAction } from './boundAction';
import type { ControlPack } from './controlPack';
import { useFieldChoices } from './fieldChoices';
import { extra, labField } from './fields';
import { inDialog, summarizeLeaf } from './inDialog';
import { useRowAuto } from './rowAuto';
import { DebouncedTextRow, UnwiredRow } from './rows';

export interface ControlRowProps<TC extends Record<string, unknown>> {
  path: string;
  leaf: PrefLeaf;
  resolved: ResolvedConfig;
  config: TC;
  /** `config` with every auto path resolved -- what the instrument reads. */
  shown: TC;
  setConfig: (path: string, value: unknown) => void;
  renderers?: Record<string, ControlRenderer>;
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
  const drawn = (renderers?.[props.path] ?? resolved.renderers[props.path]) !== undefined;
  if (prefDrawsNoControl(leaf) && !drawn && !renderers?.[leaf.kind]) {
    return (
      <div className="lk-control-words">
        <PrefWords pref={leaf} />
      </div>
    );
  }
  if (prefDrawsActionRow(leaf) && !drawn && !renderers?.[leaf.kind]) {
    // An action's button reads its own label, so it takes the row's whole width with none beside it.
    const action = boundAction(leaf, props.config, props.setConfig);
    return (
      <div className="lk-control-actions">
        {leaf.kind === 'actions' ? (
          <PrefActionRows pref={leaf as PrefActions} path={props.path} disabled={props.disabled} />
        ) : (
          <PrefActionButton pref={action as PrefAction} path={props.path} disabled={props.disabled} />
        )}
      </div>
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
  renderers: Record<string, ControlRenderer> | undefined;
}) {
  const choices = useFieldChoices();
  const inside = given ? { leaf, ...given } : conditionedLeaf(resolved, path, leaf, config, over);
  // Plain text entries keep the list's own fields, and the placeholder only they have.
  if (leaf.kind === 'list' && prefListIsText(leaf as PrefList, renderers?.string !== undefined)) {
    const list = leaf as PrefList;
    const texts = prefListTexts(value);
    const ctx = { path, disabledAt: inside.disabledAt, entryAt: inside.entryAt };
    return (
      <ListEditor
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

/** What draws the row at `path` in place of the built-in. Most specific wins, and within a tier the lab's entry
 *  beats the instrument's: controls[path] -> node .render/.dialog -> controls[kind]. */
function customRow(
  resolved: ResolvedConfig,
  renderers: Record<string, ControlRenderer> | undefined,
  path: string,
  leaf: PrefLeaf,
): ControlRenderer | undefined {
  const dialog = resolved.dialogs[path];
  return (
    renderers?.[path] ??
    resolved.renderers[path] ??
    (dialog ? inDialog(dialog.body, dialog) : undefined) ??
    renderers?.[leaf.kind]
  );
}

function LeafRow<TC extends Record<string, unknown>>({
  path,
  leaf,
  resolved,
  config,
  shown,
  setConfig,
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
  const choices = useFieldChoices();
  const fallback = extra<unknown>(leaf, 'default');
  const pinned = valueAtPath(config, path) ?? fallback;

  const rowAuto = useRowAuto({ path, leaf, resolved, config, shown, pinned, auto, setRowAuto });
  const { isAutoRow, value, setAuto, readout: autoReadout, props: autoProps } = rowAuto;

  const changed = changedPaths?.has(path) === true;
  const custom = customRow(resolved, renderers, path, leaf);
  // A custom row places itself like any other; one that needs the full width
  // says so with `<PropertyRow span>`, which is the same opt-out a built-in has.
  if (custom)
    return custom({
      path,
      pref: boundAction(leaf, config, setConfig),
      value,
      values: config,
      changed,
      setValue: write,
      auto: isAutoRow,
      setAuto,
      fields: choices,
      disabled,
    });

  const label = leaf.name;
  const description = leaf.description;
  // `auto` gives the whole width to the controls that read badly at half of a
  // sidebar's: free text, a slider track, a segmented toggle. `pairs` doesn't.
  const wide = pack === 'auto';
  const row = { label, description, layout, readout: autoReadout, changed, ...autoProps };

  if (leaf.kind === 'action') {
    return (
      // An icon alone, which the row's label names. Not a `<label>`: that would hand a click on its text to the button.
      <PropertyRow
        group
        label={label}
        description={description}
        layout={layout}
        disabled={disabled}
      >
        <PrefActionButton
          pref={boundAction(leaf, config, setConfig) as PrefAction}
          path={path}
          disabled={disabled}
        />
      </PropertyRow>
    );
  }

  // Too much for a row, so the row opens it in a dialog.
  if (prefIsCompound(leaf)) {
    return (
      <DialogRow
        label={label}
        summary={summarizeLeaf(leaf, value)}
        readout={autoReadout}
        layout={layout}
        description={description}
        disabled={disabled}
        changed={changed}
        {...autoProps}
      >
        {() => (
          <CompoundControl
            path={path}
            leaf={leaf}
            resolved={resolved}
            config={config}
            label={label}
            value={value}
            onChange={write}
            renderers={renderers}
            over={over}
            given={inside}
          />
        )}
      </DialogRow>
    );
  }

  const field = labField(leaf, value, write, choices, disabled);
  if (field === null)
    return <UnwiredRow label={label} kind={leaf.kind} description={description} />;
  switch (field.kind) {
    case 'string':
      return <DebouncedTextRow leaf={leaf} field={field} span={wide} {...row} />;
    case 'number':
      return <PropertyField {...field} {...row} span={field.control === 'slider' && wide} />;
    case 'enum':
      return <PropertyField {...field} {...row} span={field.control === 'toggle' && wide} />;
    default:
      return <PropertyField {...withRowControl(field, 'lab')} {...row} />;
  }
}
