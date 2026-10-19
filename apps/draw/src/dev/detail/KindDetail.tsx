import { Code } from '@weasel-js/ui/components/Code';
import { DetailList, DetailRow } from '@weasel-js/ui/components/DetailList';
import { InlineMarkdown } from '@weasel-js/ui/components/InlineMarkdown';
import traitSchemas from 'virtual:weasel-trait-schemas';
import { ToolIcon } from '../../ui/ToolIcon';
import s from '../RegistryInspector.module.css';
import { SchemaTable } from '../SchemaTable';
import type { PropertiesKindEntry, ShapeKindEntry } from '../registryEntries';
import { findSourceMatch } from '../sourceLookup';
import { collectOpFactoriesTargeting } from './OpDetail';
import { Jsdoc, EntryLink, KindBadge, type Props } from './shared';
import { SourceLink } from './sourceLinks';

export function ShapeKindDetail({
  entry, onNavigate,
}: {
  entry: ShapeKindEntry;
  onNavigate: Props['onNavigate'];
}) {
  const match = findSourceMatch(entry.hookName ?? entry.id);
  const opTargets = collectOpFactoriesTargeting(entry.id);
  return (
    <div>
      <div className={s.toolHeader}>
        <span className={s.toolIcon} aria-hidden>
          <ToolIcon tool={entry.tool ?? entry.id} />
        </span>
        <h2 className={s.detailHeading}>{entry.id}</h2>
      </div>
      <DetailList>
        <DetailRow label="trait"><KindBadge label={entry.trait} /></DetailRow>
        <DetailRow label="kind"><KindBadge label="shape" /></DetailRow>
        {entry.tool && (
          <DetailRow label="authored by">
            <Code>{entry.hookName ?? entry.tool}</Code>
          </DetailRow>
        )}
        {opTargets.length > 0 && (
          <DetailRow label="op factories">
            {opTargets.map((f) => (
              <EntryLink key={f} kind="opFactory" id={f} onNavigate={onNavigate} />
            ))}
          </DetailRow>
        )}
        {match?.path && <DetailRow label="source"><SourceLink match={match} /></DetailRow>}
      </DetailList>
      {match?.jsdoc && <Jsdoc text={match.jsdoc} />}
      <ShapeSchemaPanel kindId={entry.id} />
    </div>
  );
}

/** Pose + data property tables extracted from the kit source by the
 *  trait-schemas Vite plugin. Surfaces "what properties does a `rect` /
 *  `text` / `pen` carry" without round-tripping to the TS source. */
export function ShapeSchemaPanel({ kindId }: { kindId: string }) {
  const schema = traitSchemas.shapes[kindId];
  if (!schema) {
    return <p className={s.empty}>No extracted schema for this shape kind.</p>;
  }
  return (
    <>
      {schema.notes && <p className={s.schemaNote}><InlineMarkdown text={schema.notes} /></p>}
      <h3 className={s.subHeading}>Pose</h3>
      <SchemaTable rows={schema.pose} empty="Pose synthesized elsewhere (no literal in source)." />
      <h3 className={s.subHeading}>Data</h3>
      <SchemaTable rows={schema.data} empty="No data fields populated by default." />
      {schema.renderer && (
        <p className={s.schemaSource}>
          Painter: <code>{schema.renderer}</code>
        </p>
      )}
      <p className={s.schemaSource}>
        Extracted from <code>{schema.source.file}:{schema.source.line}</code>
      </p>
    </>
  );
}

export function PropertiesKindDetail({ entry }: { entry: PropertiesKindEntry }) {
  return (
    <div>
      <div className={s.toolHeader}>
        <h2 className={s.detailHeading}>{entry.id}</h2>
      </div>
      <DetailList>
        <DetailRow label="trait"><KindBadge label={entry.trait} /></DetailRow>
        <DetailRow label="kind"><KindBadge label="properties-kind" /></DetailRow>
        <DetailRow label="leaf paths">
          {entry.leafPaths.length === 0
            ? <span className={s.empty}>No editable leaves in this kind's schema.</span>
            : entry.leafPaths.map((path) => (
                <Code key={path}>{path}</Code>
              ))}
        </DetailRow>
      </DetailList>
    </div>
  );
}
