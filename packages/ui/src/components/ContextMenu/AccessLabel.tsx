import s from './ContextMenu.module.css';

/** A menu label with the first occurrence of its access letter underlined. */
export function AccessLabel({ label, access }: { label: string; access?: string }) {
  const at = access ? label.toLowerCase().indexOf(access.toLowerCase()) : -1;
  if (at < 0 || !access) return <>{label}</>;
  return (
    <>
      {label.slice(0, at)}
      <span className={s.access}>{label.slice(at, at + access.length)}</span>
      {label.slice(at + access.length)}
    </>
  );
}
