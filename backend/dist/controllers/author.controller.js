/** Traduce HTTP ↔ AuthorService. No consulta la base de datos. */
export class AuthorController {
    authors;
    constructor(authors) {
        this.authors = authors;
    }
    list = async (_req, res, next) => {
        try {
            const data = await this.authors.list();
            res.status(200).json({ data });
        }
        catch (error) {
            next(error);
        }
    };
    getById = async (req, res, next) => {
        try {
            const { id } = req.params;
            const data = await this.authors.getById(id);
            res.status(200).json({ data });
        }
        catch (error) {
            next(error);
        }
    };
    create = async (req, res, next) => {
        try {
            const input = req.body;
            const data = await this.authors.create(input);
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
            const data = await this.authors.update(id, input);
            res.status(200).json({ data });
        }
        catch (error) {
            next(error);
        }
    };
    remove = async (req, res, next) => {
        try {
            const { id } = req.params;
            await this.authors.remove(id);
            res.status(204).end();
        }
        catch (error) {
            next(error);
        }
    };
}
