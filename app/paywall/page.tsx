'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const features = [
  'Unlimited prop accounts',
  'Circuit breaker protection (50% + 80%)',
  'Full session analytics',
  'Trade journal with emotional tracking',
  'Rule adherence scoring',
  'Tradovate P&L integration (Chrome extension)',
  'AI-powered session reviews',
];

export default function PaywallPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStartTrial() {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' });
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      console.error('Checkout error:', err);
      setLoading(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a] flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl flex flex-col items-center gap-8 text-center">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#2dd4bf" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">PropGuard</span>
        </div>

        {/* Hero */}
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold text-white leading-tight">
            Your Trial Has Ended
          </h1>
          <p className="text-slate-400 text-base max-w-xl mx-auto">
            Subscribe to keep using PropGuard&apos;s circuit breaker protection.{' '}
            <span className="text-white font-medium">$19 AUD/month</span> — less than the
            cost of one revenge trade.
          </p>
        </div>

        {/* Price Card */}
        <div className="bg-[#111827] rounded-2xl p-8 border border-slate-800/50 mx-auto w-full max-w-sm flex flex-col gap-6">
          <div>
            <div className="text-xl font-bold text-white">PropGuard Pro</div>
            <div className="text-4xl font-bold text-teal-400 mt-2">$19 AUD/mo</div>
            <div className="text-sm text-slate-500 mt-1">
              Cancel anytime
            </div>
          </div>

          {/* Feature list */}
          <ul className="flex flex-col gap-2 text-left">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-teal-400 font-bold mt-0.5">✓</span>
                {feature}
              </li>
            ))}
          </ul>

          {/* CTA Button */}
          <button
            onClick={handleStartTrial}
            disabled={loading}
            className="bg-teal-500 hover:bg-teal-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors w-full py-3 text-lg font-semibold text-white rounded-xl"
          >
            {loading ? 'Redirecting…' : 'Subscribe Now'}
          </button>
        </div>

        {/* Bottom text */}
        <p className="text-slate-500 text-sm">
          Eval fees cost $600+. PropGuard costs $19.
        </p>

        <button
          onClick={handleSignOut}
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
