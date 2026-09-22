import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.module';
import { DrizzleDb } from '../database/drizzle.types';
import { Biller, billers } from '../database/schema';

@Injectable()
export class BillersService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async findAll(
    filters: { category?: string; status?: 'active' | 'inactive' } = {},
  ): Promise<Biller[]> {
    const conditions = [];
    if (filters.category) {
      conditions.push(eq(billers.category, filters.category));
    }
    conditions.push(eq(billers.status, filters.status ?? 'active'));

    return this.db
      .select()
      .from(billers)
      .where(and(...conditions))
      .orderBy(billers.name);
  }

  async findById(id: number): Promise<Biller | undefined> {
    const [biller] = await this.db.select().from(billers).where(eq(billers.id, id)).limit(1);
    return biller;
  }
}
