import { ingestAction } from 'interactions/actions/defaults/ingest';
import type { FeaturePreset } from '../features';

/** Dropped and pasted content: images, SVG, files, and whatever
 *  `ingestion.handlers` accept, on Cmd/Ctrl+V or an OS drop. */
export const ingestPreset: FeaturePreset = {
  id: 'ingest',
  label: 'Ingest',
  actions: [ingestAction],
};
