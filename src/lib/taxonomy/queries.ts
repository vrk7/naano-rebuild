/**
 * The `topic` table, which is the vocabulary both sides of the score are
 * written against (PRODUCT.md, "One taxonomy").
 *
 * One loader, shared. The marketplace needs it to turn stored values back into
 * English and the ICP editor needs it to offer the chips; two copies of the
 * query would be two chances for the two screens to be looking at different
 * vocabularies.
 */

import { createClient } from "@/lib/supabase/server";
import type { TopicRow } from "@/lib/score/labels";

export async function loadTopics(): Promise<TopicRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("topic")
    .select("id, slug, label, kind")
    .order("label", { ascending: true });

  if (error) throw new Error(`Could not load topics: ${error.message}`);
  if (!data) throw new Error("Topic query returned no data");

  return data as TopicRow[];
}
