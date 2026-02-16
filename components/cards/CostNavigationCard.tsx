import CardFrame from '@/components/cards/CardFrame';
import { COST_NAVIGATION_LINKS } from '@/lib/config';

type ConfigLinks = {
  billing_phone?: string | null;
  scheduling_link?: string | null;
};

export default function CostNavigationCard({
  costTips,
  configLinks
}: {
  costTips: string[];
  configLinks?: ConfigLinks;
}) {
  const extraLinks = [
    configLinks?.billing_phone
      ? { label: 'Billing phone', href: `tel:${configLinks.billing_phone}` }
      : null,
    configLinks?.scheduling_link
      ? { label: 'Scheduling', href: configLinks.scheduling_link }
      : null
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <CardFrame title="Cost navigation" typeLabel="Cost navigation">
      {costTips.length > 0 && (
        <ul className="mb-4 list-disc pl-5">
          {costTips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-3">
        {COST_NAVIGATION_LINKS.length > 0 || extraLinks.length > 0 ? (
          [...extraLinks, ...COST_NAVIGATION_LINKS].map((link) => (
            <a
              key={link.label}
              href={link.href ?? '#'}
              className="rounded-full border border-moss px-4 py-2 text-xs font-semibold text-moss"
            >
              {link.label}
            </a>
          ))
        ) : (
          <span className="text-sm text-muted">
            Configure billing links with NEXT_PUBLIC_BILLING_URL or NEXT_PUBLIC_ESTIMATE_URL.
          </span>
        )}
      </div>
    </CardFrame>
  );
}
