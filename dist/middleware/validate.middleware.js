"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const validate = (schema) => {
    return async (req, res, next) => {
        try {
            const parsed = await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            // Replace with typed schemas
            if (parsed && typeof parsed === 'object') {
                if ('body' in parsed)
                    req.body = parsed.body;
                if ('query' in parsed)
                    req.query = parsed.query;
                if ('params' in parsed)
                    req.params = parsed.params;
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.validate = validate;
