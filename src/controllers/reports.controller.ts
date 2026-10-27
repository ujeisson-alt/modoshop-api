import { Request, Response } from 'express';
import { ReportService } from '../services/report.service';
import { getValidated } from '../middlewares/validate';
import { SalesReportQuery, TopProductsQuery } from '../schemas/report.schema';

export const getSalesReport = async (_req: Request, res: Response): Promise<void> => {
  res.json({ success: true, data: await ReportService.sales(getValidated<SalesReportQuery>(res, 'query')) });
};

export const getTopProducts = async (_req: Request, res: Response): Promise<void> => {
  res.json({ success: true, data: await ReportService.topProducts(getValidated<TopProductsQuery>(res, 'query')) });
};
