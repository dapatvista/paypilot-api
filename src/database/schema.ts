import {
  mysqlTable,
  varchar,
  int,
  decimal,
  timestamp,
  mysqlEnum,
  json,
  index,
} from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  mobile: varchar('mobile', { length: 32 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  status: mysqlEnum('status', ['active', 'disabled']).notNull().default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// PayPilot owns the biller catalogue itself — it does not proxy
// mypay-api's PayHub integration. Seeded from the real biller list.

export const billers = mysqlTable(
  'billers',
  {
    id: int('id').autoincrement().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    category: varchar('category', { length: 45 }).notNull(),
    productCode: varchar('product_code', { length: 45 }).notNull(),
    productType: varchar('product_type', { length: 45 }),
    formSchema: json('form_schema'),
    logoUrl: varchar('logo_url', { length: 255 }),
    status: mysqlEnum('status', ['active', 'inactive']).notNull().default('active'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    productCodeIdx: index('billers_product_code_idx').on(table.productCode),
    categoryIdx: index('billers_category_idx').on(table.category),
    statusIdx: index('billers_status_idx').on(table.status),
  }),
);

export type Biller = typeof billers.$inferSelect;
export type NewBiller = typeof billers.$inferInsert;

// There is no bill-inquiry step in this flow — the user enters their own
// estimated monthly commitment at registration (`bills.estimatedMonthlyAmount`).

export const bills = mysqlTable(
  'bills',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id').notNull(),
    billerId: int('biller_id').notNull(),
    billerAccountNumber: varchar('biller_account_number', { length: 128 }).notNull(),
    label: varchar('label', { length: 255 }).notNull(),
    estimatedMonthlyAmount: decimal('estimated_monthly_amount', {
      precision: 10,
      scale: 2,
    }).notNull(),
    status: mysqlEnum('status', ['active', 'archived']).notNull().default('active'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    userIdIdx: index('bills_user_id_idx').on(table.userId),
    billerIdIdx: index('bills_biller_id_idx').on(table.billerId),
  }),
);

export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;
