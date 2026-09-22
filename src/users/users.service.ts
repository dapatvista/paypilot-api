import { Inject, Injectable } from '@nestjs/common';
import { eq, or } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.module';
import { DrizzleDb } from '../database/drizzle.types';
import { NewUser, User, users } from '../database/schema';

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async findById(id: number): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  async findByEmailOrMobile(email: string, mobile: string): Promise<User[]> {
    return this.db
      .select()
      .from(users)
      .where(or(eq(users.email, email), eq(users.mobile, mobile)));
  }

  async create(data: NewUser): Promise<User> {
    const result = await this.db.insert(users).values(data).$returningId();
    const id = result[0].id;
    const created = await this.findById(id);
    if (!created) {
      throw new Error('Failed to load user after creation');
    }
    return created;
  }
}
