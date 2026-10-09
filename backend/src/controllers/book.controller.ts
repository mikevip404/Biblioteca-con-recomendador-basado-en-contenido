import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware.js';
import { BookService } from '../services/book.service.js';
import type {
  BookQueryInput,
  CreateBookInput,
  UpdateBookInput
} from '../schemas/catalog.schemas.js';

/** Traduce HTTP ↔ BookService. No consulta la base de datos. */
export class BookController {
  constructor(private readonly books: BookService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as BookQueryInput;
      const result = await this.books.list(query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const data = await this.books.getById(id);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (user === undefined) {
        next(HttpError.unauthorized());
        return;
      }
      const input = req.body as CreateBookInput;
      const data = await this.books.create(input, user.id);
      res.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const input = req.body as UpdateBookInput;
      const data = await this.books.update(id, input);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      await this.books.remove(id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  };
}
