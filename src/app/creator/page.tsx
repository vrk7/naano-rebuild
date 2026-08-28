import { createClient } from "@/lib/supabase/server";

export default async function CreatorHome() {
  const supabase = await createClient();

  // RLS limits this to collaborations whose creator_id resolves to this
  // session, so a creator sees their own bookings and nothing else.
  const { data: collaborations, error } = await supabase
    .from("collaboration")
    .select("id, state, price_cents, post_by")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load collaborations: ${error.message}`);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Collaborations</h1>
      {collaborations.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nothing here yet. Collaborations appear once a brand books you.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-md border border-border">
          {collaborations.map((collaboration) => (
            <li key={collaboration.id} className="flex items-center justify-between p-4">
              <span className="text-sm font-medium">{collaboration.state}</span>
              <span className="text-xs text-muted-foreground">
                ${(collaboration.price_cents / 100).toFixed(0)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
