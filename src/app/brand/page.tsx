import { createClient } from "@/lib/supabase/server";

export default async function BrandHome() {
  const supabase = await createClient();

  // Scoped by RLS to the workspaces this session belongs to, so no explicit
  // workspace filter is needed or trusted here.
  const { data: campaigns, error } = await supabase
    .from("campaign")
    .select("id, name, status")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load campaigns: ${error.message}`);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
      {campaigns.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No campaigns yet, or this account is not a member of a workspace.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-md border border-border">
          {campaigns.map((campaign) => (
            <li key={campaign.id} className="flex items-center justify-between p-4">
              <span className="text-sm font-medium">{campaign.name}</span>
              <span className="text-xs text-muted-foreground">{campaign.status}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
