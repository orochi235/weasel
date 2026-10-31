/** A packet's edits: its title and field labels, each typed in place. */
import { withTitle } from '../chartTitle';
import type { PlotEditor } from '../editing/editors';
import { setPacketLabel } from './edit';
import type { PacketData } from './types';

/** No drags; the title and each field's label take a text edit. */
export const packetEditor: PlotEditor<PacketData> = {
  handle: () => null,
  drag: () => null,
  text(data, datum, text) {
    if (datum.edit === 'title') return withTitle(data, text);
    const label = text.trim();
    const field = datum.field;
    if (datum.edit !== 'label' || typeof field !== 'number' || data.fields[field] === undefined || label === '') return data;
    return setPacketLabel(data, field, label);
  },
};
