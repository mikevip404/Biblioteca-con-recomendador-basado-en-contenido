import type { NextFunction, Request, Response } from 'express';
import { GenreService } from '../services/genre.service.js';
import type {
  CreateGenreInput,
  UpdateGenreInput
} from '../schemas/catalog.schemas.js';

/** Traduce HTTP ↔ GenreService. No consulta la base de datos. */
export class GenreController {
  constructor(private readonly genres: GenreService) {}

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.genres.list();
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const data = await this.genres.getById(id);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = req.body as CreateGenreInput;
      const data = await this.genres.create(input);
      res.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const input = req.body as UpdateGenreInput;
      const data = await this.genres.update(id, input);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      await this.genres.remove(id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  };
}
