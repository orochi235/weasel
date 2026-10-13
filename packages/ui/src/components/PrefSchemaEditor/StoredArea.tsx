import type { CSSProperties, ReactNode, Ref } from 'react';
import { ResizeHandle } from '../ResizeHandle';
import { useEditorSize, type EditorSize } from './editorPrefs';
import { ListPane } from './PaneHeader';
import s from './PrefSchemaEditor.module.css';

/** A list under the structure tree to drag rows out of, at a height the reader drags and the editor's prefs keep. */
export function StoredArea({ title, size, areaRef, dropping = false, children }: {
  title: string;
  /** The editor pref that keeps its height. */
  size: EditorSize;
  areaRef?: Ref<HTMLDivElement>;
  /** A drag held over it would be let go here, so it is outlined. */
  dropping?: boolean;
  children: ReactNode;
}) {
  const height = useEditorSize(size);
  return (
    <>
      <ResizeHandle orientation="horizontal" invert {...height} min={60} max={600} ariaLabel={`Resize ${title.toLowerCase()}`} />
      <ListPane title={title} className={s.storedArea} paneRef={areaRef} data-drop={dropping || undefined} style={{ '--stored-h': `${height.value}px` } as CSSProperties}>
        {children}
      </ListPane>
    </>
  );
}
