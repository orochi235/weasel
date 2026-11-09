// The component's own entry, not the barrel: the barrel would bring every weasel-ui component into each frame.
import { Badge } from '@weasel-js/ui/components/Badge';
import { type ReactNode, useState } from 'react';
import { useOverflowing } from '../../shell/useOverflowing';
import type { ApiMember, ApiProp, ApiRef, ApiTable, ApiTypeDef } from '../../story/api';
import { Description } from './Description';
import { useEnv } from './envContext';
import { TypeText } from './TypeText';
import './api.css';

/** A marker that changes how the entry is used, as `required` does, rather than describing it. */
const LOUD = { ref: 'secondary-fg' } as const;

type Types = Readonly<Record<string, ApiTypeDef>> | undefined;

function Entry({
  name,
  badge,
  loud = false,
  children,
}: {
  name: string;
  badge?: string | undefined;
  loud?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <dt className="fg-index-api__name">
        <code>{name}</code>
        {badge ? (
          <Badge variant="subtle" size="sm" {...(loud ? { tint: LOUD } : {})}>
            {badge}
          </Badge>
        ) : null}
      </dt>
      <dd className="fg-index-api__entry">{children}</dd>
    </>
  );
}

function InheritedFrom({ from }: { from: string | undefined }) {
  return from === undefined ? null : (
    <p className="fg-index-api__inherited-from">
      Inherited from <code>{from}</code>
    </p>
  );
}

function PropEntry({ prop, types }: { prop: ApiProp; types: Types }) {
  return (
    <Entry name={prop.name} badge={prop.required ? 'required' : undefined} loud={prop.required}>
      <code className="fg-index-api__type">
        <TypeText text={prop.type} types={types} />
      </code>
      {prop.default === undefined ? null : (
        <p className="fg-index-api__default">
          Default: <code>{prop.default}</code>
        </p>
      )}
      {prop.deprecated === undefined ? null : (
        <p className="fg-index-api__deprecated">{prop.deprecated ? `Deprecated: ${prop.deprecated}` : 'Deprecated'}</p>
      )}
      {prop.description ? <Description text={prop.description} className="fg-index-api__description" /> : null}
      <InheritedFrom from={prop.inheritedFrom} />
    </Entry>
  );
}

function MemberEntry({ member, types }: { member: ApiMember; types: Types }) {
  return (
    <Entry name={member.name} badge={member.readonly ? 'readonly' : undefined}>
      {[member.signature, ...(member.overloads ?? [])].map((signature, i) => (
        <code key={i} className="fg-index-api__type fg-index-api__signature">
          <TypeText text={signature} types={types} />
        </code>
      ))}
      {member.description ? <Description text={member.description} className="fg-index-api__description" /> : null}
      <InheritedFrom from={member.inheritedFrom} />
    </Entry>
  );
}

/** Required props first, then by name. */
export const propsInOrder = (props: readonly ApiProp[]): ApiProp[] =>
  [...props].sort((a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name));

const methodsFirst = (members: readonly ApiMember[]): ApiMember[] => [
  ...members.filter((m) => m.kind === 'method'),
  ...members.filter((m) => m.kind === 'property'),
];

function RefSection({ handle, types }: { handle: ApiRef; types: Types }) {
  return (
    <>
      <h2 className="fg-index-api__heading">Ref</h2>
      <p className="fg-index-api__ref">
        <code className="fg-index-api__type">
          <TypeText text={handle.type} types={types} />
        </code>
      </p>
      {handle.members.length === 0 ? null : (
        <dl className="fg-index-api__list">
          {methodsFirst(handle.members).map((member) => (
            <MemberEntry key={member.name} member={member} types={types} />
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
      {api.href ? (
        <p className="fg-index-api__reference">
          <a href={api.href} target="_blank" rel="noreferrer">
            API reference
          </a>
        </p>
      ) : null}
      <h2 className="fg-index-api__heading">Props</h2>
      {none ? <p className="fg-index-api__note">Takes no props.</p> : null}
      {api.props.length === 0 ? null : (
        <dl className="fg-index-api__list">
          {propsInOrder(api.props).map((prop) => (
            <PropEntry key={prop.name} prop={prop} types={api.types} />
          ))}
        </dl>
      )}
      {api.inherited.map(({ from, count }) => (
        <p key={from} className="fg-index-api__inherited">
          + {count} from <code>{from}</code>
        </p>
      ))}
      {api.ref ? <RefSection handle={api.ref} types={api.types} /> : null}
    </>
  );
}

/** The component's props and what its `ref` exposes, read from its types. Nothing where none was read, as for a gallery. */
export function IndexApi() {
  const { api } = useEnv();
  const [el, setEl] = useState<HTMLElement | null>(null);
  const overflowing = useOverflowing(el);
  if (api === undefined) return null;
  return (
    // While it scrolls on its own beside the stories, it is a tab stop for the keyboard to scroll it.
    <aside ref={setEl} className="fg-index-api" aria-label="API" {...(overflowing ? { tabIndex: 0 } : {})}>
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
