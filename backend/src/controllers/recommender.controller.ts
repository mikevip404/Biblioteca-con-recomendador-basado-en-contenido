import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware.js';
import { RecommenderService } from '../services/recommender.service.js';
import type {
  RebuildJobParam,
  RecommenderQueryInput
} from '../schemas/recommender.schemas.js';

/** Traduce HTTP ↔ RecommenderService. */
export class RecommenderController {
  constructor(private readonly recommender: RecommenderService) {}

  recommendations = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = req.user;
      if (user === undefined) {
        next(HttpError.unauthorized());
        return;
      }
      const { limit } = req.query as unknown as RecommenderQueryInput;
      const data = await this.recommender.getRecommendations(user.id, limit);
      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  };

  similar = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const { limit } = req.query as unknown as RecommenderQueryInput;
      const data = await this.recommender.getSimilar(id, limit);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  };

  graph = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const { limit } = req.query as unknown as RecommenderQueryInput;
      const data = await this.recommender.getGraph(id, limit);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  };

  status = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await this.recommender.getStatus();
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  };

  rebuild = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await this.recommender.rebuild();
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  };

  rebuildStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { jobId } = req.params as unknown as RebuildJobParam;
      const data = await this.recommender.getRebuildStatus(jobId);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  };
}
