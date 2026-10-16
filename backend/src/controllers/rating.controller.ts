import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware.js';
import { RatingService } from '../services/rating.service.js';
import type {
  RatingBodyInput,
  RatingsQueryInput
} from '../schemas/ratings.schemas.js';

/** Traduce HTTP ↔ RatingService. El userId sale del token, nunca del cliente. */
export class RatingController {
  constructor(private readonly ratings: RatingService) {}

  putMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (user === undefined) {
        next(HttpError.unauthorized());
        return;
      }
      const { bookId } = req.params as { bookId: string };
      const body = req.body as RatingBodyInput;
      const data = await this.ratings.putMyRating(user.id, bookId, body.value, body.comment);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  };

  deleteMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (user === undefined) {
        next(HttpError.unauthorized());
        return;
      }
      const { bookId } = req.params as { bookId: string };
      await this.ratings.deleteMyRating(user.id, bookId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  };

  listByBook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { bookId } = req.params as { bookId: string };
      const { page, limit } = req.query as unknown as RatingsQueryInput;
      const result = await this.ratings.listByBook(bookId, page, limit);
      res.status(200).json(result);
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
      const result = await this.ratings.listMine(user.id, page, limit);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  deleteById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (user === undefined) {
        next(HttpError.unauthorized());
        return;
      }
      const { id } = req.params as { id: string };
      await this.ratings.deleteRating(user.id, user.role === 'admin', id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  };
}
