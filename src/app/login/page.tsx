import { RETURN_TO_PARAM, safeReturnTo } from "@/lib/auth/roles";

import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const raw = params[RETURN_TO_PARAM];

  // The parameter arrives from the URL bar, so it is validated here as well as
  // in the action. Repeating a query key gives an array, which is never a path.
  const returnTo = safeReturnTo(typeof raw === "string" ? raw : null);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <LoginForm returnTo={returnTo} />
    </main>
  );
}
