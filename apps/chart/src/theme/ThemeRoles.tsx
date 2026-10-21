import { addThemeRole, removeThemeRole, renameThemeRole, themeRoles } from '@weasel-js/diagram';
import { CloseButton } from '@weasel-js/ui/components/CloseButton';
import { ListEditor } from '@weasel-js/ui/components/ListEditor';
import { PropertyField, PropertyGroup, PropertyList } from '@weasel-js/ui/components/Properties';
import type { ReactElement } from 'react';
import './themePanel.css';
import { ThemeBox } from './themeFields';
import type { ThemeEdit } from './useThemeEdit';

interface RoleEntry { id: string; label: string }

function RoleFields({ edit, role }: { edit: ThemeEdit; role: RoleEntry }): ReactElement {
  return (
    <>
      <PropertyField
        kind="string" label="Name" value={role.label}
        onChange={(label) => { if (label.trim() !== '') edit.change((t) => renameThemeRole(t, role.id, label.trim()), 'Rename role'); }}
      />
      <ThemeBox edit={edit} at={['roles', role.id]} name={role.label} />
    </>
  );
}

/** The theme's roles: the default role, which stays, then the rest, which can be added and removed. */
export function ThemeRoles({ edit }: { edit: ThemeEdit }): ReactElement {
  const { theme } = edit;
  const roles = themeRoles(theme);
  const fixed = roles.find((r) => r.id === theme.defaultRole)!;
  const rest = roles.filter((r) => r.id !== theme.defaultRole);
  const onChange = (next: RoleEntry[]) => {
    const kept = new Set(next.map((r) => r.id));
    for (const r of rest) if (!kept.has(r.id)) edit.change((t) => removeThemeRole(t, r.id), 'Remove role');
    for (const r of next) if (r.id === '') edit.change((t) => addThemeRole(t, r.label).theme, 'Add role');
  };
  return (
    <PropertyGroup title="Roles" pack="one-up">
      {/* Laid out as a list entry, a remove button's room held empty, so its columns line up with the rest. */}
      <div className="wc-theme-role-fixed">
        <PropertyList pack="one-up"><RoleFields edit={edit} role={fixed} /></PropertyList>
        <span className="wc-theme-role-spacer" aria-hidden="true"><CloseButton ariaLabel="" disabled /></span>
      </div>
      <div className="wc-theme-roles">
        <ListEditor<RoleEntry>
          aria-label="Role" addLabel="Add role" value={rest} onChange={onChange}
          newEntry={() => ({ id: '', label: 'New role' })}
          renderEntry={(role) => <PropertyList pack="one-up"><RoleFields edit={edit} role={role} /></PropertyList>}
        />
      </div>
    </PropertyGroup>
  );
}
