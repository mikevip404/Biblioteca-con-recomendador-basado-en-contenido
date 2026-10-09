import argon2 from 'argon2';
/**
 * Implementación con Argon2id (ganador del Password Hashing Competition,
 * resistente a GPU/ASIC por su uso de memoria).
 *
 * `argon2.hash` usa Argon2id por defecto con parámetros OWASP (m=64MB, t=3).
 * Cada hash incluye su propia sal aleatoria: dos hashes de la misma clave
 * son distintos.
 */
export class Argon2PasswordService {
    async hash(password) {
        return argon2.hash(password);
    }
    async verify(passwordHash, password) {
        try {
            return await argon2.verify(passwordHash, password);
        }
        catch {
            // Hash corrupto o con formato inválido: tratar como no coincidencia,
            // nunca como error interno que filtre detalles.
            return false;
        }
    }
}
