import { z } from 'zod';

/** Query de los endpoints del recomendador (`limit` acotado). */
export const recommenderQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(10)
  })
  .strict();

export type RecommenderQueryInput = z.infer<typeof recommenderQuerySchema>;

/** Param `jobId` de `GET /api/admin/recommender/rebuild/:jobId`. */
export const rebuildJobParamSchema = z
  .object({ jobId: z.string().uuid('jobId inválido') })
  .strict();

export type RebuildJobParam = z.infer<typeof rebuildJobParamSchema>;
