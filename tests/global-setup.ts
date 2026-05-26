/**
 * Vitest global setup — push the Prisma schema to the test SQLite database
 * before any tests run, and clean up afterward.
 */
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const TEST_DB_RELATIVE = "prisma/test.db";

export function setup(): void {
  const dbPath = path.resolve(__dirname, "..", TEST_DB_RELATIVE);
  // Remove old test database so we start fresh
  try {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  } catch {
    // Ignore — file may not exist
  }
  try {
    // Also remove journal / WAL files
    const journalPath = dbPath + "-journal";
    const walPath = dbPath + "-wal";
    const shmPath = dbPath + "-shm";
    if (fs.existsSync(journalPath)) fs.unlinkSync(journalPath);
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  } catch {
    // Ignore
  }

  execSync("npx prisma db push --force-reset --skip-generate", {
    env: {
      ...process.env,
      DATABASE_URL: "file:./test.db",
    },
    cwd: path.resolve(__dirname, ".."),
    stdio: "pipe",
  });
}

export function teardown(): void {
  const dbPath = path.resolve(__dirname, "..", TEST_DB_RELATIVE);
  try {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  } catch {
    // Ignore
  }
}
