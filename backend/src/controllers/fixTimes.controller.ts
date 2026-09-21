import { Request, Response } from 'express';
import User from '../models/User';

export const fixTimes = async (req: Request, res: Response) => {
  try {
    const u1 = await User.findOneAndUpdate(
      { email: 'fast.abhiwak@gmail.com' },
      { $set: { officeStartTime: '12:05', officeEndTime: '00:05' } },
      { new: true }
    );
    const u2 = await User.findOneAndUpdate(
      { email: 'fast.srabanipanigrahi@gmail.com' },
      { $set: { officeStartTime: '14:05', officeEndTime: '19:05' } },
      { new: true }
    );
    res.json({ message: 'Fixed times', u1, u2 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
