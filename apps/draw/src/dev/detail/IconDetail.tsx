import { Code, DetailList, DetailRow } from '@weasel-js/ui';
import s from '../RegistryInspector.module.css';
import type { IconEntry } from '../registryEntries';
import { findSourceMatch } from '../sourceLookup';
import { Jsdoc } from './shared';
import { SourceLink } from './sourceLinks';

export function IconDetail({ entry }: { entry: IconEntry }) {
  const C = entry.Component;
  const match = findSourceMatch(entry.id);
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.id}</h2>
      <div className={s.iconPreviewRow}>
        <div className={`${s.iconPreviewCell} ${s.iconPreviewCellSmall}`}><C /></div>
        <div className={`${s.iconPreviewCell} ${s.iconPreviewCellLarge}`}><C /></div>
      </div>
      <DetailList>
        <DetailRow label="source"><Code>{entry.source}</Code></DetailRow>
        {entry.actions && <DetailRow label="drawn by"><Code>{entry.actions.join(', ')}</Code></DetailRow>}
        {match?.path && <DetailRow label="file"><SourceLink match={match} /></DetailRow>}
      </DetailList>
      {match?.jsdoc && <Jsdoc text={match.jsdoc} />}
    </div>
  );
}
