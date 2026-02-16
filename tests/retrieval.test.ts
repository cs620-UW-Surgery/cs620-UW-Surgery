import { describe, expect, it } from 'vitest';
import { rankChunksByKeyword } from '@/lib/knowledge';

const baseChunk = {
  sourceDoc: 'Doc',
  sourcePageStart: 1,
  sourcePageEnd: 1,
  text: '',
  hash: 'hash',
  version: 1,
  citationKey: 'DOC:Doc|CHUNK:|P:1-1',
  createdAt: '2026-02-01',
  updatedAt: '2026-02-01'
};

describe('rankChunksByKeyword', () => {
  it('returns deterministic ordering for equal scores', () => {
    const chunks = [
      { ...baseChunk, id: 'b', text: 'alpha' },
      { ...baseChunk, id: 'a', text: 'alpha' },
      { ...baseChunk, id: 'c', text: 'beta' }
    ];

    const ranked = rankChunksByKeyword('alpha', chunks);

    expect(ranked.map((chunk) => chunk.id)).toEqual(['a', 'b', 'c']);
  });

  it('prefers higher keyword matches', () => {
    const chunks = [
      { ...baseChunk, id: 'a', text: 'alpha beta' },
      { ...baseChunk, id: 'b', text: 'alpha alpha beta' }
    ];

    const ranked = rankChunksByKeyword('alpha beta', chunks);

    expect(ranked[0].id).toBe('b');
  });
});
