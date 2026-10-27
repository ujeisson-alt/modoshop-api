import { PaginationMeta } from '../types';

export const getPagination = (page: number, limit: number): { offset: number; limit: number } => ({
  offset: (page - 1) * limit,
  limit,
});

export const buildMeta = (page: number, limit: number, total: number): PaginationMeta => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});
