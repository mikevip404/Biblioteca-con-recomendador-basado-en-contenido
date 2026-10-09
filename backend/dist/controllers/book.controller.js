import { HttpError } from '../middlewares/error.middleware.js';
/** Traduce HTTP ↔ BookService. No consulta la base de datos. */
export class BookController {
    books;
    constructor(books) {
        this.books = books;
    }
    list = async (req, res, next) => {
        try {
            const query = req.query;
            const result = await this.books.list(query);
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    };
    getById = async (req, res, next) => {
        try {
            const { id } = req.params;
            const data = await this.books.getById(id);
            res.status(200).json({ data });
        }
        catch (error) {
            next(error);
        }
    };
    create = async (req, res, next) => {
        try {
            const user = req.user;
            if (user === undefined) {
                next(HttpError.unauthorized());
                return;
            }
            const input = req.body;
            const data = await this.books.create(input, user.id);
            res.status(201).json({ data });
        }
        catch (error) {
            next(error);
        }
    };
    update = async (req, res, next) => {
        try {
            const { id } = req.params;
            const input = req.body;
            const data = await this.books.update(id, input);
            res.status(200).json({ data });
        }
        catch (error) {
            next(error);
        }
    };
    remove = async (req, res, next) => {
        try {
            const { id } = req.params;
            await this.books.remove(id);
            res.status(204).end();
        }
        catch (error) {
            next(error);
        }
    };
}
