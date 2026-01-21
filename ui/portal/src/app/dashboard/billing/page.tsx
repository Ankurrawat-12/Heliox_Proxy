'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { portalApi, paymentApi, Plan } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Check,
  Sparkles,
  Zap,
  Building2,
  CreditCard,
  ArrowRight,
} from 'lucide-react';

const TIER_ICONS = {
  free: Sparkles,
  pro: Zap,
  enterprise: Building2,
};

const TIER_COLORS = {
  free: 'from-zinc-500 to-zinc-600',
  pro: 'from-indigo-500 to-purple-500',
  enterprise: 'from-amber-500 to-orange-500',
};

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

function PlanCard({
  plan,
  currentPlanId,
  onSelect,
  loading,
}: {
  plan: Plan;
  currentPlanId: string | null;
  onSelect: (plan: Plan) => void;
  loading: boolean;
}) {
  const isCurrent = plan.id === currentPlanId;
  const Icon = TIER_ICONS[plan.tier as keyof typeof TIER_ICONS] || Sparkles;
  const gradientColor = TIER_COLORS[plan.tier as keyof typeof TIER_COLORS] || 'from-zinc-500 to-zinc-600';

  const features = [
    `${plan.quota_daily === 0 ? 'Unlimited' : plan.quota_daily.toLocaleString()} requests/day`,
    `${plan.quota_monthly === 0 ? 'Unlimited' : plan.quota_monthly.toLocaleString()} requests/month`,
    `${plan.max_api_keys === 0 ? 'Unlimited' : plan.max_api_keys} API keys`,
    `${plan.max_routes === 0 ? 'Unlimited' : plan.max_routes} routes`,
    plan.cache_enabled && 'Intelligent caching',
    plan.analytics_enabled && 'Advanced analytics',
    plan.priority_support && 'Priority support',
    plan.custom_domains && 'Custom domains',
  ].filter(Boolean);

  return (
    <div
      className={`relative rounded-2xl border p-6 transition-all ${
        isCurrent
          ? 'border-indigo-500 bg-indigo-500/5'
          : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
      }`}
    >
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-indigo-600 text-white text-xs font-medium px-3 py-1 rounded-full">
            Current Plan
          </span>
        </div>
      )}

      <div className="flex items-center gap-4 mb-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradientColor} flex items-center justify-center`}>
          <Icon className="text-white" size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">{plan.name}</h3>
          <p className="text-zinc-400 text-sm">{plan.description}</p>
        </div>
      </div>

      <div className="mb-6">
        <span className="text-4xl font-bold text-white">
          {plan.price_monthly_cents === 0 ? 'Free' : formatPrice(plan.price_monthly_cents)}
        </span>
        {plan.price_monthly_cents > 0 && (
          <span className="text-zinc-400">/month</span>
        )}
      </div>

      <ul className="space-y-3 mb-6">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center gap-3 text-sm">
            <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
              <Check size={12} className="text-green-400" />
            </div>
            <span className="text-zinc-300">{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => !isCurrent && onSelect(plan)}
        disabled={isCurrent || loading}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
          isCurrent
            ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
            : plan.tier === 'pro'
            ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
            : 'bg-zinc-800 hover:bg-zinc-700 text-white'
        }`}
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        ) : isCurrent ? (
          'Current Plan'
        ) : (
          <>
            {plan.price_monthly_cents === 0 ? 'Downgrade' : 'Upgrade'}
            <ArrowRight size={16} />
          </>
        )}
      </button>
    </div>
  );
}

export default function BillingPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: portalApi.getPlans,
  });

  const { data: tenant } = useQuery({
    queryKey: ['tenant'],
    queryFn: portalApi.getTenant,
  });

  const handleSelectPlan = async (plan: Plan) => {
    if (plan.price_monthly_cents === 0) {
      // Downgrade to free - just call API
      // TODO: Implement downgrade
      alert('Contact support to downgrade');
      return;
    }

    // For paid plans, initiate payment flow
    try {
      const order = await paymentApi.createOrder(plan.id);
      
      // Load Razorpay
      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'Heliox',
        description: `${order.plan_name} Plan`,
        order_id: order.order_id,
        handler: async function (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) {
          // Verify payment
          await paymentApi.verifyPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            plan_id: plan.id,
          });
          
          // Refresh tenant data
          queryClient.invalidateQueries({ queryKey: ['tenant'] });
          queryClient.invalidateQueries({ queryKey: ['usage'] });
        },
        prefill: {
          email: user?.email,
        },
        theme: {
          color: '#6366f1',
        },
      };

      // @ts-ignore - Razorpay is loaded via script
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error('Payment error:', error);
      alert('Failed to initiate payment. Please try again.');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Billing & Plans</h1>
        <p className="text-zinc-400 mt-1">
          Manage your subscription and billing details
        </p>
      </div>

      {/* Current Plan Info */}
      {tenant?.plan && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-400">Current Plan</p>
              <p className="text-xl font-bold text-white">{tenant.plan.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-zinc-400">Next billing date</p>
              <p className="text-white">Monthly renewal</p>
            </div>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Available Plans</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans?.filter(p => p.is_active).map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                currentPlanId={tenant?.plan?.id || null}
                onSelect={handleSelectPlan}
                loading={false}
              />
            ))}
          </div>
        )}
      </div>

      {/* Payment Methods */}
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Payment Method</h2>
        <div className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-lg">
          <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded flex items-center justify-center">
            <CreditCard className="text-white" size={20} />
          </div>
          <div className="flex-1">
            <p className="text-white font-medium">No payment method added</p>
            <p className="text-sm text-zinc-400">Add a card when you upgrade</p>
          </div>
        </div>
      </div>

      {/* Razorpay Script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />
    </div>
  );
}
