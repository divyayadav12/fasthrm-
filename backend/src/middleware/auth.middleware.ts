import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';

export interface AuthRequest extends Request {
  user?: IUser;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }
      
      req.user = user;
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user && (req.user.role === 'ADMIN' || req.user.role === 'MANAGER')) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

export const supportOrAdminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized, user not found' });
  }

  const role = (req.user.role || '').toUpperCase();
  const dept = (req.user.department || '').toLowerCase();
  const desig = (req.user.designation || '').toLowerCase();

  const isAdminOrManager = role === 'ADMIN' || role === 'MANAGER';
  const isSupportOrIT =
    dept.includes('support') ||
    dept.includes('it') ||
    desig.includes('support') ||
    desig.includes('it');

  if (isAdminOrManager || isSupportOrIT) {
    return next();
  }

  return res.status(403).json({
    message: 'Access denied. Student Inquiries are restricted to Admin and IT & Support team.',
  });
};
