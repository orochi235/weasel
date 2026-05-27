import s from './RegistryInspector.module.css';
import type { PropertyDescriptor } from './traitSchemas.types';

/** Renders a list of property descriptors as a compact table. Each row shows
 *  the property name, an optional `?` indicator, the TypeScript type, and the
 *  authored default literal when known. Used by every "what does this thing
 *  take" panel in the inspector. */
export function SchemaTable({
  rows,
  empty,
}: {
  rows: readonly PropertyDescriptor[];
  empty?: string;
}) {
  if (rows.length === 0) {
    return <p className={s.empty}>{empty ?? 'No properties extracted.'}</p>;
  }
  return (
    <table className={s.schemaTable}>
      <thead>
        <tr>
          <th>property</th>
          <th>type</th>
          <th>default</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td>
              <code className={s.schemaName}>{row.name}</code>
              {row.optional && <span className={s.schemaOptional} aria-label="optional">?</span>}
            </td>
            <td><code className={s.schemaType}>{row.type}</code></td>
            <td>
              {row.defaultLiteral !== undefined
                ? <code className={s.schemaDefault}>{row.defaultLiteral}</code>
                : <span className={s.schemaMuted}>—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
