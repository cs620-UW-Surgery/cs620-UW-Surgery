import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const sessionCookie = request.cookies.get('session_id');

  if (!sessionCookie) {
    response.cookies.set('session_id', crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/'
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next|favicon.ico).*)']
};
