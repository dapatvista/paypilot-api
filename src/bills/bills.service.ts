import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.module';
import { DrizzleDb } from '../database/drizzle.types';
import { bills, billers } from '../database/schema';
import { BillersService } from '../billers/billers.service';
import { CreateBillDto } from './dto/create-bill.dto';

export type BillWithBiller = {
  id: number;
  label: string;
  billerAccountNumber: string;
  estimatedMonthlyAmount: string;
  dueDayOfMonth: number;
  status: string;
  createdAt: Date;
  biller: {
    id: number;
    name: string;
    category: string;
    productCode: string;
  };
};

@Injectable()
export class BillsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly billersService: BillersService,
  ) {}

  async create(userId: number, dto: CreateBillDto): Promise<BillWithBiller> {
    const biller = await this.billersService.findById(dto.billerId);
    if (!biller) {
      throw new NotFoundException('Biller not found');
    }

    const result = await this.db
      .insert(bills)
      .values({
        userId,
        billerId: dto.billerId,
        billerAccountNumber: dto.billerAccountNumber,
        label: dto.label,
        estimatedMonthlyAmount: dto.estimatedMonthlyAmount.toFixed(2),
        dueDayOfMonth: dto.dueDayOfMonth,
      })
      .$returningId();

    const id = result[0].id;
    const created = await this.findByIdForUser(id, userId);
    if (!created) {
      throw new Error('Failed to load bill after creation');
    }
    return created;
  }

  async findAllByUser(userId: number): Promise<BillWithBiller[]> {
    const rows = await this.db
      .select({
        id: bills.id,
        label: bills.label,
        billerAccountNumber: bills.billerAccountNumber,
        estimatedMonthlyAmount: bills.estimatedMonthlyAmount,
        dueDayOfMonth: bills.dueDayOfMonth,
        status: bills.status,
        createdAt: bills.createdAt,
        billerId: billers.id,
        billerName: billers.name,
        billerCategory: billers.category,
        billerProductCode: billers.productCode,
      })
      .from(bills)
      .innerJoin(billers, eq(bills.billerId, billers.id))
      .where(eq(bills.userId, userId))
      .orderBy(desc(bills.createdAt));

    return rows.map(this.toBillWithBiller);
  }

  async findByIdForUser(id: number, userId: number): Promise<BillWithBiller | undefined> {
    const [row] = await this.db
      .select({
        id: bills.id,
        label: bills.label,
        billerAccountNumber: bills.billerAccountNumber,
        estimatedMonthlyAmount: bills.estimatedMonthlyAmount,
        dueDayOfMonth: bills.dueDayOfMonth,
        status: bills.status,
        createdAt: bills.createdAt,
        billerId: billers.id,
        billerName: billers.name,
        billerCategory: billers.category,
        billerProductCode: billers.productCode,
      })
      .from(bills)
      .innerJoin(billers, eq(bills.billerId, billers.id))
      .where(and(eq(bills.id, id), eq(bills.userId, userId)))
      .limit(1);

    return row ? this.toBillWithBiller(row) : undefined;
  }

  async markReminderScheduled(billId: number, dueDate: string): Promise<void> {
    await this.db
      .update(bills)
      .set({ lastReminderForDueDate: dueDate })
      .where(eq(bills.id, billId));
  }

  private toBillWithBiller(row: {
    id: number;
    label: string;
    billerAccountNumber: string;
    estimatedMonthlyAmount: string;
    dueDayOfMonth: number;
    status: string;
    createdAt: Date;
    billerId: number;
    billerName: string;
    billerCategory: string;
    billerProductCode: string;
  }): BillWithBiller {
    return {
      id: row.id,
      label: row.label,
      billerAccountNumber: row.billerAccountNumber,
      estimatedMonthlyAmount: row.estimatedMonthlyAmount,
      dueDayOfMonth: row.dueDayOfMonth,
      status: row.status,
      createdAt: row.createdAt,
      biller: {
        id: row.billerId,
        name: row.billerName,
        category: row.billerCategory,
        productCode: row.billerProductCode,
      },
    };
  }
}
