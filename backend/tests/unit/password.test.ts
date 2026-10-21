import { describe, expect, it } from 'vitest';
import { Argon2PasswordService } from '../../src/services/password.service.js';

describe('Argon2PasswordService', () => {
  const service = new Argon2PasswordService();

  it('verifica correctamente la contraseña original', async () => {
    const hash = await service.hash('Segura123');

    expect(await service.verify(hash, 'Segura123')).toBe(true);
  });

  it('rechaza una contraseña distinta', async () => {
    const hash = await service.hash('Segura123');

    expect(await service.verify(hash, 'Otra4567')).toBe(false);
  });

  it('genera hashes distintos (sal aleatoria) para la misma clave', async () => {
    const first = await service.hash('Segura123');
    const second = await service.hash('Segura123');

    expect(first).not.toBe(second);
    expect(await service.verify(first, 'Segura123')).toBe(true);
    expect(await service.verify(second, 'Segura123')).toBe(true);
  });

  it('devuelve false (no lanza) ante un hash corrupto', async () => {
    await expect(service.verify('esto-no-es-un-hash', 'Segura123')).resolves.toBe(false);
  });
});
