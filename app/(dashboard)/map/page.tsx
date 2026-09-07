import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { groupAreasByDomain } from "@/lib/map/grouping";
import { fetchMapAreas } from "@/lib/map/queries";
import { SurfaceAreaMapClient } from "@/components/map/SurfaceAreaMapClient";
import {
  COLLAPSED_DOMAINS_COOKIE,
  parseCollapsedDomains,
} from "@/lib/map/collapse";

/**
 * The Surface Area Map.
 *
 * This page takes no params or searchParams, so there is nothing to await
 * beyond the Supabase client itself. Auth is redirected here as well as in the
 * dashboard layout: the layout guard is the one that runs, but a page that
 * reads a manager's own rows should not depend on a parent for that.
 */
export default async function MapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await fetchMapAreas(supabase, user.id);

  // An empty map and a map that failed to load must not look the same.
  if (!result.ok) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10 sm:px-8 sm:py-14">
        <h1 className="font-heading text-3xl tracking-tight sm:text-4xl">Map</h1>
        <p className="mt-6 text-sm text-muted-foreground">
          The map could not be loaded. Nothing has been changed.
        </p>
      </div>
    );
  }

  // Read server-side so collapsed domains are correct on first paint. Reading
  // it after hydration would show everything expanded and then snap it shut.
  const cookieStore = await cookies();
  const collapsed = parseCollapsedDomains(
    cookieStore.get(COLLAPSED_DOMAINS_COOKIE)?.value,
  );

  return (
    <SurfaceAreaMapClient
      groups={groupAreasByDomain(result.areas)}
      initialCollapsed={[...collapsed]}
    />
  );
}
