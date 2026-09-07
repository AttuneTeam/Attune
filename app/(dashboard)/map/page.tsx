import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { groupAreasByDomain } from "@/lib/map/grouping";
import { fetchMapAreas } from "@/lib/map/queries";

/**
 * The Surface Area Map.
 *
 * This page takes no params or searchParams, so there is nothing to await
 * beyond the Supabase client itself. Auth is redirected here as well as in the
 * dashboard layout: the layout guard is the one that runs, but a page that
 * reads a manager's own rows should not depend on a parent for that.
 *
 * The markup below is provisional — the domain groups and area rows are built
 * properly, against the manual UI checklist in workflow.md, in the next task.
 * It exists so the query and the grouping transform are proven end to end.
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
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="font-heading text-3xl tracking-tight">Map</h1>
        <p className="mt-6 text-sm text-muted-foreground">
          The map could not be loaded. Nothing has been changed.
        </p>
      </div>
    );
  }

  const groups = groupAreasByDomain(result.areas);

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="font-heading text-3xl tracking-tight">Map</h1>

      {groups.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No areas yet.
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {groups.map((group) => (
            <section key={group.domain ?? "ungrouped"}>
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
                {group.domain ?? "Ungrouped"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {group.summary.total} areas
                {group.summary.attention > 0
                  ? ` · ${group.summary.attention} worth a look`
                  : ""}
              </p>
              <ul className="mt-4 space-y-3">
                {group.roots.map((area) => (
                  <li key={area.id}>
                    <span className="text-sm">{area.title}</span>
                    <span className="ml-3 text-xs text-muted-foreground">
                      {area.confidence}
                      {area.owner ? ` · ${area.owner.name}` : " · unowned"}
                    </span>
                    {area.children.length > 0 && (
                      <ul className="mt-3 ml-6 space-y-3">
                        {area.children.map((child) => (
                          <li key={child.id}>
                            <span className="text-sm">{child.title}</span>
                            <span className="ml-3 text-xs text-muted-foreground">
                              {child.confidence}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
