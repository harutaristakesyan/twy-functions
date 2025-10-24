// run-migrations.ts
import path from 'path';
import {getDb} from "@libs/db";
import {runMigrations} from "@libs/db/migration";

(async () => {
  let db;
  try {
    console.log('🔌 Connecting to DB...');
    db = await getDb();
    const sqlDir = path.join(__dirname, 'sql');

    await runMigrations(db, sqlDir);
    console.log('✅ All migrations complete!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    try {
      await db?.destroy?.();
    } catch {}
    process.exit(process.exitCode ?? 0);
  }
})();
