import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob, pickFile } from './fileIO';

describe('downloadBlob', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('clicks a detached-after anchor naming the file, and revokes its URL once the download has started', () => {
    vi.useFakeTimers();
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clicked: { href: string; download: string; attached: boolean }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download, attached: this.isConnected });
    });
    const blob = new Blob(['hi']);
    downloadBlob(blob, 'label.lbx');
    expect(create).toHaveBeenCalledWith(blob);
    expect(clicked).toEqual([{ href: 'blob:x', download: 'label.lbx', attached: true }]);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:x');
  });
});

describe('pickFile', () => {
  it('resolves null and removes its input when the picker is canceled', async () => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      this.dispatchEvent(new Event('cancel'));
    });
    await expect(pickFile('.json')).resolves.toBeNull();
    expect(document.querySelector('input[type=file]')).toBeNull();
    vi.restoreAllMocks();
  });
});
