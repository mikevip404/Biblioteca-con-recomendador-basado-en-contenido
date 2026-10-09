import type { NextFunction, Request, Response } from 'express';
import { AuthorService } from '../services/author.service.js';
import type {
  CreateAuthorInput,
  UpdateAuthorInput
} from '../schemas/catalog.schemas.js';

/** Traduce HTTP ↔ AuthorService. No consulta la base de datos. */
export class AuthorController {
  constructor(private readonly authors: AuthorService) {}

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.authors.list();
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const data = await this.authors.getById(id);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = req.body as CreateAuthorInput;
      const data = await this.authors.create(input);
      res.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const input = req.body as UpdateAuthorInput;
      const data = await this.authors.update(id, input);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      await this.authors.remove(id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  };
}
