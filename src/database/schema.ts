import {
  mysqlTable,
  varchar,
  int,
  decimal,
  datetime,
  timestamp,
  mysqlEnum,
  json,
  index,
  uniqueIndex,
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

export const payments = mysqlTable(
  'payments',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id').notNull(),
    billId: int('bill_id').notNull(),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('myr'),
    stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
    status: mysqlEnum('status', ['pending', 'succeeded', 'failed', 'cancelled'])
      .notNull()
      .default('pending'),
    billerPushStatus: mysqlEnum('biller_push_status', ['pending', 'success', 'failed'])
      .notNull()
      .default('pending'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    userIdIdx: index('payments_user_id_idx').on(table.userId),
    billIdIdx: index('payments_bill_id_idx').on(table.billId),
    stripePaymentIntentIdIdx: uniqueIndex('payments_stripe_payment_intent_id_idx').on(
      table.stripePaymentIntentId,
    ),
  }),
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

// Settlement (push-to-biller) is mocked, not wired to a real gateway —
// see SettlementService. Every attempt is still logged here.
export const billerPushAttempts = mysqlTable(
  'biller_push_attempts',
  {
    id: int('id').autoincrement().primaryKey(),
    paymentId: int('payment_id').notNull(),
    requestPayload: json('request_payload'),
    responsePayload: json('response_payload'),
    resultCode: varchar('result_code', { length: 45 }),
    resultDescription: varchar('result_description', { length: 255 }),
    status: mysqlEnum('status', ['success', 'failed']).notNull(),
    attemptedAt: timestamp('attempted_at').notNull().defaultNow(),
  },
  (table) => ({
    paymentIdIdx: index('biller_push_attempts_payment_id_idx').on(table.paymentId),
  }),
);

export type BillerPushAttempt = typeof billerPushAttempts.$inferSelect;
export type NewBillerPushAttempt = typeof billerPushAttempts.$inferInsert;

export const reminders = mysqlTable(
  'reminders',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id').notNull(),
    billId: int('bill_id').notNull(),
    scheduledFor: datetime('scheduled_for').notNull(),
    status: mysqlEnum('status', ['scheduled', 'sent', 'cancelled', 'failed'])
      .notNull()
      .default('scheduled'),
    externalMessageRef: varchar('external_message_ref', { length: 128 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    billIdIdx: index('reminders_bill_id_idx').on(table.billId),
    scheduledForIdx: index('reminders_scheduled_for_idx').on(table.scheduledFor),
  }),
);

export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;
