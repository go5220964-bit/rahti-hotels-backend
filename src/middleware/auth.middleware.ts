import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { AppError } from './error.middleware';

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  try {
    const cleanPath = req.path.toLowerCase().replace(/\/$/, '');
    
    // Explicitly bypass token verification for public routes
    if (cleanPath === '/api/auth/login' || cleanPath === '/api/whatsapp-webhook' || cleanPath === '/health') {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'UNAUTHORIZED', 'يرجى تقديم رمز وصول صالح.');
    }

    const token = authHeader.split(' ')[1];
    const decoded = AuthService.verifyToken(token);
    (req as any).user = decoded;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new AppError(401, 'UNAUTHORIZED', 'غير مصرح بالوصول - يرجى تسجيل الدخول.');
      }

      if (!roles.includes(user.role)) {
        throw new AppError(403, 'FORBIDDEN', '🔒 عذراً، ليس لديك الصلاحية الكافية للوصول إلى هذا المورد.');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
