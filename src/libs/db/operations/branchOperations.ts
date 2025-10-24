import { randomUUID } from 'node:crypto';
import createError from 'http-errors';
import { Database, getDb } from '@libs/db';
import { Kysely, Transaction } from 'kysely';

export interface BranchOwnerRecord {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface BranchRecord {
  id: string;
  name: string;
  contact: string | null;
  owner: BranchOwnerRecord | null;
}

interface BranchWithOwnerRow {
  id: string;
  name: string;
  contact: string | null;
  ownerId: string | null;
  ownerEmail: string | null;
  ownerFirstName: string | null;
  ownerLastName: string | null;
}

type Executor = Kysely<Database> | Transaction<Database>;

const BRANCH_TABLE = 'branch';
const OWNER_ALIAS = 'users as owner';

const selectBranchWithOwner = (db: Executor) =>
  db
    .selectFrom(BRANCH_TABLE)
    .leftJoin(OWNER_ALIAS, 'owner.branch', `${BRANCH_TABLE}.id`)
    .select([
      `${BRANCH_TABLE}.id as id`,
      `${BRANCH_TABLE}.name as name`,
      `${BRANCH_TABLE}.contact as contact`,
      'owner.id as ownerId',
      'owner.email as ownerEmail',
      'owner.firstName as ownerFirstName',
      'owner.lastName as ownerLastName',
    ]);

const mapBranchRow = (row: BranchWithOwnerRow): BranchRecord => ({
  id: row.id,
  name: row.name,
  contact: row.contact,
  owner: row.ownerId
    ? {
        id: row.ownerId,
        email: row.ownerEmail ?? '',
        firstName: row.ownerFirstName,
        lastName: row.ownerLastName,
      }
    : null,
});

const fetchBranchById = async (db: Executor, branchId: string): Promise<BranchRecord | null> => {
  const row = await selectBranchWithOwner(db).where(`${BRANCH_TABLE}.id`, '=', branchId).executeTakeFirst();

  return row ? mapBranchRow(row as BranchWithOwnerRow) : null;
};

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

const assignOwner = async (db: Executor, branchId: string, ownerId: string | null): Promise<void> => {
  if (ownerId === null) {
    await db.updateTable('users').set({ branch: null }).where('branch', '=', branchId).execute();
    return;
  }

  await ensureOwnerExists(db, ownerId);

  await db
    .updateTable('users')
    .set({ branch: null })
    .where('branch', '=', branchId)
    .where('id', '!=', ownerId)
    .execute();

  await db
    .updateTable('users')
    .set({ branch: branchId })
    .where('id', '=', ownerId)
    .execute();
};

export const listBranches = async (): Promise<BranchRecord[]> => {
  const db = await getDb();
  const rows = await selectBranchWithOwner(db).execute();

  return rows.map((row) => mapBranchRow(row as BranchWithOwnerRow));
};

interface CreateBranchInput {
  name: string;
  ownerId: string;
  contact?: string | null;
}

export const createBranch = async (input: CreateBranchInput): Promise<BranchRecord> => {
  const db = await getDb();

  return db.transaction().execute(async (trx) => {
    await ensureOwnerExists(trx, input.ownerId);

    const branchId = randomUUID();

    await trx
      .insertInto(BRANCH_TABLE)
      .values({
        id: branchId,
        name: input.name,
        contact: input.contact ?? null,
      })
      .execute();

    await assignOwner(trx, branchId, input.ownerId);

    const branch = await fetchBranchById(trx, branchId);

    if (!branch) {
      throw new createError.InternalServerError('Failed to create branch');
    }

    return branch;
  });
};

interface UpdateBranchInput {
  name?: string;
  contact?: string | null;
  ownerId?: string | null;
}

export const updateBranch = async (
  branchId: string,
  input: UpdateBranchInput,
): Promise<BranchRecord | null> => {
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
      await trx.updateTable(BRANCH_TABLE).set(updatePayload).where('id', '=', branchId).execute();
    }

    if (Object.prototype.hasOwnProperty.call(input, 'ownerId')) {
      await assignOwner(trx, branchId, input.ownerId ?? null);
    }

    return fetchBranchById(trx, branchId);
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
