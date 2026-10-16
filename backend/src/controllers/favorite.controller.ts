import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware.js';
import { FavoriteService } from '../services/favorite.service.js';
import type { RatingsQueryInput } from '../schemas/ratings.schemas.js';

/** Traduce HTTP ↔ FavoriteService. El userId sale del token. */
export class FavoriteController {
  constructor(private readonly favorites: FavoriteService) {}

  add = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (user === undefined) {
        next(HttpError.unauthorized());
        return;
      }
      const { bookId } = req.params as { bookId: string };
      await this.favorites.add(user.id, bookId);
      res.status(200).json({ data: { bookId, isFavorite: true } });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (user === undefined) {
        next(HttpError.unauthorized());
        return;
      }
      const { bookId } = req.params as { bookId: string };
      await this.favorites.remove(user.id, bookId);
      res.status(200).json({ data: { bookId, isFavorite: false } });
    } catch (error) {
      next(error);
    }
  };

  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (user === undefined) {
        next(HttpError.unauthorized());
        return;
      }
      const { page, limit } = req.query as unknown as RatingsQueryInput;
      const result = await this.favorites.listMine(user.id, page, limit);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
