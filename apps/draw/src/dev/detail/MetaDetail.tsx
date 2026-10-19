import { Badge, type BadgeProps } from '@weasel-js/ui/components/Badge';
import { Code } from '@weasel-js/ui/components/Code';
import { DataGrid } from '@weasel-js/ui/components/DataGrid';
import { InlineMarkdown } from '@weasel-js/ui/components/InlineMarkdown';
import traitSchemas from 'virtual:weasel-trait-schemas';
import s from '../RegistryInspector.module.css';
import { SchemaTable } from '../SchemaTable';
import { TOKEN_SETS, type TokenSet } from '../badgeTokens';
import type { MetaEntry } from '../registryEntries';
import { RouteBadge } from './RouteBadge';

export function MetaDetail({ entry }: { entry: MetaEntry }) {
  if (entry.id === 'tokens') return <TokensDetail />;
  if (entry.id === 'sceneNode') return <SceneNodeDetail />;
  return null;
}

/** Documents the `SceneNode<TData, TLayer, TPose>` discriminated union — the
 *  per-variant property list pulled from the kit source by the trait-schemas
 *  Vite plugin. Lives on the Meta tab so consumers can answer "what fields
 *  does a leaf vs. container node actually carry" without grepping. */
export function SceneNodeDetail() {
  const node = traitSchemas.node;
  return (
    <div>
      <h2 className={s.detailHeading}>SceneNode</h2>
      <p className={s.empty}>
        Discriminated union over <code>kind</code>. Every variant inherits the
        base node fields (<code>id</code>, <code>layer</code>, <code>pose</code>,{' '}
        <code>data</code>, <code>parent</code>) and adds variant-specific ones.
      </p>
      {node.variants.length === 0 && (
        <p className={s.schemaNote}>No variants extracted — was the kit source moved?</p>
      )}
      {node.variants.map((v) => (
        <section key={v.kind}>
          <h3 className={s.subHeading}>kind: {v.kind}</h3>
          <SchemaTable rows={v.properties} />
        </section>
      ))}
      <p className={s.schemaSource}>
        Extracted from <code>{node.source.file}:{node.source.line}</code>
      </p>
    </div>
  );
}

export function TokensDetail() {
  return (
    <div>
      <h2 className={s.detailHeading}>Tokens</h2>
      <p className={s.empty}>
        Catalog of badge / keycap styles the inspector maps onto enumerated
        types. Each set lists every value alongside its rendered chip so the
        family reads consistently wherever it appears.
      </p>
      {TOKEN_SETS.map((set) => (
        <section key={set.id}>
          <h3 className={s.subHeading}>{set.label}</h3>
          <p className={s.empty}><InlineMarkdown text={set.description} /></p>
          <TokenSetTable set={set} />
        </section>
      ))}
    </div>
  );
}

export function TokenSetTable({ set }: { set: TokenSet }) {
  if (set.kind === 'badge') {
    return (
      <DataGrid
        rows={set.entries.map((e) => ({ id: e.value, entry: e }))}
        columns={[
          { id: 'value', header: 'value', accessor: (r) => r.entry.value, render: (r) => <Code>{r.entry.value}</Code> },
          { id: 'preview', header: 'preview', accessor: (r) => r.entry.value, render: (r) => <Badge {...(r.entry.props as BadgeProps)}>{r.entry.value}</Badge> },
        ]}
        empty="No entries."
      />
    );
  }
  return (
    <DataGrid
      rows={set.entries.map((e) => ({ id: e.value, entry: e }))}
      columns={[
        { id: 'value', header: 'value', accessor: (r) => r.entry.value, render: (r) => <Code>{r.entry.value}</Code> },
        { id: 'preview', header: 'preview', accessor: (r) => r.entry.value, render: (r) => <RouteBadge route={r.entry.props.route} /> },
      ]}
      empty="No entries."
    />
  );
}
