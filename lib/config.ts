export const COST_NAVIGATION_LINKS = [
  {
    label: 'Billing office',
    href: process.env.NEXT_PUBLIC_BILLING_URL ?? null
  },
  {
    label: 'Estimate tool',
    href: process.env.NEXT_PUBLIC_ESTIMATE_URL ?? null
  },
  {
    label: 'Scheduling',
    href: process.env.NEXT_PUBLIC_SCHEDULING_URL ?? null
  }
].filter((item) => item.href);
