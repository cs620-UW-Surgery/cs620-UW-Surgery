import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { APP_CONFIG_KEYS } from '@/lib/appConfig';

export const runtime = 'nodejs';

function isAuthorized(request: NextRequest) {
  const token = request.headers.get('x-admin-token');
  return token && process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ configs: [] });
  }

  const configs = await prisma.appConfig.findMany({
    where: { key: { in: APP_CONFIG_KEYS as unknown as string[] } },
    orderBy: { key: 'asc' }
  });

  return NextResponse.json({ configs });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 400 });
  }

  const body = await request.json();
  const configs = Array.isArray(body?.configs) ? body.configs : [];

  const updates = configs
    .filter((item: { key?: string }) => item?.key && APP_CONFIG_KEYS.includes(item.key))
    .map((item: { key: string; value: string }) =>
      prisma.appConfig.upsert({
        where: { key: item.key },
        update: { value: item.value },
        create: { key: item.key, value: item.value }
      })
    );

  await Promise.all(updates);

  return NextResponse.json({ status: 'ok' });
}
