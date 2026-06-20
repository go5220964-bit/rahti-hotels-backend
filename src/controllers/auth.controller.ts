import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { ApiResponse } from '../types';

export class AuthController {
  public static login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const phone = req.body.phone || req.body.phoneNumber;
      const { password } = req.body;
      const result = await AuthService.login(phone, password);
      const response: ApiResponse = {
        success: true,
        data: result,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response: ApiResponse = {
        success: true,
        data: { message: 'Logged out successfully' },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public static me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.userId;
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
      const user = await AuthService.getUserById(userId);
      const response: ApiResponse = {
        success: true,
        data: user,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
