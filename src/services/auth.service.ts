import prisma from './prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../middleware/error.middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'rahti-secret-2026';

export interface JWTPayload {
  userId: string;
  role: string;
  branchId: string | null;
  name: string;
}

export class AuthService {
  /**
   * Log in user with phone number and password.
   * Returns JWT token and user info on success.
   */
  public static async login(phoneNumber: string, password: UserPassword): Promise<{ token: string; user: any }> {
    if (!phoneNumber || !password) {
      throw new AppError(400, 'MISSING_CREDENTIALS', 'يرجى تقديم رقم الهاتف وكلمة المرور.');
    }

    const user = await prisma.user.findUnique({
      where: { phoneNumber },
      include: { branch: true },
    });

    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'رقم الهاتف أو كلمة المرور غير صحيحة.');
    }

    const isMatch = bcrypt.compareSync(password, user.password || '');
    if (!isMatch) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'رقم الهاتف أو كلمة المرور غير صحيحة.');
    }

    // Update lastLogin
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const payload: JWTPayload = {
      userId: user.id,
      role: user.role,
      branchId: user.branchId,
      name: user.name,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

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
  public static verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (err) {
      throw new AppError(401, 'INVALID_TOKEN', 'رمز الوصول غير صالح أو منتهي الصلاحية.');
    }
  }

  /**
   * Get user by ID.
   */
  public static async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { branch: true },
    });
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'المستخدم غير موجود.');
    }
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}

type UserPassword = string;
