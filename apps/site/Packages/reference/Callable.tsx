import type { ReferenceSignature } from '../../../shared/reference';
import { Prose } from '../../Prose';
import { CodeText } from './CodeLine';
import s from './Reference.module.css';

/** What a call takes and gives back: the half of a signature its declaration line does not explain. */
export function CallDetails({ params = [], returns = null }: Partial<Pick<ReferenceSignature, 'params' | 'returns'>>) {
  if (params.length === 0 && !returns) return null;
  return (
    <dl className={s.details}>
      {params.map((param) => (
        <div key={param.name} className={s.detail}>
          <dt>
            <code>{param.name}{param.optional ? '?' : ''}</code>
            <code className={s.detailType}><CodeText code={param.type} /></code>
          </dt>
          <dd><Prose blocks={param.doc} /></dd>
        </div>
      ))}
      {returns && (
        <div className={s.detail}>
          <dt>
            <span className={s.returns}>Returns</span>
            <code className={s.detailType}><CodeText code={returns.type} /></code>
          </dt>
          <dd><Prose blocks={returns.doc} /></dd>
        </div>
      )}
    </dl>
  );
}
