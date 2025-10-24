import { getDb } from '@libs/db';

const tableName = 'users';

export const getFullUserInfoById = async (userId: string) => {
  const db = await getDb();

  return await db
    .selectFrom(tableName)
    .select([
      'users.email',
      'users.lastName',
      'users.firstName',
      'users.role',
      'users.isActive',
      'users.branch',
    ])
    .where('users.id', '=', userId)
    .executeTakeFirstOrThrow();
};
