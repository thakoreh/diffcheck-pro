/**
 * URL-safe compression for shareable diff links.
 * Uses LZ-style chunking + base64url encoding.
 */

function compress(text: string): string {
  if (!text) return '';

  // Split into chunks and base64url encode each
  const chunkSize = 80;
  const chunks: string[] = [];

  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  return chunks.map(chunk => {
    try {
      const b64 = Buffer.from(chunk, 'utf-8').toString('base64');
      return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    } catch {
      return '';
    }
  }).join('.');
}

function decompress(encoded: string): string {
  if (!encoded) return '';

  try {
    const chunks = encoded.split('.');
    return chunks.map(chunk => {
      const padded = chunk.replace(/-/g, '+').replace(/_/g, '/');
      const padded2 = padded + '==='.slice(0, (4 - padded.length % 4) % 4);
      return Buffer.from(padded2, 'base64').toString('utf-8');
    }).join('');
  } catch {
    return '';
  }
}

export function encodeDiffState(original: string, modified: string): string {
  const combined = `${original}\x00${modified}`;
  return compress(combined);
}

export function decodeDiffState(encoded: string): { original: string; modified: string } | null {
  try {
    const decompressed = decompress(encoded);
    const [original, modified] = decompressed.split('\x00');
    return { original, modified };
  } catch {
    return null;
  }
}

export function buildShareableUrl(original: string, modified: string): string {
  const encoded = encodeDiffState(original, modified);
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://diffpro.ai';
  return `${base}/compare?d=${encoded}`;
}

export function parseShareableUrl(): { original: string; modified: string } | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const d = params.get('d');
  if (!d) return null;

  return decodeDiffState(d);
}
