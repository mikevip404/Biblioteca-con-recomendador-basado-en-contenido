import { describe, expect, it } from 'vitest';
import type { Book } from '../../src/types/catalog.js';
import {
  bookTokens,
  buildBookVector,
  buildCorpusIdf,
  cosineSimilarity,
  sharedReasons,
  weightedSum
} from '../../src/utils/recommender.js';

const NOW = new Date('2024-01-01T00:00:00.000Z');

function makeBook(overrides: Partial<Book> & { id: string }): Book {
  return {
    id: overrides.id,
    title: overrides.title ?? `Libro ${overrides.id}`,
    authorId: overrides.authorId ?? 'author-1',
    genreIds: overrides.genreIds ?? ['genre-1'],
    tags: overrides.tags ?? [],
    createdBy: overrides.createdBy ?? 'admin-1',
    vectorStale: overrides.vectorStale ?? true,
    ratingCount: overrides.ratingCount ?? 0,
    ratingSum: overrides.ratingSum ?? 0,
    createdAt: overrides.createdAt ?? NOW,
    updatedAt: overrides.updatedAt ?? NOW,
    ...(overrides.publishedYear !== undefined
      ? { publishedYear: overrides.publishedYear }
      : {}),
    ...(overrides.pages !== undefined ? { pages: overrides.pages } : {}),
    ...(overrides.language !== undefined ? { language: overrides.language } : {})
  };
}

describe('motor de vectores', () => {
  it('extrae tokens únicos por tipo de característica', () => {
    const book = makeBook({
      id: 'b1',
      genreIds: ['g1', 'g2'],
      tags: ['espacio', 'espacio', 'viaje'],
      authorId: 'a1',
      language: 'ES',
      publishedYear: 1994,
      pages: 180
    });
    const tokens = bookTokens(book);
    expect(tokens).toContain('genre:g1');
    expect(tokens).toContain('genre:g2');
    expect(tokens).toContain('tag:espacio');
    expect(tokens.filter((token) => token === 'tag:espacio')).toHaveLength(1);
    expect(tokens).toContain('author:a1');
    expect(tokens).toContain('language:es');
    expect(tokens).toContain('era:1990s');
    expect(tokens).toContain('pages:corto');
  });

  it('la similitud de coseno es 1 para el mismo vector y 0 para vectores disjuntos', () => {
    const first = buildBookVector(makeBook({ id: 'b1', genreIds: ['g1'] }));
    const same = buildBookVector(makeBook({ id: 'b2', genreIds: ['g1'] }));
    const other = buildBookVector(
      makeBook({
        id: 'b3',
        genreIds: ['g9'],
        tags: ['otro'],
        authorId: 'a9',
        language: 'fr',
        publishedYear: 2020,
        pages: 900
      })
    );
    expect(cosineSimilarity(first, same)).toBeCloseTo(1, 10);
    expect(cosineSimilarity(first, other)).toBe(0);
  });

  it('el IDF da más peso a las características raras', () => {
    const common1 = makeBook({ id: 'b1', genreIds: ['g1'], tags: ['comun'] });
    const common2 = makeBook({ id: 'b2', genreIds: ['g1'], tags: ['comun'] });
    const rare = makeBook({ id: 'b3', genreIds: ['g1'], tags: ['raro'] });
    const idf = buildCorpusIdf([common1, common2, rare]);
    const commonWeight = idf.get('tag:comun') ?? 0;
    const rareWeight = idf.get('tag:raro') ?? 0;
    expect(rareWeight).toBeGreaterThan(commonWeight);
  });

  it('explica los motivos con nombres legibles de género y autor', () => {
    const target = buildBookVector(
      makeBook({ id: 'b1', genreIds: ['g1'], authorId: 'a1' })
    );
    const candidate = buildBookVector(
      makeBook({ id: 'b2', genreIds: ['g1'], authorId: 'a1' })
    );
    const reasons = sharedReasons(target, candidate, {
      genres: new Map([['g1', 'Ciencia ficción']]),
      authors: new Map([['a1', 'Ana García']])
    });
    expect(reasons).toContainEqual({
      type: 'genre',
      label: 'Género: Ciencia ficción'
    });
    expect(reasons).toContainEqual({ type: 'author', label: 'Autor: Ana García' });
  });

  it('combina vectores con pesos para construir el perfil', () => {
    const first = buildBookVector(makeBook({ id: 'b1', genreIds: ['g1'] }));
    const second = buildBookVector(makeBook({ id: 'b2', genreIds: ['g2'] }));
    const profile = weightedSum([
      { vector: first, weight: 1 },
      { vector: second, weight: 0.5 }
    ]);
    expect(profile.get('genre:g1')).toBeCloseTo(1, 10);
    expect(profile.get('genre:g2')).toBeCloseTo(0.5, 10);
  });
});
