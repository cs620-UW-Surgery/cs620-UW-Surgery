import { prisma } from '@/lib/prisma';

export const APP_CONFIG_KEYS = [
  'billing_phone',
  'scheduling_link',
  'clinic_description',
  'what_to_bring',
  'emergency_guidance'
] as const;

export type AppConfigKey = (typeof APP_CONFIG_KEYS)[number];

export type AppConfigMap = Partial<Record<AppConfigKey, string>>;

export async function getAppConfigMap(): Promise<AppConfigMap> {
  if (!process.env.DATABASE_URL) return {};
  try {
    const entries = await prisma.appConfig.findMany({
      where: { key: { in: APP_CONFIG_KEYS as unknown as string[] } }
    });
    return entries.reduce<AppConfigMap>((acc, entry) => {
      acc[entry.key as AppConfigKey] = entry.value;
      return acc;
    }, {});
  } catch (error) {
    console.warn('Failed to load app config', error);
    return {};
  }
}

export function selectPublicConfig(config: AppConfigMap) {
  return {
    billing_phone: config.billing_phone ?? null,
    scheduling_link: config.scheduling_link ?? null,
    clinic_description: config.clinic_description ?? null,
    what_to_bring: config.what_to_bring ?? null,
    emergency_guidance: config.emergency_guidance ?? null
  };
}
