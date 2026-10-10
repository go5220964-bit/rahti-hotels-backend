"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("../services/auth.service");
class AuthController {
    static login = async (req, res, next) => {
        try {
            const phone = req.body.phone || req.body.phoneNumber;
            const { password } = req.body;
            const result = await auth_service_1.AuthService.login(phone, password);
            const response = {
                success: true,
                data: result,
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static logout = async (req, res, next) => {
        try {
            const response = {
                success: true,
                data: { message: 'Logged out successfully' },
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    static me = async (req, res, next) => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'غير مصرح بالوصول.',
                    },
                });
                return;
            }
            const user = await auth_service_1.AuthService.getUserById(userId);
            const response = {
                success: true,
                data: user,
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
}
exports.AuthController = AuthController;
