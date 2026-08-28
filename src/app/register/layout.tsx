import Link from "next/link";

import { Wordmark } from "@/components/marketing/wordmark";

/**
 * The shell around the role picker and both its branches.
 *
 * The split is naano's (`recon/brand/01`) and it earns its place: the left half
 * asks one question, the right half says why there are two answers. Everything
 * else on that screen naano ships — the language switcher, the assistant bar —
 * is cut.
 */
export default function RegisterLayout({ children }: LayoutProps<"/register">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-10 sm:px-10">
        <Link href="/" className="self-start">
          <Wordmark />
        </Link>
        <div className="flex flex-1 items-center py-12">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>

      {/* The one full-bleed accent surface in the product. It is the front
          door, it appears once, and it is why the accent can stay scarce
          everywhere behind the login. */}
      <aside className="hidden bg-brand p-12 text-brand-foreground lg:flex lg:items-center">
        <div className="max-w-md">
          <p className="text-4xl font-semibold tracking-[-0.021em] text-balance">
            One platform. Two sides.
          </p>
          <p className="mt-5 text-lg text-pretty opacity-90">
            Creators get paid to post. Brands get a score they can argue with, and
            every reaction traced back to a person, a company and a match.
          </p>
        </div>
      </aside>
    </div>
  );
}
