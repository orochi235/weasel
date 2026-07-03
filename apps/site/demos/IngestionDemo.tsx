import { useRef, useState } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
  openFilePicker,
  type SceneCanvasApi,
  type ContentHandlerEntry,
} from '@weasel-js/core';

const W = 600, H = 400;

interface NodeData { image?: { src: string } }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

export function IngestionDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({ systemLayers: [{ id: 'default' }] });
  const selection = useSelection({ mode: 'multi' });
  const ref = useRef<SceneCanvasApi>(null);
  const [readout, setReadout] = useState('drop an image, paste one, or use the picker');

  // Consumer handler: dropped/pasted plain text lands in the readout —
  // demonstrates the registered-handler path a real app extends with its own types.
  const [textHandler] = useState<ContentHandlerEntry[]>(() => [{
    id: 'demo:text',
    match: 'text/plain',
    handle: (items) => {
      const text = items.map((i) => (i.kind === 'string' ? i.text : i.file.name)).join(' ');
      setReadout(`text arrived: "${text.slice(0, 80)}"`);
    },
  }]);

  return (
    <div className="ckd-shape-tools-demo">
      <div className="ckd-toolbar">
        <button onClick={async () => {
          const files = await openFilePicker({ accept: 'image/*', multiple: true });
          ref.current?.ingest(files);
        }}>
          Insert image…
        </button>
        <span className="ckd-readout">{readout}</span>
      </div>
      <SceneCanvas
        ref={ref}
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        selectionMode="multi"
        toolBundle="minimal"
        ingestion={{ handlers: textHandler }}
      />
    </div>
  );
}
