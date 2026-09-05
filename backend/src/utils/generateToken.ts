import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const generateToken = (id: mongoose.Types.ObjectId): string => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  } as jwt.SignOptions);
};

export default generateToken;
