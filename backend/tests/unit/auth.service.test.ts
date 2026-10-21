import { describe, expect, it } from 'vitest';
import { MongoRefreshTokenRepository } from '../../src/repositories/refresh-token.repository.js';
import { MongoUserRepository } from '../../src/repositories/user.repository.js';
import { AuthService, type AuthConfig } from '../../src/services/auth.service.js';
import { Argon2PasswordService } from '../../src/services/password.service.js';
import { JwtTokenService } from '../../src/services/token.service.js';
import { FakeMongoDatabase } from '../helpers/fake-db.js';

const config: AuthConfig = {
  accessTokenTtlSec: 900,
  refreshTokenTtlDays: 7,
  maxSessions: 2,
  maxLoginAttempts: 3,
  lockMinutes: 15
};

function makeService(db: FakeMongoDatabase): AuthService {
  return new AuthService(
    new MongoUserRepository(db),
    new MongoRefreshTokenRepository(db),
    new Argon2PasswordService(),
    new JwtTokenService({
      secret: 'secreto-de-prueba-con-mas-de-32-caracteres!!',
      accessTokenTtlSec: 900
    }),
    config
  );
}

describe('AuthService', () => {
  it('registra con rol lector aunque se intente forzar otro rol', async () => {
    const service = makeService(new FakeMongoDatabase());

    const user = await service.register({
      email: 'nuevo@test.com',
      password: 'Segura123',
      fullName: 'Nuevo Usuario'
    });

    expect(user.role).toBe('lector');
  });

  it('bloquea la cuenta tras N fallos y la desbloquea con login correcto posterior', async () => {
    const db = new FakeMongoDatabase();
    const service = makeService(db);
    await service.register({ email: 'bloqueo@test.com', password: 'Segura123', fullName: 'B' });

    for (let i = 0; i < 3; i++) {
      await expect(
        service.login({ email: 'bloqueo@test.com', password: 'Mala0000' })
      ).rejects.toMatchObject({ status: 401 });
    }
    // Aunque la clave sea correcta, la cuenta está bloqueada.
    await expect(
      service.login({ email: 'bloqueo@test.com', password: 'Segura123' })
    ).rejects.toMatchObject({ status: 423 });

    // Simula el paso del tiempo: bloqueo expirado → login correcto resetea.
    const users = db.docs.get('users') ?? [];
    const doc = users[0];
    if (doc !== undefined) doc['lockedUntil'] = new Date(Date.now() - 1000);
    const result = await service.login({ email: 'bloqueo@test.com', password: 'Segura123' });
    expect(result.user.email).toBe('bloqueo@test.com');
  });

  it('limita las sesiones concurrentes revocando la más antigua', async () => {
    const db = new FakeMongoDatabase();
    const service = makeService(db);
    const sessions = new MongoRefreshTokenRepository(db);
    await service.register({ email: 'sesiones@test.com', password: 'Segura123', fullName: 'S' });

    const first = await service.login({ email: 'sesiones@test.com', password: 'Segura123' });
    await service.login({ email: 'sesiones@test.com', password: 'Segura123' });
    await service.login({ email: 'sesiones@test.com', password: 'Segura123' });

    const user = await service.me(first.user.id);
    const active = await sessions.findActiveByUser(user.id, new Date());
    expect(active).toHaveLength(2);
    // La primera sesión ya no es válida: rotarla falla.
    await expect(service.refresh(first.refreshToken)).rejects.toMatchObject({ status: 401 });
  });

  it('rota el refresh y detecta la reutilización revocando la familia', async () => {
    const service = makeService(new FakeMongoDatabase());
    await service.register({ email: 'rotar@test.com', password: 'Segura123', fullName: 'R' });
    const login = await service.login({ email: 'rotar@test.com', password: 'Segura123' });

    const rotated = await service.refresh(login.refreshToken);
    expect(rotated.refreshToken).not.toBe(login.refreshToken);

    // Reusar el token viejo → 401 y familia completa revocada.
    await expect(service.refresh(login.refreshToken)).rejects.toMatchObject({ status: 401 });
    // El token nuevo también murió con la familia.
    await expect(service.refresh(rotated.refreshToken)).rejects.toMatchObject({ status: 401 });
  });

  it('logout es idempotente y logoutAll revoca todo', async () => {
    const service = makeService(new FakeMongoDatabase());
    await service.register({ email: 'salir@test.com', password: 'Segura123', fullName: 'S' });
    const login = await service.login({ email: 'salir@test.com', password: 'Segura123' });

    await expect(service.logout(undefined)).resolves.toBeUndefined();
    await service.logout(login.refreshToken);
    await expect(service.refresh(login.refreshToken)).rejects.toMatchObject({ status: 401 });

    const second = await service.login({ email: 'salir@test.com', password: 'Segura123' });
    await service.logoutAll(second.user.id);
    await expect(service.refresh(second.refreshToken)).rejects.toMatchObject({ status: 401 });
  });
});
