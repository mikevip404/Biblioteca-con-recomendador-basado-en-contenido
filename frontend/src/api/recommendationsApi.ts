import type { ApiRequestOptions, GraphDTO, RebuildStatus, RecommendationSetDTO, SimilarBookDTO } from '@/types';

import { http } from './http';

export interface SimilarQuery {
  limit?: number;
}

export interface RecommendationQuery {
  limit?: number;
}

export const recommendationsApi = {
  async getRecommendations(
    query: RecommendationQuery,
    options: ApiRequestOptions = {}
  ): Promise<RecommendationSetDTO> {
    const { data } = await http.get<RecommendationSetDTO>('/me/recommendations', {
      params: query,
      ...options
    });
    return data;
  },

  async getSimilar(
    bookId: string,
    query: SimilarQuery,
    options: ApiRequestOptions = {}
  ): Promise<SimilarBookDTO[]> {
    const { data } = await http.get<{ data: SimilarBookDTO[] }>(
      `/books/${bookId}/similar`,
      { params: query, ...options }
    );
    return data.data;
  },
  
  async getGraph(
    bookId: string,
    query: SimilarQuery,
    options: ApiRequestOptions = {}
  ): Promise<GraphDTO> {
    const { data } = await http.get<{ data: GraphDTO }>(`/books/${bookId}/graph`, {
      params: query,
      ...options
    });
    return data.data;
  },

  async getStatus(): Promise<RebuildStatus> {
    const { data } = await http.get<{ data: RebuildStatus }>('/admin/recommender/status');
    return data.data;
  },

  async startRebuild(): Promise<RebuildStatus> {
    const { data } = await http.post<{ data: RebuildStatus }>('/admin/recommender/rebuild');
    return data.data;
  },

  async getRebuildStatus(jobId: string): Promise<RebuildStatus> {
    const { data } = await http.get<{ data: RebuildStatus }>(
      `/admin/recommender/rebuild/${jobId}`
    );
    return data.data;
  }
};
