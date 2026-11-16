import type { FeaturePreset } from '@weasel-js/core';
import { ingestAction } from '../actions/edit/ingest';
import { insertPreset } from './insert';

/** Dropped and pasted content: images, SVG, files, and whatever
 *  `ingestion.handlers` accept, on Cmd/Ctrl+V or an OS drop, inserted through `insertPreset`'s dep. */
export const ingestPreset: FeaturePreset = {
  id: 'ingest',
  label: 'Ingest',
  actions: [ingestAction],
  includes: [insertPreset],
};
