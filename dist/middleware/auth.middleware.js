"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.verifyToken = void 0;
const auth_service_1 = require("../services/auth.service");
const error_middleware_1 = require("./error.middleware");
const verifyToken = (req, res, next) => {
    try {
        const cleanPath = req.path.toLowerCase().replace(/\/$/, '');
        // Explicitly bypass token verification for public routes using flexible endsWith checks
        if (cleanPath.endsWith('/auth/login') || cleanPath.endsWith('/webhook') || cleanPath.endsWith('/health') || cleanPath === '/health') {
            return next();
        }
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new error_middleware_1.AppError(401, 'UNAUTHORIZED', 'يرجى تقديم رمز وصول صالح.');
        }
        const token = authHeader.split(' ')[1];
        const decoded = auth_service_1.AuthService.verifyToken(token);
        req.user = decoded;
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.verifyToken = verifyToken;
const requireRole = (...roles) => {
    return (req, res, next) => {
        try {
            const user = req.user;
            if (!user) {
                throw new error_middleware_1.AppError(401, 'UNAUTHORIZED', 'غير مصرح بالوصول - يرجى تسجيل الدخول.');
            }
            if (!roles.includes(user.role)) {
                throw new error_middleware_1.AppError(403, 'FORBIDDEN', '🔒 عذراً، ليس لديك الصلاحية الكافية للوصول إلى هذا المورد.');
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.requireRole = requireRole;
