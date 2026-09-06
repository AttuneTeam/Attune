import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Two-tenant harness for Row-Level Security tests.
 *
 * TeamLeader is multi-tenant commercial SaaS: every table must isolate one
 * manager's data from another's at the database layer. These tests are the only
 * thing that proves it — manual testing is always performed as a single logged-in
 * user, so a tenant leak is invisible to it.
 *
 * CRITICAL RULE: every assertion runs through a client built with the ANON key
 * carrying a real user session. The service-role key bypasses RLS entirely, so
 * using it for assertions would make every isolation test pass vacuously. It is
 * used here for exactly one thing — deleting auth users during teardown, which
 * the anon key cannot do.
 */

type StackConfig = { url: string; anonKey: string; serviceKey: string };

let cachedConfig: StackConfig | null = null;

/**
 * Reads credentials from the running local stack rather than hardcoding them.
 * Env vars win when set, so this can be pointed at a throwaway CI database later.
 */
function readStackConfig(): StackConfig {
  if (cachedConfig) return cachedConfig;

  const fromEnv = {
    url: process.env.SUPABASE_TEST_URL,
    anonKey: process.env.SUPABASE_TEST_ANON_KEY,
    serviceKey: process.env.SUPABASE_TEST_SERVICE_ROLE_KEY,
  };
  if (fromEnv.url && fromEnv.anonKey && fromEnv.serviceKey) {
    cachedConfig = fromEnv as StackConfig;
    return cachedConfig;
  }

  const raw = execFileSync("supabase", ["status", "-o", "env"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  const read = (key: string): string => {
    const match = raw.match(new RegExp(`^${key}="(.*)"$`, "m"));
    if (!match) throw new Error(`supabase status did not report ${key}`);
    return match[1];
  };

  cachedConfig = {
    url: read("API_URL"),
    anonKey: read("ANON_KEY"),
    serviceKey: read("SERVICE_ROLE_KEY"),
  };
  return cachedConfig;
}

/** True when a local stack is reachable, so suites can skip instead of erroring. */
export function isStackAvailable(): boolean {
  try {
    readStackConfig();
    return true;
  } catch {
    return false;
  }
}

export const SKIP_MESSAGE =
  "Local Supabase stack not reachable — run `supabase start` to execute RLS tests.";

export type TenantSeed = {
  teamId: string;
  memberId: string;
  interactionId: string;
  actionItemId: string;
  initiativeId: string;
};

export type Tenant = {
  label: string;
  email: string;
  userId: string;
  /** Anon-key client carrying this manager's session. Use for ALL assertions. */
  client: SupabaseClient;
  seed: TenantSeed;
  usesAnonKey: boolean;
  destroy: () => Promise<void>;
};

function adminClient(): SupabaseClient {
  const { url, serviceKey } = readStackConfig();
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Creates one isolated manager: a real auth user, an anon client holding their
 * session, and a full set of rows they own.
 */
export async function createTenant(label: string): Promise<Tenant> {
  const { url, anonKey } = readStackConfig();
  // Unique per run so repeated runs never collide on the email unique index.
  const email = `rls-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = "test-password-not-a-secret";

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Sign-up via the anon key, not the admin API: this yields a genuine end-user
  // session, which is the only thing RLS assertions may run through.
  const { data: signUp, error: signUpError } = await client.auth.signUp({
    email,
    password,
  });
  if (signUpError) throw new Error(`signUp failed for ${label}: ${signUpError.message}`);

  const userId = signUp.user?.id;
  if (!userId) throw new Error(`signUp for ${label} returned no user`);
  if (!signUp.session) {
    throw new Error(
      `signUp for ${label} returned no session — is enable_confirmations false in supabase/config.toml?`,
    );
  }

  // The on_auth_user_created trigger inserts the profiles row for us.
  const seed = await seedTenant(client, userId, label);

  return {
    label,
    email,
    userId,
    client,
    seed,
    usesAnonKey: true,
    destroy: async () => {
      // Owned rows cascade from the auth user; deleting the user needs admin.
      await adminClient().auth.admin.deleteUser(userId);
    },
  };
}

/** Inserts one row in each tenant-scoped table, through the manager's own client. */
async function seedTenant(
  client: SupabaseClient,
  userId: string,
  label: string,
): Promise<TenantSeed> {
  const team = await insertOne(client, "teams", {
    name: `Team ${label}`,
    manager_id: userId,
  });

  const member = await insertOne(client, "team_members", {
    manager_id: userId,
    team_id: team.id,
    name: `Member ${label}`,
  });

  const interaction = await insertOne(client, "interactions", {
    manager_id: userId,
    participant_id: member.id,
  });

  const actionItem = await insertOne(client, "action_items", {
    interaction_id: interaction.id,
    user_id: userId,
    description: `Action for ${label}`,
  });

  const initiative = await insertOne(client, "strategic_initiatives", {
    manager_id: userId,
    title: `Initiative ${label}`,
  });

  return {
    teamId: team.id,
    memberId: member.id,
    interactionId: interaction.id,
    actionItemId: actionItem.id,
    initiativeId: initiative.id,
  };
}

async function insertOne(
  client: SupabaseClient,
  table: string,
  row: Record<string, unknown>,
): Promise<{ id: string }> {
  const { data, error } = await client.from(table).insert(row).select("id").single();
  if (error) throw new Error(`seeding ${table} failed: ${error.message}`);
  return data as { id: string };
}
