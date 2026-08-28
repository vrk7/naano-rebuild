import { ListSkeleton } from "@/components/ui/skeleton";
import { Page } from "@/components/ui/page";

export default function Loading() {
  return (
    <Page width="wide">
      <ListSkeleton />
    </Page>
  );
}
