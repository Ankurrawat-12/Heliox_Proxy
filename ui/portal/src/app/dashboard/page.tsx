'use client';

import { useQuery } from '@tanstack/react-query';
import { portalApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Activity,
  Zap,
  Key,
  Route,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  Clock,
} from 'lucide-react';
import Link from 'next/link';

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'indigo',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; label: string };
  color?: 'indigo' | 'green' | 'yellow' | 'red';
}) {
  const colors = {
    indigo: 'from-indigo-500 to-purple-500',
    green: 'from-green-500 to-emerald-500',
    yellow: 'from-yellow-500 to-orange-500',
    red: 'from-red-500 to-pink-500',
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
          {subtitle && <p className="text-sm text-zinc-500 mt-1">{subtitle}</p>}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp size={14} className="text-green-400" />
              <span className="text-sm text-green-400">+{trend.value}%</span>
              <span className="text-sm text-zinc-500">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center`}>
          <Icon className="text-white" size={24} />
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  title,
  description,
  href,
  icon: Icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:bg-zinc-800/50 hover:border-zinc-700 transition-all group"
    >
      <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
        <Icon size={20} className="text-zinc-400 group-hover:text-white" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <ArrowUpRight size={16} className="text-zinc-500 group-hover:text-white transition-colors" />
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: usage, isLoading } = useQuery({
    queryKey: ['usage'],
    queryFn: portalApi.getUsage,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: keys } = useQuery({
    queryKey: ['keys'],
    queryFn: portalApi.getApiKeys,
  });

  const { data: tenant } = useQuery({
    queryKey: ['tenant'],
    queryFn: portalApi.getTenant,
  });

  // Use values from usage response (backend returns daily_percent/monthly_percent)
  const dailyUsagePercent = usage?.daily_percent || 0;
  const monthlyUsagePercent = usage?.monthly_percent || 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {user?.name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-zinc-400 mt-1">
          Here's what's happening with your API gateway today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Requests Today"
          value={isLoading ? '...' : (usage?.daily_requests?.toLocaleString() || '0')}
          subtitle={`of ${usage?.daily_limit?.toLocaleString() || '1,000'} daily quota`}
          icon={Activity}
          color="indigo"
        />
        <StatCard
          title="Cache Hit Rate"
          value={isLoading ? '...' : `${Math.round((usage?.cache_hit_rate || 0) * 100)}%`}
          subtitle="Cache performance"
          icon={Zap}
          color="green"
        />
        <StatCard
          title="Avg Latency"
          value={isLoading ? '...' : `${(usage?.avg_latency_ms || 0).toFixed(0)}ms`}
          subtitle="Response time"
          icon={Clock}
          color="yellow"
        />
        <StatCard
          title="Error Rate"
          value={isLoading ? '...' : `${((usage?.error_rate || 0) * 100).toFixed(1)}%`}
          subtitle="In the last 24h"
          icon={AlertTriangle}
          color={(usage?.error_rate || 0) > 0.01 ? 'red' : 'green'}
        />
      </div>

      {/* Usage Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Daily Usage</h3>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-zinc-400">
              {usage?.daily_requests?.toLocaleString() || 0} / {usage?.daily_limit?.toLocaleString() || '1,000'}
            </span>
            <span className="text-zinc-400">{dailyUsagePercent.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                dailyUsagePercent > 90 ? 'bg-red-500' : dailyUsagePercent > 70 ? 'bg-yellow-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${dailyUsagePercent}%` }}
            />
          </div>
          {dailyUsagePercent > 80 && (
            <p className="text-sm text-yellow-400 mt-2 flex items-center gap-2">
              <AlertTriangle size={14} />
              You're approaching your daily limit
            </p>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Monthly Usage</h3>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-zinc-400">
              {usage?.monthly_requests?.toLocaleString() || 0} / {usage?.monthly_limit?.toLocaleString() || '10,000'}
            </span>
            <span className="text-zinc-400">{monthlyUsagePercent.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                monthlyUsagePercent > 90 ? 'bg-red-500' : monthlyUsagePercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${monthlyUsagePercent}%` }}
            />
          </div>
          {monthlyUsagePercent > 80 && (
            <Link href="/dashboard/billing" className="text-sm text-indigo-400 mt-2 inline-flex items-center gap-2 hover:text-indigo-300">
              Upgrade for more requests →
            </Link>
          )}
        </div>
      </div>

      {/* Quick Stats & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resource counts */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Resources</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <Key size={20} className="text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">API Keys</p>
                  <p className="text-xs text-zinc-500">{tenant?.api_key_count || 0} / {tenant?.max_api_keys || 2} keys</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-white">{keys?.length || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Route size={20} className="text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Routes</p>
                  <p className="text-xs text-zinc-500">{tenant?.route_count || 0} / {tenant?.max_routes || 5} routes</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-white">{tenant?.route_count || 0}</span>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="lg:col-span-2 card">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QuickAction
              title="Create API Key"
              description="Generate a new key"
              href="/dashboard/keys"
              icon={Key}
            />
            <QuickAction
              title="Add Route"
              description="Configure a new route"
              href="/dashboard/routes"
              icon={Route}
            />
            <QuickAction
              title="View Analytics"
              description="Check your metrics"
              href="/dashboard/analytics"
              icon={TrendingUp}
            />
            <QuickAction
              title="Upgrade Plan"
              description="Get more features"
              href="/dashboard/billing"
              icon={Zap}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
