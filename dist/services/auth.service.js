"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const prisma_1 = __importDefault(require("./prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const error_middleware_1 = require("../middleware/error.middleware");
const JWT_SECRET = process.env.JWT_SECRET || 'rahti-secret-2026';
class AuthService {
    /**
     * Log in user with phone number and password.
     * Returns JWT token and user info on success.
     */
    static async login(phoneNumber, password) {
        if (!phoneNumber || !password) {
            throw new error_middleware_1.AppError(400, 'MISSING_CREDENTIALS', 'يرجى تقديم رقم الهاتف وكلمة المرور.');
        }
        const user = await prisma_1.default.user.findUnique({
            where: { phoneNumber },
            include: { branch: true },
        });
        if (!user) {
            throw new error_middleware_1.AppError(401, 'INVALID_CREDENTIALS', 'رقم الهاتف أو كلمة المرور غير صحيحة.');
        }
        const isMatch = bcryptjs_1.default.compareSync(password, user.password || '');
        if (!isMatch) {
            throw new error_middleware_1.AppError(401, 'INVALID_CREDENTIALS', 'رقم الهاتف أو كلمة المرور غير صحيحة.');
        }
        // Update lastLogin
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
        });
        const payload = {
            userId: user.id,
            role: user.role,
            branchId: user.branchId,
            name: user.name,
        };
        const token = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '7d' });
        // Exclude password from returned user object
        const { password: _, ...userWithoutPassword } = user;
        return {
            token,
            user: userWithoutPassword,
        };
    }
    /**
     * Verify token and extract payload.
     */
    static verifyToken(token) {
        try {
            return jsonwebtoken_1.default.verify(token, JWT_SECRET);
        }
        catch (err) {
            throw new error_middleware_1.AppError(401, 'INVALID_TOKEN', 'رمز الوصول غير صالح أو منتهي الصلاحية.');
        }
    }
    /**
     * Get user by ID.
     */
    static async getUserById(userId) {
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            include: { branch: true },
        });
        if (!user) {
            throw new error_middleware_1.AppError(404, 'USER_NOT_FOUND', 'المستخدم غير موجود.');
        }
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }
}
exports.AuthService = AuthService;
