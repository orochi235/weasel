const ALPHABET = /^[A-Za-z0-9_-]*$/;

/** `bytes` as unpadded base64url (RFC 4648 §5), which a URL carries unescaped. */
export function toBase64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The bytes unpadded or padded base64url `text` holds, or `null` when it is not base64url. */
export function fromBase64url(text: string): Uint8Array | null {
  const bare = text.replace(/=+$/, '');
  if (!ALPHABET.test(bare) || bare.length % 4 === 1) return null;
  const bin = atob(bare.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
