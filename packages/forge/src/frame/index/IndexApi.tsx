// The component's own entry, not the barrel: the barrel would bring every weasel-ui component into each frame.
import { Badge } from '@weasel-js/ui/components/Badge';
import type { ReactNode } from 'react';
import type { ApiMember, ApiProp, ApiRef, ApiTable } from '../../story/api';
import { Description } from './Description';
import { useEnv } from './envContext';
import './api.css';

function Entry({ name, badge, children }: { name: string; badge?: string | undefined; children: ReactNode }) {
  return (
    <>
      <dt className="fg-index-api__name">
        <code>{name}</code>
        {badge ? (
          <Badge variant="subtle" size="sm">
            {badge}
          </Badge>
        ) : null}
      </dt>
      <dd className="fg-index-api__entry">{children}</dd>
    </>
  );
}

function PropEntry({ prop }: { prop: ApiProp }) {
  return (
    <Entry name={prop.name} badge={prop.required ? 'required' : undefined}>
      <code className="fg-index-api__type">{prop.type}</code>
      {prop.default === undefined ? null : (
        <p className="fg-index-api__default">
          Default: <code>{prop.default}</code>
        </p>
      )}
      {prop.deprecated === undefined ? null : (
        <p className="fg-index-api__deprecated">{prop.deprecated ? `Deprecated: ${prop.deprecated}` : 'Deprecated'}</p>
      )}
      {prop.description ? <Description text={prop.description} className="fg-index-api__description" /> : null}
    </Entry>
  );
}

function MemberEntry({ member }: { member: ApiMember }) {
  return (
    <Entry name={member.name} badge={member.readonly ? 'readonly' : undefined}>
      <code className="fg-index-api__type">{member.signature}</code>
      {member.description ? <Description text={member.description} className="fg-index-api__description" /> : null}
    </Entry>
  );
}

const methodsFirst = (members: readonly ApiMember[]): ApiMember[] => [
  ...members.filter((m) => m.kind === 'method'),
  ...members.filter((m) => m.kind === 'property'),
];

function RefSection({ handle }: { handle: ApiRef }) {
  return (
    <>
      <h2 className="fg-index-api__heading">Ref</h2>
      <p className="fg-index-api__ref">
        <code className="fg-index-api__type">{handle.type}</code>
      </p>
      {handle.members.length === 0 ? null : (
        <dl className="fg-index-api__list">
          {methodsFirst(handle.members).map((member) => (
            <MemberEntry key={member.name} member={member} />
          ))}
        </dl>
      )}
    </>
  );
}

function ApiBody({ api }: { api: ApiTable }) {
  const none = api.props.length === 0 && api.inherited.length === 0;
  return (
    <>
      <h2 className="fg-index-api__heading">Props</h2>
      {none ? <p className="fg-index-api__note">Takes no props.</p> : null}
      {api.props.length === 0 ? null : (
        <dl className="fg-index-api__list">
          {api.props.map((prop) => (
            <PropEntry key={prop.name} prop={prop} />
          ))}
        </dl>
      )}
      {api.inherited.map(({ from, count }) => (
        <p key={from} className="fg-index-api__inherited">
          + {count} from <code>{from}</code>
        </p>
      ))}
      {api.ref ? <RefSection handle={api.ref} /> : null}
    </>
  );
}

/** The component's props and what its `ref` exposes, read from its types. Nothing for a gallery, or where none was read. */
export function IndexApi() {
  const { api, gallery } = useEnv();
  if (gallery || api === undefined) return null;
  return (
    // Scrolls on its own beside the stories, so it is a tab stop for the keyboard to scroll it.
    <aside className="fg-index-api" aria-label="API" tabIndex={0}>
      {api === null ? (
        <p className="fg-index-api__note">
          forge found no component for this page, so it shows no API. It reads the meta&rsquo;s <code>component</code>,
          or else the import the title&rsquo;s last segment names.
        </p>
      ) : (
        <ApiBody api={api} />
      )}
    </aside>
  );
}
