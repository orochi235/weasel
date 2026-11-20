import { Code } from '@weasel-js/ui/components/Code';
import { DetailList, DetailRow } from '@weasel-js/ui/components/DetailList';
import traitSchemas from 'virtual:weasel-trait-schemas';
import s from '../RegistryInspector.module.css';
import { SchemaTable } from '../SchemaTable';
import type { OpFactoryEntry, OpKindEntry } from '../registryEntries';
import { opFactoryFor, opFactoryNameFor, opFactorySourceNameFor } from '../registryData';
import { findSourceMatch } from '../sourceLookup';
import { KindBadge, Jsdoc, type Props } from './shared';
import { SourceLink } from './sourceLinks';

export function OpKindDetail({ entry }: { entry: OpKindEntry; onNavigate: Props['onNavigate'] }) {
  const factoryId = opFactoryNameFor(entry.id);
  const fn = opFactoryFor(factoryId);
  // A kind registered through `registerOpFactory` has no `ops` export; the
  // rows below describe that export, so they go when it isn't there.
  const hasFactory = typeof fn === 'function';
  const match = hasFactory ? findSourceMatch(opFactorySourceNameFor(factoryId)) : undefined;
  const arity = hasFactory ? fn.length : undefined;
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.id}</h2>
      <p className={s.empty}>
        Stable name stamped onto every <code>Op</code> produced by its factory —
        used by <code>History.serialize</code> / <code>restore</code> to rebuild
        ops across reloads.
      </p>
      <DetailList>
        {hasFactory ? (
          <>
            <DetailRow label="factory"><code>ops.{factoryId}</code></DetailRow>
            <DetailRow label="runtime"><Code>{typeof fn}</Code></DetailRow>
          </>
        ) : (
          <DetailRow label="factory">
            <span className={s.empty}>No <code>ops</code> export; registered through <code>registerOpFactory</code>.</span>
          </DetailRow>
        )}
        {arity !== undefined && (
          <DetailRow label="parameters" values="figures">{arity}</DetailRow>
        )}
        {match?.path && <DetailRow label="source"><SourceLink match={match} /></DetailRow>}
      </DetailList>
      {match?.jsdoc && <Jsdoc text={match.jsdoc} />}
      {hasFactory && <OpSchemaPanel factoryId={factoryId} />}
    </div>
  );
}

/** Args-object property table for the `@weasel-js/core/ops` factory `factoryId`. Pulled from the kit's
 *  TypeScript source by the trait-schemas Vite plugin, so it stays current
 *  without per-op handwritten docs. */
export function OpSchemaPanel({ factoryId }: { factoryId: string }) {
  const schema = traitSchemas.ops[opFactorySourceNameFor(factoryId)];
  if (!schema) return null;
  return (
    <>
      <h3 className={s.subHeading}>Arguments</h3>
      <SchemaTable rows={schema.params} empty="Factory takes no arguments." />
      <DetailList>
        <DetailRow label="returns"><Code variant="plain" emphasis="high" size="xs">{schema.returnType}</Code></DetailRow>
      </DetailList>
      <p className={s.schemaSource}>
        Extracted from <code>{schema.source.file}:{schema.source.line}</code>
      </p>
    </>
  );
}

/** The op kinds that operate on any shape regardless of its kind, each an
 *  entry of the tree's Ops category. We don't have per-kind targeting in the
 *  registry today — every one of these accepts any shape — so the list is
 *  uniform. Kept as a helper so a future per-kind filter (e.g. text-only
 *  `setText`) plugs in here. */
export function collectOpKindsTargeting(_kindId: string): readonly string[] {
  return ['insert', 'delete', 'transform', 'reparent'];
}

export function OpFactoryDetail({ entry }: { entry: OpFactoryEntry }) {
  const fn = opFactoryFor(entry.id);
  const match = findSourceMatch(opFactorySourceNameFor(entry.id));
  const arity = typeof fn === 'function' ? fn.length : undefined;
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.label}</h2>
      <DetailList>
        <DetailRow label="kind"><KindBadge label="op factory" /></DetailRow>
        <DetailRow label="runtime"><Code>{typeof fn}</Code></DetailRow>
        {arity !== undefined && (
          <DetailRow label="parameters" values="figures">{arity}</DetailRow>
        )}
        {match?.path && <DetailRow label="source"><SourceLink match={match} /></DetailRow>}
      </DetailList>
      {match?.jsdoc && <Jsdoc text={match.jsdoc} />}
      <OpSchemaPanel factoryId={entry.id} />
    </div>
  );
}
