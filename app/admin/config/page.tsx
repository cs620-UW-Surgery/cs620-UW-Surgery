'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'navigator_admin_token';

const DEFAULT_KEYS = [
  'billing_phone',
  'scheduling_link',
  'clinic_description',
  'what_to_bring',
  'emergency_guidance'
];

type ConfigItem = {
  key: string;
  value: string;
};

export default function AdminConfigPage() {
  const [token, setToken] = useState('');
  const [configs, setConfigs] = useState<ConfigItem[]>(
    DEFAULT_KEYS.map((key) => ({ key, value: '' }))
  );
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setToken(stored);
  }, []);

  const loadConfigs = async () => {
    try {
      const response = await fetch('/api/admin/config', {
        headers: { 'x-admin-token': token }
      });
      if (!response.ok) {
        setStatus('error');
        return;
      }
      const data = await response.json();
      const incoming = data.configs ?? [];
      const merged = DEFAULT_KEYS.map((key) => {
        const existing = incoming.find((item: ConfigItem) => item.key === key);
        return { key, value: existing?.value ?? '' };
      });
      setConfigs(merged);
      setStatus('idle');
    } catch (error) {
      console.error('Failed to load config', error);
      setStatus('error');
    }
  };

  useEffect(() => {
    if (token) {
      localStorage.setItem(STORAGE_KEY, token);
      loadConfigs();
    }
  }, [token]);

  const updateValue = (key: string, value: string) => {
    setConfigs((prev) => prev.map((item) => (item.key === key ? { ...item, value } : item)));
  };

  const handleSave = async () => {
    setStatus('saving');
    try {
      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token
        },
        body: JSON.stringify({ configs })
      });
      if (!response.ok) throw new Error('Save failed');
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 1500);
    } catch (error) {
      console.error('Failed to save config', error);
      setStatus('error');
    }
  };

  return (
    <div className="grid gap-8">
      <section className="card fade-in">
        <h1 className="font-serif text-3xl text-ink">Clinic Configuration</h1>
        <p className="mt-2 text-muted">
          Update clinic-specific content and links. Requires the admin token set in `ADMIN_TOKEN`.
        </p>
        <label className="mt-4 grid gap-2 text-sm">
          Admin token
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Enter token"
            className="w-full rounded-2xl border border-clay bg-white/80 px-4 py-3"
            type="password"
          />
        </label>
        <div className="mt-3 text-xs text-muted">
          Status: {status === 'idle' ? 'Ready' : status}
        </div>
      </section>

      <section className="card">
        <div className="grid gap-4">
          {configs.map((config) => (
            <label key={config.key} className="grid gap-2 text-sm">
              {config.key.replace(/_/g, ' ')}
              <textarea
                value={config.value}
                onChange={(event) => updateValue(config.key, event.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-clay bg-white/80 px-4 py-3"
              />
            </label>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={handleSave}
            className="rounded-full bg-moss px-6 py-2 text-xs font-semibold text-white"
          >
            Save changes
          </button>
          <button
            onClick={loadConfigs}
            className="rounded-full border border-moss px-6 py-2 text-xs font-semibold text-moss"
          >
            Refresh
          </button>
        </div>
      </section>
    </div>
  );
}
