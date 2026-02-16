import Link from 'next/link';
import AccessibilityToggles from '@/components/AccessibilityToggles';

const links = [
  { href: '/', label: 'Home' },
  { href: '/onboarding', label: 'Onboarding' },
  { href: '/chat', label: 'Chat' },
  { href: '/checklist', label: 'Checklist' },
  { href: '/admin/content', label: 'Content' },
  { href: '/admin/config', label: 'Config' }
];

export default function Nav() {
  return (
    <nav className="flex flex-col gap-4 md:grid md:grid-cols-[auto,1fr,auto] md:items-center">
      <div>
        <span className="text-sm uppercase tracking-[0.3em] text-moss">Adrenal Nodule Clinic Navigator</span>
        <div className="font-serif text-2xl text-ink">Patient Guide</div>
      </div>
      <div className="flex flex-wrap gap-3 text-sm md:flex-nowrap md:justify-center">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-full border border-transparent bg-white/70 px-4 py-2 text-ink shadow-sm transition hover:border-moss hover:bg-white"
          >
            {link.label}
          </Link>
        ))}
      </div>
      <div className="flex md:justify-end">
        <AccessibilityToggles />
      </div>
    </nav>
  );
}
