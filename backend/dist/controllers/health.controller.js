const APP_NAME = 'biblioteca-api';
const APP_VERSION = '1.0.0';
/**
 * Controlador de health. No toca la BD ni tiene lógica de negocio:
 * solo traduce el resultado del servicio a una respuesta HTTP.
 * Los métodos son propiedades de flecha para preservar `this` sin bind.
 */
export class HealthController {
    healthService;
    constructor(healthService) {
        this.healthService = healthService;
    }
    getHealth = async (_req, res) => {
        const status = await this.healthService.getStatus();
        const body = {
            app: APP_NAME,
            version: APP_VERSION,
            ...status
        };
        res.status(status.status === 'ok' ? 200 : 503).json(body);
    };
}
