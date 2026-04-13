import Link from 'next/link';
import AccessibilityToggles from '@/components/AccessibilityToggles';

const links = [
  { href: '/chat#chat', label: 'Chat' }
  // { href: '/checklist', label: 'Checklist' },
  // { href: '/admin/content', label: 'Content' },
  // { href: '/admin/config', label: 'Config' }
];

const resourceLinks = [
  {
    href: 'https://www.uwhealth.org/treatments/endocrine-surgery',
    label: 'UW Endocrine Surgery page'
  },
  {
    href: 'https://www.uwhealth.org/laboratory-services#2aKcLLILK6b8Y2Q4UThgDL',
    label: 'UW Laboratory Services'
  },
  {
    href: 'https://uwmadison.box.com/s/w0da2w6qatji0qrusm84sbt2j9isw17g',
    label: 'FINAL Adrenal Nodual Workflow Flyer (PDF)'
  }
];

export default function Nav() {
  return (
    <nav className="flex flex-col gap-4 md:grid md:grid-cols-[auto,1fr,auto] md:items-center">
      <Link href="/chat">
        <span className="text-sm uppercase tracking-[0.3em] text-uwred">Adrenal Nodule Clinic Navigator</span>
        <div className="font-serif text-2xl text-darkgray">Patient Guide</div>
      </Link>
      <div className="flex flex-wrap gap-3 text-sm md:flex-nowrap md:justify-center">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-full border border-transparent bg-white/70 px-4 py-2 text-darkgray shadow-sm transition hover:border-uwred hover:bg-white"
          >
            {link.label}
          </Link>
        ))}
        <div className="group relative pt-2 -mt-2">
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-transparent bg-white/70 px-4 py-2 text-darkgray shadow-sm transition hover:border-uwred hover:bg-white"
          >
            Resources
            <span className="ml-2 text-xs text-darkgray/70">▼</span>
          </button>
          <div className="invisible absolute left-0 top-full z-20 w-72 rounded-2xl border border-gray-200 bg-white/95 p-2 text-sm shadow-lg opacity-0 transition pointer-events-none group-hover:visible group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
            {resourceLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl px-3 py-2 text-darkgray transition hover:bg-uwred/10 hover:text-uwred"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="flex md:justify-end">
        <AccessibilityToggles />
      </div>
    </nav>
  );
}
