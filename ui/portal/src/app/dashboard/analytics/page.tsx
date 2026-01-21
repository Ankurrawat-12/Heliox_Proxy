'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { portalApi } from '@/lib/api';
import {
  Activity,
  Zap,
  Clock,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  RefreshCw,
} from 'lucide-react';

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'indigo',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
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
          <p className="text-2xl font-bold text-white">{value}</p>
          {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center`}>
          <Icon className="text-white" size={20} />
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  const { data: usage, isLoading, refetch } = useQuery({
    queryKey: ['usage', timeRange],
    queryFn: portalApi.getUsage,
    refetchInterval: 30000,
  });

  const { data: logs } = useQuery({
    queryKey: ['logs'],
    queryFn: () => portalApi.getLogs({ page: 1, page_size: 10 }),
  });

  // Backend returns cache_hit_rate as a decimal (0-1)
  const cacheHitRate = Math.round((usage?.cache_hit_rate || 0) * 100);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-zinc-400 mt-1">Monitor your API usage and performance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            {(['24h', '7d', '30d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-indigo-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Requests"
              value={usage?.daily_requests?.toLocaleString() || '0'}
              subtitle="Today"
              icon={Activity}
              color="indigo"
            />
            <StatCard
              title="Cache Hit Rate"
              value={`${cacheHitRate}%`}
              subtitle="Cache performance"
              icon={Zap}
              color="green"
            />
            <StatCard
              title="Avg Latency"
              value={`${(usage?.avg_latency_ms || 0).toFixed(0)}ms`}
              subtitle="Response time"
              icon={Clock}
              color="yellow"
            />
            <StatCard
              title="Error Rate"
              value={`${((usage?.error_rate || 0) * 100).toFixed(1)}%`}
              subtitle="In the period"
              icon={AlertTriangle}
              color={(usage?.error_rate || 0) > 0.01 ? 'red' : 'green'}
            />
          </div>

          {/* Quota Usage */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp size={20} className="text-indigo-400" />
                <h2 className="text-lg font-semibold text-white">Daily Usage</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-zinc-400">
                      {usage?.daily_requests?.toLocaleString() || 0} / {usage?.daily_limit?.toLocaleString() || '1,000'} requests
                    </span>
                    <span className="text-zinc-400">
                      {(usage?.daily_percent || 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, usage?.daily_percent || 0)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-3 mb-4">
                <BarChart3 size={20} className="text-green-400" />
                <h2 className="text-lg font-semibold text-white">Monthly Usage</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-zinc-400">
                      {usage?.monthly_requests?.toLocaleString() || 0} / {usage?.monthly_limit?.toLocaleString() || '10,000'} requests
                    </span>
                    <span className="text-zinc-400">
                      {(usage?.monthly_percent || 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, usage?.monthly_percent || 0)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Requests */}
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Recent Requests</h2>
            {logs?.items && logs.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Time</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Method</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Path</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Latency</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Cache</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.items.map((log) => (
                      <tr key={log.id} className="border-b border-zinc-800/50">
                        <td className="py-3 px-4 text-sm text-zinc-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-sm font-medium ${
                            log.method === 'GET' ? 'text-green-400' :
                            log.method === 'POST' ? 'text-blue-400' :
                            log.method === 'PUT' ? 'text-yellow-400' :
                            log.method === 'DELETE' ? 'text-red-400' : 'text-zinc-400'
                          }`}>
                            {log.method}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-white font-mono">
                          {log.path}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            log.status_code < 300 ? 'bg-green-500/10 text-green-400' :
                            log.status_code < 400 ? 'bg-blue-500/10 text-blue-400' :
                            log.status_code < 500 ? 'bg-yellow-500/10 text-yellow-400' :
                            'bg-red-500/10 text-red-400'
                          }`}>
                            {log.status_code}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-zinc-400">
                          {log.latency_ms.toFixed(0)}ms
                        </td>
                        <td className="py-3 px-4">
                          {log.cache_status && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              log.cache_status === 'HIT' ? 'bg-green-500/10 text-green-400' :
                              log.cache_status === 'MISS' ? 'bg-yellow-500/10 text-yellow-400' :
                              'bg-zinc-500/10 text-zinc-400'
                            }`}>
                              {log.cache_status}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-400">
                No requests yet. Start making API calls to see analytics.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
