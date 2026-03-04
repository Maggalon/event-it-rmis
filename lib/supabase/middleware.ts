import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // IMPORTANT: DO NOT use getSession() here.
    // getUser() sends a request to the Supabase Auth server every time
    // to revalidate the Auth token, making it safe for server-side use.
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Define public routes that don't require authentication
    const publicRoutes = ['/login', '/auth/confirm', '/auth/callback'];
    const isPublicRoute = publicRoutes.some((route) =>
        request.nextUrl.pathname.startsWith(route)
    );

    if (!user && !isPublicRoute) {
        // No user and trying to access protected route — redirect to login
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    // NOTE: We intentionally do NOT redirect authenticated users away from /login here.
    // The login page component handles this redirect itself, which avoids a loop
    // when the protected layout can't find a profile and tries to redirect back.

    return supabaseResponse;
}
