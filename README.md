# Biblioteca — Recomendador Basado en Contenido

Proyecto de grado de Ingeniería de Software. Aplicación de biblioteca donde los
usuarios exploran libros, los valoran, marcan favoritos y reciben recomendaciones
generadas por un motor de similitud de cosenos implementado **a mano** (sin
librerías de ML ni APIs de IA).

## Estructura

- `backend/` — Node.js + Express + TypeScript estricto + MongoDB (capas
  controllers → services → repositories con inyección de dependencias).
- `frontend/` — Vue 3 + Pinia + TypeScript + Vue Router (Fase 2 en adelante).

## Fases

1. **Fase 1** — Esqueleto backend, PostgreSQL, migraciones y `/health`
2. Fase 2 — Autenticación (Argon2id, JWT, refresh rotativo), roles.
3. Fase 3 — CRUD de libros, géneros, valoraciones y favoritos.
4. Fase 4 — Motor de recomendación por contenido + grafo de libros afines.
5. Fase 5 — Frontend completo.

Ver `backend/README.md` para ejecutar el backend.
