/** Estrategia usada al recomendar. */
export type RecommendationStrategy = 'popular' | 'content-based';

/** Datos básicos de un libro en las respuestas del recomendador. */
export interface RecommenderBookDTO {
  id: string;
  title: string;
  coverUrl?: string;
  averageRating: number;
  mainGenre?: string;
}

/** Motivo de una recomendación. */
export interface SimilarityReasonDTO {
  type: string;
  label: string;
}

/** Un libro recomendado con su puntaje y motivos. */
export interface SimilarBookDTO {
  book: RecommenderBookDTO;
  score: number;
  reasons: SimilarityReasonDTO[];
}

/** Respuesta de `GET /me/recommendations`. */
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

/** Arista del grafo (peso = similitud). */
export interface GraphEdgeDTO {
  source: string;
  target: string;
  weight: number;
}

/** Respuesta de `GET /books/:id/graph`. */
export interface GraphDTO {
  nodes: GraphNodeDTO[];
  edges: GraphEdgeDTO[];
}

/** Estado de un trabajo de reconstrucción en segundo plano. */
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