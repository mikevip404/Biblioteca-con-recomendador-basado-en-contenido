import type { Request, Response } from 'express';
import { HealthService } from '../services/health.service.js';

interface HealthResponse {
  app: string;
  version: string;
  status: 'ok' | 'unhealthy';
  database: 'ok' | 'error';
  latencyMs: number;
  checkedAt: string;
}

const APP_NAME = 'biblioteca-api';
const APP_VERSION = '1.0.0';

/**
 * Controlador de health. No toca la BD ni tiene lógica de negocio:
 * solo traduce el resultado del servicio a una respuesta HTTP.
 * Los métodos son propiedades de flecha para preservar `this` sin bind.
 */
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  getHealth = async (_req: Request, res: Response): Promise<void> => {
    const status = await this.healthService.getStatus();
    const body: HealthResponse = {
      app: APP_NAME,
      version: APP_VERSION,
      ...status
    };
    res.status(status.status === 'ok' ? 200 : 503).json(body);
  };
}
