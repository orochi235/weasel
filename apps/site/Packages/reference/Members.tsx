import type { ReferenceMember } from '../../../shared/reference';
import { Prose } from '../../Prose';
import { CallDetails } from './Callable';
import { CodeLine, CodeText } from './CodeLine';
import s from './Reference.module.css';

/** The members of an interface, a class, an object type, or an enum, under an optional heading. */
export function Members({ title, members }: { title?: string; members: readonly ReferenceMember[] }) {
  if (members.length === 0) return null;
  return (
    <section className={s.members}>
      {title && <h4 className={s.groupTitle}>{title}</h4>}
      <ul className={s.memberList}>
        {members.map((member, i) => (
          <li key={i} className={s.member}>
            <CodeLine code={member.code} />
            {member.inheritedFrom && (
              <p className={s.inherited}>Inherited from <code><CodeText code={member.inheritedFrom} /></code></p>
            )}
            <Prose blocks={member.doc} />
            <CallDetails params={member.params} returns={member.returns} />
          </li>
        ))}
      </ul>
    </section>
  );
}
