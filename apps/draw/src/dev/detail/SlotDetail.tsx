import { DataGrid } from '@weasel-js/ui/components/DataGrid';
import s from '../RegistryInspector.module.css';
import type { SlotEntry, ToolEntry } from '../registryEntries';
import { toolNameColumn } from './GestureDetail';

export function SlotDetail({
  entry, tools,
}: { entry: SlotEntry; tools: readonly ToolEntry[] }) {
  const here = tools.filter((t) => t.slot === entry.id);
  return (
    <div>
      <h2 className={s.detailHeading}>{entry.label}</h2>
      <p className={s.empty}>
        {entry.id === 'registry'
          ? 'Active / hotkey routing slot.'
          : 'Always-on slot (resize / rotate / wheel-zoom).'}
      </p>
      <h3 className={s.subHeading}>Tools mounted in this slot</h3>
      <DataGrid
        rows={here.map((t) => ({ id: t.id, tool: t }))}
        columns={[toolNameColumn()]}
        empty="No tools mounted in this slot."
      />
    </div>
  );
}
