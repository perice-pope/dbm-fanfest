import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const REF_COOKIE = "ff_ref";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  // Refreshes an expired session cookie; do not add logic between client creation and this call.
  await supabase.auth.getUser();

  const ref = request.nextUrl.searchParams.get("ref");
  if (ref && /^[a-z0-9]{4,32}$/i.test(ref)) {
    response.cookies.set(REF_COOKIE, ref.toLowerCase(), { maxAge: 30 * 24 * 3600, path: "/", sameSite: "lax", httpOnly: true });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
