# Backend — Biblioteca API

Node.js + Express + TypeScript (estricto, sin `any`) + MongoDB.

## Requisitos

- **Node.js ≥ 20** y npm
- **MongoDB**: un cluster gratuito de [MongoDB Atlas](https://www.mongodb.com/atlas)
  o un MongoDB local (`mongodb://localhost:27017`)

## Configuración

```bash
cd backend
npm install
cp .env.example .env        # pega aquí tu MONGODB_URI real (con usuario y clave)
```

Variables (ver `.env.example`):

| Variable         | Descripción                                        |
| ---------------- | -------------------------------------------------- |
| `PORT`           | Puerto del servidor (por defecto 3000)             |
| `MONGODB_URI`    | URL de conexión (`mongodb://` o `mongodb+srv://`) |
| `MONGODB_DB_NAME`| Nombre de la base de datos (`biblioteca`)         |
| `LOG_LEVEL`      | `debug` \| `info` \| `warn` \| `error`             |
| `AUTO_MIGRATE`   | Ejecutar migraciones al arrancar (`true` por defecto) |

> El `.env` real (y cualquier `*.env` con secretos) **nunca se commitea**:
> está cubierto por el `.gitignore` raíz.

## Ejecutar

```bash
npm run dev        # servidor en modo desarrollo (tsx watch)
# o bien, migración explícita + build + start:
npm run db:migrate
npm run build
npm start
```

Al arrancar, el servidor verifica la conexión y aplica las migraciones
pendientes automáticamente (si `AUTO_MIGRATE=true`).

## Probar

```bash
curl http://localhost:3000/health
# → {"app":"biblioteca-api","version":"1.0.0","status":"ok","database":"ok", ...}

npm test           # pruebas unitarias e integración (Vitest, sin BD real)
npm run typecheck  # tsc --noEmit (verifica tipos de todo el proyecto)
```

Las pruebas no necesitan MongoDB: usan dobles en memoria inyectados por
inyección de dependencias.

## Estructura

```
src/
├── app.ts                  # factoría de Express + wireado de middlewares
├── server.ts               # bootstrap: env, conexión, migraciones, listen
├── config/env.ts           # validación de variables con Zod
├── db/
│   ├── mongo.ts            # conexión + adaptador MongoDatabase (DIP)
│   ├── migrate.ts          # runner de migraciones versionadas
│   └── migrations/         # 001..007 *.ts + index.ts (registro en orden)
├── controllers/            # traducen servicio → HTTP (no tocan la BD)
├── services/               # lógica de negocio (no conocen Express ni el driver)
├── repositories/           # acceso a datos (interfaz + implementación mongo)
├── routes/                 # routers que reciben controladores por DI
├── middlewares/            # correlation-id, request-logger, errores, 404
├── types/                  # aumentos de tipos de Express
└── utils/logger.ts         # logger JSON estructurado
```

## Decisiones de diseño (Fase 1, MongoDB)

- **Capas estrictas con DI**: `controllers → services → repositories`. El
  servicio depende de interfaces (`HealthRepository`, `MongoDatabase`), no de
  implementaciones (principio DIP de SOLID). Solo `wrapDb` conoce el driver.
- **Sin ODM**: driver oficial `mongodb`; la entrada de usuario viaja en
  objetos/filtros, nunca en strings evaluados.
- **Migraciones versionadas en TS** con registro estático (`index.ts`):
  funciona idéntico en dev (`tsx`) y prod (`dist`), y la colección
  `migrations` guarda `{ version, name, appliedAt }`. Re-ejecutables.
- **Idempotencia en vez de transacciones**: MongoDB no permite DDL
  (`createCollection`, `createIndex`) en transacciones, así que cada
  migración usa operaciones `ensure*` y semillas que solo insertan faltantes.
- **Validadores `$jsonSchema`** por colección: email único, rol `admin|lector`,
  rating 1–5, páginas ≥ 1, etc. Las reglas viven en la BD, no solo en código.
- **Índices únicos compuestos** en `book_genres`, `ratings` y `favorites`:
  equivalen a las PKs/UNIQUE compuestas del modelo relacional.
- **Health con `ping`** y `serverSelectionTimeoutMS` de 5s: si Mongo cae, el
  endpoint responde 503 rápido en vez de colgar.
- **Seguridad básica**: `x-powered-by` deshabilitado, errores 500 sin detalles
  internos, logs JSON con `x-correlation-id`, secretos solo en `.env` local.

## Pendiente (fases siguientes)

- Fase 2: autenticación (Argon2id, JWT + refresh rotativo), roles, Zod en DTOs,
  rate limiting, CORS.
- Fase 3: CRUD de libros, valoraciones y favoritos.
- Fase 4: motor de recomendación y grafo de afines.
