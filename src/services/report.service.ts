import { QueryTypes, fn, col, literal, Op } from 'sequelize';
import { sequelize } from '../config/database';
import { Order, OrderItem, Product, ProductVariant } from '../models/mysql';
import { SalesReportQuery, TopProductsQuery } from '../schemas/report.schema';
import { round2, toNumber } from '../utils/money';

const PERIOD_FORMAT: Record<SalesReportQuery['groupBy'], string> = {
  day: '%Y-%m-%d',
  week: '%x-W%v',
  month: '%Y-%m',
};

// Las fechas se guardan en UTC (timezone '+00:00' en Sequelize); los raw queries reciben strings UTC
const toUtcSql = (date: Date): string => date.toISOString().slice(0, 19).replace('T', ' ');

// Estados que cuentan como venta concretada
const SOLD_STATUSES = ['PAID', 'SHIPPED', 'DELIVERED'];

interface SalesRow {
  period: string;
  orders: number | string;
  gross: number | string;
  discounts: number | string;
  revenue: number | string;
}

export const ReportService = {
  async sales(query: SalesReportQuery) {
    const to = query.to ?? new Date();
    const from = query.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const rows = await sequelize.query<SalesRow>(
      `SELECT DATE_FORMAT(o.created_at, :fmt) AS period,
              COUNT(*)                      AS orders,
              SUM(o.subtotal)               AS gross,
              SUM(o.discount_amount)        AS discounts,
              SUM(o.total)                  AS revenue
         FROM orders o
        WHERE o.status IN (:statuses)
          AND o.created_at BETWEEN :from AND :to
        GROUP BY period
        ORDER BY period ASC`,
      {
        type: QueryTypes.SELECT,
        replacements: {
          fmt: PERIOD_FORMAT[query.groupBy],
          statuses: SOLD_STATUSES,
          from: toUtcSql(from),
          to: toUtcSql(to),
        },
      },
    );
    const series = rows.map((r) => ({
      period: r.period,
      orders: Number(r.orders),
      gross: round2(toNumber(r.gross)),
      discounts: round2(toNumber(r.discounts)),
      revenue: round2(toNumber(r.revenue)),
    }));
    const totalOrders = series.reduce((s, r) => s + r.orders, 0);
    const totalRevenue = round2(series.reduce((s, r) => s + r.revenue, 0));
    const statusRows = await Order.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      where: { createdAt: { [Op.between]: [from, to] } },
      group: ['status'],
      raw: true,
    });
    return {
      from,
      to,
      groupBy: query.groupBy,
      summary: {
        orders: totalOrders,
        revenue: totalRevenue,
        discounts: round2(series.reduce((s, r) => s + r.discounts, 0)),
        averageTicket: totalOrders ? round2(totalRevenue / totalOrders) : 0,
        ordersByStatus: Object.fromEntries(
          (statusRows as unknown as { status: string; count: number | string }[]).map((r) => [r.status, Number(r.count)]),
        ),
      },
      series,
    };
  },

  /** Top productos (por variante) vendidos en los últimos N días — con el ORM de Sequelize. */
  async topProducts(query: TopProductsQuery) {
    const since = new Date(Date.now() - query.days * 24 * 60 * 60 * 1000);
    const rows = await OrderItem.findAll({
      attributes: [
        [fn('SUM', col('OrderItem.quantity')), 'totalSold'],
        [fn('SUM', literal('`OrderItem`.`quantity` * `OrderItem`.`unit_price`')), 'totalRevenue'],
      ],
      include: [
        {
          model: ProductVariant,
          as: 'variant',
          attributes: ['id', 'size', 'color', 'sku'],
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'basePrice'] }],
        },
        {
          model: Order,
          as: 'order',
          where: { status: { [Op.in]: SOLD_STATUSES }, createdAt: { [Op.gte]: since } },
          attributes: [],
        },
      ],
      group: ['variant.id', 'variant->product.id'],
      order: [[literal('totalSold'), 'DESC']],
      limit: query.limit,
      subQuery: false,
    });
    return {
      days: query.days,
      since,
      items: rows.map((r, idx) => {
        const variant = r.variant;
        return {
          rank: idx + 1,
          productId: variant?.product?.id ?? null,
          productName: variant?.product?.name ?? null,
          variantId: variant?.id ?? null,
          sku: variant?.sku ?? null,
          size: variant?.size ?? null,
          color: variant?.color ?? null,
          totalSold: Number(r.get('totalSold')),
          totalRevenue: round2(toNumber(r.get('totalRevenue'))),
        };
      }),
    };
  },
};
