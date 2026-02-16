import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Fraunces, Manrope } from 'next/font/google';
import Nav from '@/components/Nav';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serum',
  display: 'swap'
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Adrenal Nodule Clinic Navigator',
  description: 'A patient-facing guide for incidental adrenal nodules.'
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable}`}>
      <body>
        <div className="page-shell">
          <header className="sticky top-0 z-40 border-b border-clay/40 bg-sand/85 backdrop-blur">
            <div className="container-shell py-4 md:py-5">
              <Nav />
            </div>
          </header>
          <main className="flex-1">
            <div className="container-shell">{children}</div>
          </main>
          <footer className="container-shell text-sm text-muted">
            <div className="card">
              <div className="flex flex-col gap-2">
                <div className="badge">Medical Disclaimer</div>
                <p>
                  This tool provides general education and navigation support. It does not diagnose,
                  provide individualized medical decisions, recommend medication changes, or replace care
                  from your clinicians.
                </p>
                <p>
                  If you have severe symptoms, chest pain, difficulty breathing, fainting, or thoughts of
                  self-harm, seek emergency care immediately.
                </p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
