import { Code } from '@weasel-js/ui/components/Code';
import { DetailList, DetailRow } from '@weasel-js/ui/components/DetailList';
import { Icon } from '@weasel-js/ui/components/Icon';
import s from '../RegistryInspector.module.css';
import type { IconEntry } from '../registryEntries';
import { findSourceMatch } from '../sourceLookup';
import { Jsdoc } from './shared';
import { SourceLink } from './sourceLinks';

export function IconDetail({ entry }: { entry: IconEntry }) {
  const match = findSourceMatch(entry.id);
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.id}</h2>
      <div className={s.iconPreviewRow}>
        <div className={`${s.iconPreviewCell} ${s.iconPreviewCellSmall}`}><Icon name={entry.ref} size={32} /></div>
        <div className={`${s.iconPreviewCell} ${s.iconPreviewCellLarge}`}><Icon name={entry.ref} size={64} /></div>
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
