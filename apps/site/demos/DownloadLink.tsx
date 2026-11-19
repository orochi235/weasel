import { useEffect, useRef } from 'react';
import s from './DownloadLink.module.css';

/** A link that saves `blob` as `filename`, with its size. The object URL lives as long as the link shows this blob. */
export function DownloadLink({ blob, filename }: { blob: Blob; filename: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(blob);
    ref.current?.setAttribute('href', url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return (
    <a ref={ref} className={s.link} download={filename}>
      Download {filename} <span className={s.size}>{(blob.size / 1024).toFixed(1)} kB</span>
    </a>
  );
}
