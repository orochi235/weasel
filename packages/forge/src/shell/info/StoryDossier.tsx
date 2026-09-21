import type { Dossier, DossierArg } from './dossier';

/** A value as the dossier prints it: quoted strings, `—` for nothing. */
function printed(value: unknown): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'string') return value === '' ? '""' : value;
  if (typeof value === 'function') return 'ƒ';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="fg-info__row">
      <dt className="fg-info__key">{label}</dt>
      <dd className="fg-info__value">{children}</dd>
    </div>
  );
}

function ArgRows({ args }: { args: readonly DossierArg[] }) {
  return (
    <table className="fg-info__args">
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Kind</th>
          <th scope="col">Value</th>
          <th scope="col">Default</th>
        </tr>
      </thead>
      <tbody>
        {args.map((arg) => (
          <tr key={arg.path}>
            <th scope="row">
              <span className="fg-info__arg-name">{arg.label}</span>
              {arg.description ? <span className="fg-info__arg-doc">{arg.description}</span> : null}
            </th>
            <td className="fg-info__arg-kind">{arg.kind ?? '—'}</td>
            <td className="fg-info__value-cell">{printed(arg.value)}</td>
            <td className="fg-info__value-cell">{printed(arg.default)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The Get Info dossier, rendered. Presentation only: it reads no lab context
 * and owns no open state, so a dialog and a sidebar section can each host it
 * without either one knowing about the other.
 */
export function StoryDossier({ dossier }: { dossier: Dossier }) {
  return (
    <div className="fg-info">
      {dossier.description || dossier.componentDescription ? (
        <section className="fg-info__section" aria-label="Docs">
          {dossier.description ? <p className="fg-info__doc">{dossier.description}</p> : null}
          {dossier.componentDescription ? (
            <p className="fg-info__doc fg-info__doc--component">{dossier.componentDescription}</p>
          ) : null}
        </section>
      ) : null}

      <section className="fg-info__section" aria-label="Identity">
        <dl className="fg-info__rows">
          <Row label="Story">{dossier.name}</Row>
          <Row label="Component">{dossier.componentName ?? dossier.title.split('/').pop()}</Row>
          <Row label="Library">{dossier.library}</Row>
          <Row label="Title">{dossier.title}</Row>
          <Row label="Export">
            <code>{dossier.exportName}</code>
          </Row>
          <Row label="Id">
            <code>{dossier.id}</code>
          </Row>
          <Row label="File">
            <code className="fg-info__path">{dossier.file}</code>
          </Row>
        </dl>
      </section>

      <section className="fg-info__section" aria-label="Args">
        <h3 className="fg-info__heading">Args</h3>
        {dossier.argsPending ? (
          <p className="fg-info__empty">Open this story to read its args.</p>
        ) : dossier.args.length === 0 ? (
          <p className="fg-info__empty">This story takes no args.</p>
        ) : (
          <ArgRows args={dossier.args} />
        )}
      </section>
    </div>
  );
}
