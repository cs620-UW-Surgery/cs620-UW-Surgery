import { describe, expect, it } from 'vitest';
import { dedupeChunksByHash, hashText } from '@/lib/ingest/chunking';

describe('dedupeChunksByHash', () => {
  it('removes duplicate chunks by hash while preserving order', () => {
    const chunks = [
      { text: 'alpha beta', tokenCount: 2, pageStart: 1, pageEnd: 1, hash: hashText('alpha beta') },
      { text: 'alpha beta', tokenCount: 2, pageStart: 2, pageEnd: 2, hash: hashText('alpha beta') },
      { text: 'gamma delta', tokenCount: 2, pageStart: 3, pageEnd: 3, hash: hashText('gamma delta') }
    ];

    const deduped = dedupeChunksByHash(chunks);

    expect(deduped).toHaveLength(2);
    expect(deduped[0].text).toBe('alpha beta');
    expect(deduped[1].text).toBe('gamma delta');
    expect(deduped[0].hash).toBe(hashText('alpha beta'));
    expect(deduped[1].hash).toBe(hashText('gamma delta'));
  });
});