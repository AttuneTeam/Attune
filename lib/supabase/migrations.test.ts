import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Static guard for "permission denied for table".
 *
 * The local Supabase stack grants new tables to the API roles through default
 * privileges; the hosted project does not. A table without an explicit GRANT
 * therefore works in every local test and fails only in production (039 and
 * 049 both exist because of this). So every CREATE TABLE must be covered by a
 * GRANT to authenticated in the same or a later migration.
 */

const dir = join(process.cwd(), "supabase", "migrations");

const migrations = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((file) => ({
    file,
    // Drop line comments so prose mentioning GRANT or CREATE TABLE is ignored.
    sql: readFileSync(join(dir, file), "utf8").replace(/--.*$/gm, ""),
  }));

const createTable =
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi;
const grantOnTable =
  /grant\s+[\w\s,]+?\s+on\s+(?:table\s+)?([\w\s,."]+?)\s+to\s+([\w\s,]+)/gi;
const grantAllTables =
  /grant\s+[\w\s,]+?\s+on\s+all\s+tables\s+in\s+schema\s+public\s+to\s+([\w\s,]+)/i;

function grantsAuthenticated(roles: string) {
  return /\bauthenticated\b/i.test(roles);
}

describe("migrations", () => {
  it("grant every new table to the API roles", () => {
    const ungranted: string[] = [];

    migrations.forEach(({ file, sql }, index) => {
      for (const [, table] of sql.matchAll(createTable)) {
        const later = migrations.slice(index);
        const covered = later.some(({ file: grantFile, sql: grantSql }) => {
          // A blanket grant covers only tables that exist when it runs.
          const blanket = grantSql.match(grantAllTables);
          if (blanket && grantFile !== file && grantsAuthenticated(blanket[1])) {
            return true;
          }
          for (const [, targets, roles] of grantSql.matchAll(grantOnTable)) {
            const names = targets
              .split(",")
              .map((t) => t.trim().replace(/^public\./, "").replace(/"/g, ""));
            if (names.includes(table) && grantsAuthenticated(roles)) return true;
          }
          return false;
        });
        if (!covered) ungranted.push(`${file}: ${table}`);
      }
    });

    expect(
      ungranted,
      "Add `GRANT ALL ON TABLE <name> TO anon, authenticated, service_role;` " +
        "in the migration that creates the table",
    ).toEqual([]);
  });
});
