import type { FeaturePreset } from '@weasel-js/core';
import { ingestAction } from '../actions/edit/ingest';
import { KIT_CONTENT_HANDLERS } from '../ingest/kitHandlers';
import { insertPreset } from './insert';

/** Dropped and pasted content: images, SVG, copied nodes and whatever `ingestion.handlers` accept, on Cmd/Ctrl+V
 *  or an OS drop, inserted through `insertPreset`'s dep. It brings the kit's content handlers. */
export const ingestPreset: FeaturePreset = {
  id: 'ingest',
  label: 'Ingest',
  actions: [ingestAction],
  contentHandlers: KIT_CONTENT_HANDLERS,
  includes: [insertPreset],
};
