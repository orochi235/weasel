import type { FeaturePreset } from '@weasel-js/core';
import { ingestAction } from '../actions/edit/ingest';
import { selectionPreset } from './selection';

/** Dropped and pasted content: images, SVG, files, and whatever
 *  `ingestion.handlers` accept, on Cmd/Ctrl+V or an OS drop. */
export const ingestPreset: FeaturePreset = {
  id: 'ingest',
  label: 'Ingest',
  actions: [ingestAction],
  includes: [selectionPreset],
};
