import {
  mysqlTable,
  varchar,
  int,
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
