import { Request, Response } from 'express';
import User from '../models/User';

export const fixFaculty = async (req: Request, res: Response) => {
  try {
    const result = await User.updateMany(
      { department: 'Education Department' },
      { $set: { department: 'Faculty' } }
    );
    res.json({ message: 'Fixed department names', modifiedCount: result.modifiedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
