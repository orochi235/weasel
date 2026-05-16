import s from './RegistryInspector.module.css';
import type { TreeEntry, ToolEntry, ActionEntry, BundleEntry, IconEntry } from './registryData';
import { findSourceMatch } from './sourceLookup';

interface Props {
  entry: TreeEntry;
  onNavigate(target: { kind: 'tool'; id: string } | { kind: 'action'; id: string }): void;
}

export function RegistryDetail({ entry, onNavigate }: Props) {
  switch (entry.kind) {
    case 'tool':         return <ToolDetail entry={entry} />;
    case 'action':       return <ActionDetail entry={entry} />;
    case 'bundle':       return <BundleDetail entry={entry} onNavigate={onNavigate} />;
    case 'shapeKind':    return <SimpleDetail label={entry.id} />;
    case 'icon':         return <IconDetail entry={entry} />;
    case 'opFactory':    return <SimpleDetail label={entry.id} />;
    case 'publicExport': return <SimpleDetail label={entry.id} />;
  }
}

function SimpleDetail({ label }: { label: string }) {
  const match = findSourceMatch(label);
  return (
    <div>
      <h2 className={s.detailHeading}>{label}</h2>
      {match?.path && <p className={s.sourcePath}><code>{match.path}</code></p>}
      {match?.jsdoc && <pre className={s.jsdoc}>{match.jsdoc}</pre>}
      {!match && <p className={s.empty}>No source match found.</p>}
    </div>
  );
}

function IconDetail({ entry }: { entry: IconEntry }) {
  const C = entry.Component;
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.id}</h2>
      <div className={s.iconPreviewRow}>
        <div className={`${s.iconPreviewCell} ${s.iconPreviewCellSmall}`}><C /></div>
        <div className={`${s.iconPreviewCell} ${s.iconPreviewCellLarge}`}><C /></div>
      </div>
      <dl className={s.detailList}>
        <dt>source</dt><dd>{entry.source}</dd>
      </dl>
    </div>
  );
}

function ToolDetail({ entry }: { entry: ToolEntry }) {
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.id}</h2>
      <dl className={s.detailList}>
        <dt>label</dt><dd>{entry.label}</dd>
        {entry.cursor && (<><dt>cursor</dt><dd>{entry.cursor}</dd></>)}
        {entry.contributesActionIds.length > 0 && (
          <>
            <dt>actions</dt>
            <dd>{entry.contributesActionIds.map((a) => <code key={a} className={s.tag}>{a}</code>)}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

function ActionDetail({ entry }: { entry: ActionEntry }) {
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.id}</h2>
      <dl className={s.detailList}>
        <dt>label</dt><dd>{entry.label}</dd>
        {entry.shortcut && (<><dt>shortcut</dt><dd><code>{entry.shortcut}</code></dd></>)}
      </dl>
    </div>
  );
}

function BundleDetail({ entry, onNavigate }: { entry: BundleEntry; onNavigate: Props['onNavigate'] }) {
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.label}</h2>
      <h3>Tools</h3>
      <ul className={s.memberList}>
        {entry.tools.map((t) => (
          <li key={t}>
            <button type="button" className={s.memberLink} onClick={() => onNavigate({ kind: 'tool', id: t })}>{t}</button>
          </li>
        ))}
      </ul>
      <h3>Actions</h3>
      <ul className={s.memberList}>
        {entry.actions.map((a) => (
          <li key={a}>
            <button type="button" className={s.memberLink} onClick={() => onNavigate({ kind: 'action', id: a })}>{a}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
