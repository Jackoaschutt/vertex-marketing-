'use client';

import { useState } from 'react';
import Link from 'next/link';

const features = [
  'Unlimited prop accounts',
  'Circuit breaker protection (50% + 80%)',
  'Full session analytics',
  'Trade journal with emotional tracking',
  'Rule adherence scoring',
  'Tradovate P&L integration (Chrome extension)',
];

export default function PaywallPage() {
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

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl flex flex-col items-center gap-8 text-center">
        {/* Logo */}
        <div className="text-sky-400 text-2xl font-bold tracking-tight">
          🛡 PropGuard
        </div>

        {/* Hero */}
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold text-white leading-tight">
            Stop Losing Funded Accounts to Emotions
          </h1>
          <p className="text-zinc-400 text-base max-w-xl mx-auto">
            PropGuard forces you to pause before you blow your daily loss limit.{' '}
            <span className="text-white font-medium">$19 AUD/month</span> — less than the
            cost of one revenge trade.
          </p>
        </div>

        {/* Price Card */}
        <div className="bg-zinc-800 rounded-2xl p-8 border border-zinc-600 mx-auto w-full max-w-sm flex flex-col gap-6">
          <div>
            <div className="text-xl font-bold text-white">PropGuard Pro</div>
            <div className="text-4xl font-bold text-sky-400 mt-2">$19 AUD/mo</div>
            <div className="text-sm text-zinc-400 mt-1">
              7-day free trial — no charge until trial ends
            </div>
          </div>

          {/* Feature list */}
          <ul className="flex flex-col gap-2 text-left">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-zinc-200">
                <span className="text-green-400 font-bold mt-0.5">✓</span>
                {feature}
              </li>
            ))}
          </ul>

          {/* CTA Button */}
          <button
            onClick={handleStartTrial}
            disabled={loading}
            className="bg-sky-600 hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors w-full py-3 text-lg font-semibold text-white rounded-xl"
          >
            {loading ? 'Redirecting...' : 'Start Free Trial'}
          </button>

          {/* Sign in link */}
          <div className="text-sm text-zinc-400">
            Already have an account?{' '}
            <Link href="/login" className="text-sky-400 hover:text-sky-300 underline">
              Sign in
            </Link>
          </div>
        </div>

        {/* Bottom text */}
        <p className="text-zinc-500 text-sm">
          Cancel anytime. Eval fees cost $600+. PropGuard costs $19.
        </p>
      </div>
    </div>
  );
}
