import { randomUUID } from 'node:crypto';
import createError from 'http-errors';
import {
  AuditTimeKeys,
  BranchTable,
  Database,
  getDb,
  NewRow,
  OrderDirection,
  PatchRow,
  Roles,
} from '@libs/db';
import { Kysely, Selectable, Transaction } from 'kysely';

export type Branch = Omit<Selectable<BranchTable>, AuditTimeKeys> & {
  owner: BranchOwnerRecord | null;
};
export type NewBranch = NewRow<BranchTable> & { ownerId: string };
export type UpdateBranch = PatchRow<BranchTable> & { ownerId?: string | null };

export interface BranchOwnerRecord {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface BranchWithOwnerRow {
  id: string;
  name: string;
  contact: string | null;
  ownerId: string;
  ownerEmail: string | null;
  ownerFirstName: string | null;
  ownerLastName: string | null;
}

type Executor = Kysely<Database> | Transaction<Database>;

const BRANCH_TABLE = 'branch';
const OWNER_ALIAS = 'users';

const selectBranchWithOwner = (db: Executor) =>
  db
    .selectFrom(BRANCH_TABLE)
    .leftJoin(OWNER_ALIAS, 'users.branch', `${BRANCH_TABLE}.id`)
    .select([
      `${BRANCH_TABLE}.id as id`,
      `${BRANCH_TABLE}.name as name`,
      `${BRANCH_TABLE}.contact as contact`,
      'users.id as ownerId',
      'users.email as ownerEmail',
      'users.firstName as ownerFirstName',
      'users.lastName as ownerLastName',
    ]);

const mapBranchRow = (row: BranchWithOwnerRow): Branch => ({
  id: row.id,
  name: row.name,
  contact: row.contact,
  owner: {
    id: row.ownerId,
    email: row.ownerEmail ?? '',
    firstName: row.ownerFirstName,
    lastName: row.ownerLastName,
  },
});

const ensureOwnerExists = async (db: Executor, ownerId: string): Promise<void> => {
  const owner = await db
    .selectFrom('users')
    .select(['id'])
    .where('id', '=', ownerId)
    .executeTakeFirst();

  if (!owner) {
    throw new createError.NotFound('Owner not found');
  }
};

const assignOwner = async (db: Executor, branchId: string, ownerId: string | null) => {
  if (ownerId === null) {
    await db
      .updateTable('users')
      .set({ branch: null })
      .where('branch', '=', branchId)
      .where('role', '=', Roles.Owner)
      .execute();
    return;
  }

  await ensureOwnerExists(db, ownerId);

  // Reset existing owners
  await db
    .updateTable('users')
    .set({ branch: null })
    .where('branch', '=', branchId)
    .where('role', '=', Roles.Owner)
    .where('id', '!=', ownerId)
    .execute();

  await db
    .updateTable('users')
    .set({ branch: branchId })
    .where('id', '=', ownerId)
    .where('role', '=', Roles.Owner)
    .execute();
};

export interface ListBranchesInput {
  page: number;
  limit: number;
  sortField: 'createdAt' | 'name' | 'contact';
  sortOrder: OrderDirection;
  query?: string;
}

export const listBranches = async (input: ListBranchesInput) => {
  const db = await getDb();
  const page = input.page;
  const limit = input?.limit;
  const sortField = input.sortField;
  const sortOrder = input?.sortOrder;
  const searchQuery = input?.query;

  let query = selectBranchWithOwner(db);

  // Add search filter if query is provided
  if (searchQuery) {
    query = query.where((eb) =>
      eb.or([
        eb(`${BRANCH_TABLE}.name`, 'like', `%${searchQuery}%`),
        eb(`${BRANCH_TABLE}.contact`, 'like', `%${searchQuery}%`),
      ]),
    );
  }

  // Add sorting
  query = query.orderBy(sortField, sortOrder);

  // Add pagination
  const offset = page * limit;
  query = query.limit(limit).offset(offset);

  const rows = await query.execute();

  return rows.map((row) => mapBranchRow(row as BranchWithOwnerRow));
};

export const createBranch = async (input: NewBranch) => {
  const db = await getDb();

  return db.transaction().execute(async (trx) => {
    await ensureOwnerExists(trx, input.ownerId);

    const branchId = randomUUID();

    await trx
      .insertInto(BRANCH_TABLE)
      .values({
        id: branchId,
        name: input.name,
        contact: input.contact,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .execute();

    await assignOwner(trx, branchId, input.ownerId);
  });
};

export const updateBranch = async (branchId: string, input: UpdateBranch) => {
  const db = await getDb();

  return db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom(BRANCH_TABLE)
      .select(['id'])
      .where('id', '=', branchId)
      .executeTakeFirst();

    if (!existing) {
      return null;
    }

    const updatePayload: Record<string, string | null> = {};

    if (typeof input.name !== 'undefined') {
      updatePayload.name = input.name;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'contact')) {
      updatePayload.contact = input.contact ?? null;
    }

    if (Object.keys(updatePayload).length > 0) {
      await trx
        .updateTable(BRANCH_TABLE)
        .set({
          ...updatePayload,
          updatedAt: new Date(),
        })
        .where('id', '=', branchId)
        .execute();
    }

    if (Object.prototype.hasOwnProperty.call(input, 'ownerId')) {
      await assignOwner(trx, branchId, input.ownerId ?? null);
    }
  });
};

export const deleteBranch = async (branchId: string): Promise<boolean> => {
  const db = await getDb();

  return db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom(BRANCH_TABLE)
      .select(['id'])
      .where('id', '=', branchId)
      .executeTakeFirst();

    if (!existing) {
      return false;
    }

    await trx.updateTable('users').set({ branch: null }).where('branch', '=', branchId).execute();

    await trx.deleteFrom(BRANCH_TABLE).where('id', '=', branchId).execute();

    return true;
  });
};
