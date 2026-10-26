import {
  actionShortcuts, BASELINE_ACTIONS, COMPOSITE_FEATURES, FEATURE_PRESETS, type FeaturePreset,
} from '@weasel-js/core';
import { formatShortcutParts } from '@weasel-js/gestures';
import type { Action } from '@weasel-js/routing';
import { KeySequence } from '@weasel-js/ui/components/Keycaps';
import s from './Features.module.css';

type ToolEntry = NonNullable<FeaturePreset['tools']>[number];

const toolName = (t: ToolEntry): string => (typeof t === 'string' ? t : 'id' in t ? t.id : String(t));

/** An action's label, then each key it answers to. */
function ActionChip({ action }: { action: Action }) {
  return (
    <li className={s.action}>
      {action.label ?? action.id}
      {actionShortcuts(action).map((shortcut, i) => {
        const parts = formatShortcutParts(shortcut);
        return (
          <span key={i} className={s.keys}>
            {i > 0 && <span className={s.none}>or</span>}
            <KeySequence keys={parts?.keys} leader={parts?.leader} joins="none" />
          </span>
        );
      })}
    </li>
  );
}

function List<T>({ items, render, empty = '—' }: { items: readonly T[]; render: (item: T) => React.ReactNode; empty?: string }) {
  return items.length === 0 ? <span className={s.none}>{empty}</span> : <ul className={s.list}>{items.map(render)}</ul>;
}

function PresetRow({ name, actions, tools = [], chrome = [] }: {
  name: React.ReactNode; actions: readonly Action[]; tools?: readonly ToolEntry[]; chrome?: readonly string[];
}) {
  return (
    <tr>
      <th scope="row">{name}</th>
      <td><List items={actions} render={(a) => <ActionChip key={a.id} action={a} />} /></td>
      <td><List items={tools} render={(t) => <li key={toolName(t)}><code>{toolName(t)}</code></li>} /></td>
      <td><List items={chrome} render={(c) => <li key={c}><code>{c}</code></li>} /></td>
    </tr>
  );
}

/** What each name `<SceneCanvas features>` takes turns on, read from the presets themselves. */
export function Features() {
  return (
    <article className={s.page}>
      <header>
        <div className="ckd-eyebrow">Guide</div>
        <h2 className={s.heading}>Canvas features</h2>
        <p className="ckd-desc">
          What each name in <code>{'<SceneCanvas features>'}</code> turns on. A canvas registers the actions, tools, and
          selection chrome of every preset it names, and the actions its tools bind.
        </p>
      </header>

      <table className={s.table}>
        <thead>
          <tr><th scope="col">Preset</th><th scope="col">Actions</th><th scope="col">Tools</th><th scope="col">Chrome</th></tr>
        </thead>
        <tbody>
          <PresetRow name={<em>every canvas</em>} actions={BASELINE_ACTIONS} />
          {Object.entries(FEATURE_PRESETS).map(([name, preset]) => (
            <PresetRow
              key={name}
              name={<code>{name}</code>}
              actions={preset.actions ?? []}
              {...(preset.tools ? { tools: preset.tools } : {})}
              {...(preset.chrome ? { chrome: preset.chrome } : {})}
            />
          ))}
        </tbody>
      </table>

      <h3 className={s.subheading}>Shorthands</h3>
      <table className={s.table}>
        <thead><tr><th scope="col">Name</th><th scope="col">Turns on</th></tr></thead>
        <tbody>
          {Object.entries(COMPOSITE_FEATURES).map(([name, presets]) => (
            <tr key={name}>
              <th scope="row"><code>{name}</code></th>
              <td><List items={presets} render={(p) => <li key={p}><code>{p}</code></li>} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}
