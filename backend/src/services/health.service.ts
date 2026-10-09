import type { HealthRepository } from '../repositories/health.repository.js';

export interface HealthStatus {
  status: 'ok' | 'unhealthy';
  database: 'ok' | 'error';
  latencyMs: number;
  checkedAt: string;
}

/**
 * Servicio de salud: decide qué significa "saludable" y cómo presentarlo.
 * No conoce Express ni PostgreSQL, solo el repositorio.
 */
export class HealthService {
  constructor(private readonly healthRepository: HealthRepository) {}

  async getStatus(): Promise<HealthStatus> {
    const checkedAt = new Date().toISOString();
    try {
      const { ok, latencyMs } = await this.healthRepository.checkDatabase();
      return {
        status: ok ? 'ok' : 'unhealthy',
        database: ok ? 'ok' : 'error',
        latencyMs,
        checkedAt
      };
    } catch {
      // La BD no responde: el endpoint debe reportarlo como 503, no caer.
      return { status: 'unhealthy', database: 'error', latencyMs: 0, checkedAt };
    }
  }
}
