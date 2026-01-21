'use client';

import { useQuery } from '@tanstack/react-query';
import { portalApi } from '@/lib/api';
import { Route as RouteIcon, Info } from 'lucide-react';

export default function RoutesPage() {
  const { data: tenant } = useQuery({
    queryKey: ['tenant'],
    queryFn: portalApi.getTenant,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Routes</h1>
        <p className="text-zinc-400 mt-1">
          API routes and endpoint configuration
        </p>
      </div>

      {/* Info Card */}
      <div className="card">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
            <Info size={24} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Routes are managed centrally</h2>
            <p className="text-zinc-400 mb-4">
              Your API routes are configured and managed by Heliox administrators. This ensures 
              optimal performance, security, and reliability for your API gateway.
            </p>
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-400">Routes in your plan</span>
                <span className="text-white font-medium">
                  {tenant?.route_count || 0} / {tenant?.max_routes || 5}
                </span>
              </div>
              <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{
                    width: `${((tenant?.route_count || 0) / (tenant?.max_routes || 5)) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* What routes do */}
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">What are routes?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
              <RouteIcon size={16} className="text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Path Matching</p>
              <p className="text-xs text-zinc-500">Routes define which URLs are proxied through your gateway</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <RouteIcon size={16} className="text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Upstream Services</p>
              <p className="text-xs text-zinc-500">Each route points to your backend API servers</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
              <RouteIcon size={16} className="text-yellow-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Caching Rules</p>
              <p className="text-xs text-zinc-500">Routes can have specific caching policies applied</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              <RouteIcon size={16} className="text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Method Filtering</p>
              <p className="text-xs text-zinc-500">Control which HTTP methods (GET, POST, etc.) are allowed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact support */}
      <div className="text-center text-zinc-500 text-sm">
        Need to add or modify routes?{' '}
        <a href="mailto:support@heliox.dev" className="text-indigo-400 hover:text-indigo-300">
          Contact support
        </a>
      </div>
    </div>
  );
}
