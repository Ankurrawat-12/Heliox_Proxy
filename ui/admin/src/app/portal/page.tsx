'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuth, portalApi } from '@/lib/auth'
import { Key, Activity, Zap, TrendingUp, Plus, Copy, Check, Trash2, LogOut, Settings } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'

export default function PortalPage() {
  const router = useRouter()
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [newKeyName, setNewKeyName] = useState('')
  const [showNewKeyModal, setShowNewKeyModal] = useState(false)
  const [newKey, setNewKey] = useState<any>(null)

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  const { data: tenant } = useQuery({
    queryKey: ['portal-tenant'],
    queryFn: portalApi.getTenant,
    enabled: isAuthenticated,
  })

  const { data: usage } = useQuery({
    queryKey: ['portal-usage'],
    queryFn: portalApi.getUsage,
    enabled: isAuthenticated,
  })

  const { data: keys, refetch: refetchKeys } = useQuery({
    queryKey: ['portal-keys'],
    queryFn: portalApi.getKeys,
    enabled: isAuthenticated,
  })

  const { data: plans } = useQuery({
    queryKey: ['portal-plans'],
    queryFn: portalApi.getPlans,
    enabled: isAuthenticated,
  })

  const handleCopyKey = async (keyPrefix: string) => {
    await navigator.clipboard.writeText(keyPrefix)
    setCopiedKey(keyPrefix)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleCreateKey = async () => {
    if (!newKeyName) return
    try {
      const key = await portalApi.createKey(newKeyName)
      setNewKey(key)
      setNewKeyName('')
      refetchKeys()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return
    try {
      await portalApi.deleteKey(id)
      refetchKeys()
    } catch (err: any) {
      alert(err.message)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">H</span>
              </div>
              <span className="font-semibold text-white">Heliox</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">{tenant?.name || 'Portal'}</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-slate-400 text-sm">{user?.email}</span>
              {user?.role === 'admin' && (
                <Link
                  href="/"
                  className="text-indigo-400 hover:text-indigo-300 text-sm flex items-center"
                >
                  <Settings className="w-4 h-4 mr-1" />
                  Admin
                </Link>
              )}
              <button
                onClick={logout}
                className="text-slate-400 hover:text-white flex items-center text-sm"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Welcome back, {user?.name}!</h1>
          <p className="text-slate-400 mt-1">
            Plan: <span className="text-indigo-400 font-medium">{tenant?.plan_name || 'Free'}</span>
          </p>
        </div>

        {/* Usage Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Daily Usage</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {usage?.daily_requests?.toLocaleString() || 0}
                </p>
                <p className="text-slate-500 text-sm">
                  / {usage?.daily_limit === 0 ? '∞' : usage?.daily_limit?.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-indigo-600/20 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-indigo-400" />
              </div>
            </div>
            {usage?.daily_limit > 0 && (
              <div className="mt-4">
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all"
                    style={{ width: `${Math.min(usage?.daily_percent || 0, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Monthly Usage</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {usage?.monthly_requests?.toLocaleString() || 0}
                </p>
                <p className="text-slate-500 text-sm">
                  / {usage?.monthly_limit === 0 ? '∞' : usage?.monthly_limit?.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-600/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
            {usage?.monthly_limit > 0 && (
              <div className="mt-4">
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all"
                    style={{ width: `${Math.min(usage?.monthly_percent || 0, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Cache Hit Rate</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {((usage?.cache_hit_rate || 0) * 100).toFixed(1)}%
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-600/20 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Avg Latency</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {(usage?.avg_latency_ms || 0).toFixed(0)}ms
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* API Keys */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 mb-8">
          <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">API Keys</h2>
              <p className="text-slate-400 text-sm">
                {keys?.length || 0} / {tenant?.max_api_keys === 0 ? '∞' : tenant?.max_api_keys} keys
              </p>
            </div>
            <button
              onClick={() => setShowNewKeyModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center space-x-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>New Key</span>
            </button>
          </div>
          <div className="divide-y divide-slate-700">
            {keys?.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Key className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No API keys yet</p>
                <p className="text-slate-500 text-sm">Create your first key to get started</p>
              </div>
            ) : (
              keys?.map((key: any) => (
                <div key={key.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{key.name}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <code className="text-slate-400 text-sm bg-slate-900 px-2 py-1 rounded">
                        {key.key_prefix}...
                      </code>
                      <button
                        onClick={() => handleCopyKey(key.key_prefix)}
                        className="text-slate-500 hover:text-white transition"
                      >
                        {copiedKey === key.key_prefix ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      key.status === 'active' 
                        ? 'bg-emerald-600/20 text-emerald-400' 
                        : 'bg-red-600/20 text-red-400'
                    }`}>
                      {key.status}
                    </span>
                    <button
                      onClick={() => handleDeleteKey(key.id)}
                      className="text-slate-500 hover:text-red-400 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Plans */}
        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Available Plans</h2>
            <p className="text-slate-400 text-sm">Upgrade to unlock more features</p>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans?.map((plan: any) => (
              <div
                key={plan.id}
                className={`rounded-xl p-6 border ${
                  plan.is_current
                    ? 'border-indigo-500 bg-indigo-600/10'
                    : 'border-slate-700 bg-slate-900/50'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                  {plan.is_current && (
                    <span className="px-2 py-1 bg-indigo-600 text-white text-xs rounded-full">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-3xl font-bold text-white mb-1">
                  ${(plan.price_monthly_cents / 100).toFixed(0)}
                  <span className="text-slate-400 text-sm font-normal">/mo</span>
                </p>
                <p className="text-slate-400 text-sm mb-4">{plan.description}</p>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li>• {plan.quota_daily === 0 ? 'Unlimited' : plan.quota_daily.toLocaleString()} req/day</li>
                  <li>• {plan.rate_limit_rps} requests/sec</li>
                  <li>• {plan.max_api_keys === 0 ? 'Unlimited' : plan.max_api_keys} API keys</li>
                  {plan.analytics_enabled && <li>• Analytics dashboard</li>}
                  {plan.priority_support && <li>• Priority support</li>}
                </ul>
                {!plan.is_current && plan.price_monthly_cents > 0 && (
                  <button className="w-full mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition">
                    Upgrade
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* New Key Modal */}
      {showNewKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
            {newKey ? (
              <>
                <h3 className="text-lg font-semibold text-white mb-4">API Key Created!</h3>
                <div className="bg-slate-900 rounded-lg p-4 mb-4">
                  <p className="text-slate-400 text-sm mb-2">Save this key - you won't see it again:</p>
                  <code className="text-emerald-400 text-sm break-all">{newKey.key}</code>
                </div>
                <button
                  onClick={() => {
                    setShowNewKeyModal(false)
                    setNewKey(null)
                  }}
                  className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-white mb-4">Create API Key</h3>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Key name (e.g., Production)"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 mb-4"
                />
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowNewKeyModal(false)}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateKey}
                    disabled={!newKeyName}
                    className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
