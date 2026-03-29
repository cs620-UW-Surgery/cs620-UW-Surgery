'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'navigator_pii_acknowledged';

export default function PiiWarningModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const acknowledged = sessionStorage.getItem(STORAGE_KEY);
    if (!acknowledged) {
      setVisible(true);
    }
  }, []);

  const handleAcknowledge = () => {
    sessionStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 max-w-lg rounded-2xl bg-white p-8 shadow-lg">
        <h2 className="font-serif text-2xl text-uwred">Important Notice</h2>
        <div className="mt-4 space-y-3 text-sm text-darkgray">
          <p>
            <strong>Do not enter personally identifiable information</strong> such as
            your full name, date of birth, Social Security number, insurance ID,
            or medical record number.
          </p>
          <p>
            Your chat history is being <strong>recorded and saved</strong> for
            quality improvement and research purposes. All conversations are
            stored on our servers.
          </p>
          <p>
            This tool is for educational purposes only and does not replace
            medical advice from your clinician.
          </p>
        </div>
        <button
          onClick={handleAcknowledge}
          className="mt-6 w-full rounded-full bg-uwred px-6 py-3 text-sm font-semibold text-white transition hover:bg-uwdarkred"
        >
          I understand, continue
        </button>
      </div>
    </div>
  );
}
