import * as Weasel from '@weasel-js/core';
import { Code } from '@weasel-js/ui/components/Code';
import { DetailList, DetailRow } from '@weasel-js/ui/components/DetailList';
import traitSchemas from 'virtual:weasel-trait-schemas';
import s from '../RegistryInspector.module.css';
import { SchemaTable } from '../SchemaTable';
import type { OpFactoryEntry, OpKindEntry } from '../registryEntries';
import { findSourceMatch } from '../sourceLookup';
import { KindBadge, Jsdoc, type Props } from './shared';
import { SourceLink } from './sourceLinks';

export function OpKindDetail({ entry }: { entry: OpKindEntry; onNavigate: Props['onNavigate'] }) {
  const factoryId = `create${entry.id.charAt(0).toUpperCase()}${entry.id.slice(1)}Op`;
  const fn = (Weasel as Record<string, unknown>)[factoryId];
  const match = findSourceMatch(factoryId);
  const arity = typeof fn === 'function' ? fn.length : undefined;
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.id}</h2>
      <p className={s.empty}>
        Stable name stamped onto every <code>Op</code> produced by its factory —
        used by <code>History.serialize</code> / <code>restore</code> to rebuild
        ops across reloads.
      </p>
      <DetailList>
        <DetailRow label="factory"><code>{factoryId}</code></DetailRow>
        <DetailRow label="runtime"><Code>{typeof fn}</Code></DetailRow>
        {arity !== undefined && (
          <DetailRow label="parameters" values="figures">{arity}</DetailRow>
        )}
        {match?.path && <DetailRow label="source"><SourceLink match={match} /></DetailRow>}
      </DetailList>
      {match?.jsdoc && <Jsdoc text={match.jsdoc} />}
      <OpSchemaPanel factoryId={factoryId} />
    </div>
  );
}

/** Args-object property table for an op factory. Pulled from the kit's
 *  TypeScript source by the trait-schemas Vite plugin, so it stays current
 *  without per-op handwritten docs. */
export function OpSchemaPanel({ factoryId }: { factoryId: string }) {
  const schema = traitSchemas.ops[factoryId];
  if (!schema) return null;
  return (
    <>
      <h3 className={s.subHeading}>Arguments</h3>
      <SchemaTable rows={schema.params} empty="Factory takes no arguments." />
      <DetailList>
        <DetailRow label="returns"><Code variant="plain" status="accent" size="xs">{schema.returnType}</Code></DetailRow>
      </DetailList>
      <p className={s.schemaSource}>
        Extracted from <code>{schema.source.file}:{schema.source.line}</code>
      </p>
    </>
  );
}

/** Op factories that operate on any shape's pose regardless of kind. We don't
 *  have per-kind targeting in the registry today — every factory accepts any
 *  shape — so the list is uniform. Kept as a helper so a future per-kind
 *  filter (e.g. text-only `createSetTextOp`) plugs in here. */
export function collectOpFactoriesTargeting(_kindId: string): readonly string[] {
  return ['createInsertOp', 'createDeleteOp', 'createTransformOp', 'createReparentOp'];
}

export function OpFactoryDetail({ entry }: { entry: OpFactoryEntry }) {
  const fn = (Weasel as Record<string, unknown>)[entry.id];
  const match = findSourceMatch(entry.id);
  const arity = typeof fn === 'function' ? fn.length : undefined;
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.id}</h2>
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
