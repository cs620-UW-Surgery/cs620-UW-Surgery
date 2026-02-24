import { NextResponse } from 'next/server';
import { getAppConfigMap, selectPublicConfig } from '@/lib/appConfig';

export const runtime = 'nodejs';

export async function GET() {
  const config = await getAppConfigMap();
  return NextResponse.json({ config: selectPublicConfig(config) });
}
