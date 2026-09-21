import { Request, Response } from 'express';
import User from '../models/User';

export const debugEmployeesEndpoint = async (req: Request, res: Response) => {
  try {
    const adminUser = await User.findOne({ email: 'divyayadav141203@gmail.com' }); // or any admin
    
    const { getUserScopeFilter } = require('../utils/scopeHelper');
    const scopeFilter = await getUserScopeFilter(adminUser);
    
    const query: any = {};
    Object.assign(query, scopeFilter);
    
    const total = await User.countDocuments(query);
    const employees = await User.find(query).select('-password').limit(10);
    
    res.json({ adminUser: adminUser?.email, adminScope: adminUser?.adminScope, scopeFilter, query, total, employeesCount: employees.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
};
