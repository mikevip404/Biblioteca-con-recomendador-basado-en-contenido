/** DTOs del motor de recomendación por contenido (Fase 5). */

/** Estrategia usada al recomendar: contenido o respaldo por popularidad. */
export type RecommendationStrategy = 'popular' | 'content-based';

/** Datos básicos de un libro en las respuestas del recomendador. */
export interface RecommenderBookDTO {
  id: string;
  title: string;
  coverUrl?: string;
  averageRating: number;
  mainGenre?: string;
}

/** Motivo por el que un libro se considera afín a otro. */
export interface SimilarityReasonDTO {
  type: string;
  label: string;
}

/** Libro recomendado con su puntaje de similitud y los motivos. */
export interface SimilarBookDTO {
  book: RecommenderBookDTO;
  score: number;
  reasons: SimilarityReasonDTO[];
}

/** Respuesta de `GET /api/me/recommendations`. */
export interface RecommendationSetDTO {
  strategy: RecommendationStrategy;
  data: SimilarBookDTO[];
}

/** Nodo del grafo de libros afines. */
export interface GraphNodeDTO {
  id: string;
  title: string;
  mainGenre?: string;
}

/** Arista del grafo (peso = similitud de coseno). */
export interface GraphEdgeDTO {
  source: string;
  target: string;
  weight: number;
}

/** Respuesta de `GET /api/books/:id/graph`. */
export interface GraphDTO {
  nodes: GraphNodeDTO[];
  edges: GraphEdgeDTO[];
}

/** Estado de un trabajo de reconstrucción de vectores. */
export type RebuildState = 'pending' | 'running' | 'completed' | 'failed';

export interface RebuildStatus {
  jobId: string;
  state: RebuildState;
  processed: number;
  total: number;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}
