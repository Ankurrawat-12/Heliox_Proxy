'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi, Plan } from '@/lib/api'
import DataTable from '@/components/DataTable'
import Badge from '@/components/Badge'
import Modal from '@/components/Modal'
import ConfirmModal from '@/components/ConfirmModal'
import { useToast } from '@/components/Toast'
import { Plus, Edit2, Trash2, Check, Crown, Zap, Building2 } from 'lucide-react'

export default function PlansPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Plan | null>(null)
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  
  const { data: plans, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => adminApi.getPlans(),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Plan>) => adminApi.createPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      setIsModalOpen(false)
      showToast('Plan created successfully', 'success')
    },
    onError: (error: Error) => {
      showToast(error.message, 'error')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Plan> }) => 
      adminApi.updatePlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      setEditingPlan(null)
      setIsModalOpen(false)
      showToast('Plan updated successfully', 'success')
    },
    onError: (error: Error) => {
      showToast(error.message, 'error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deletePlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      setDeleteConfirm(null)
      showToast('Plan deleted successfully', 'success')
    },
    onError: (error: Error) => {
      showToast(error.message, 'error')
    },
  })

  const [formData, setFormData] = useState<Partial<Plan>>({
    name: '',
    tier: 'custom',
    description: '',
    price_monthly_cents: 0,
    quota_daily: 1000,
    quota_monthly: 10000,
    rate_limit_rps: 10,
    rate_limit_burst: 20,
    max_api_keys: 2,
    max_routes: 5,
    cache_enabled: true,
    analytics_enabled: false,
    priority_support: false,
    custom_domains: false,
    is_default: false,
  })

  const handleOpenModal = (plan?: Plan) => {
    if (plan) {
      setEditingPlan(plan)
      setFormData(plan)
    } else {
      setEditingPlan(null)
      setFormData({
        name: '',
        tier: 'custom',
        description: '',
        price_monthly_cents: 0,
        quota_daily: 1000,
        quota_monthly: 10000,
        rate_limit_rps: 10,
        rate_limit_burst: 20,
        max_api_keys: 2,
        max_routes: 5,
        cache_enabled: true,
        analytics_enabled: false,
        priority_support: false,
        custom_domains: false,
        is_default: false,
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'free':
        return <Zap className="w-4 h-4" />
      case 'pro':
        return <Crown className="w-4 h-4" />
      case 'enterprise':
        return <Building2 className="w-4 h-4" />
      default:
        return null
    }
  }

  const getTierBadge = (tier: string, isDefault: boolean) => {
    const variants: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
      free: 'success',
      pro: 'warning',
      enterprise: 'error',
      custom: 'info',
    }
    return (
      <div className="flex items-center gap-2">
        <Badge variant={variants[tier] || 'info'}>
          <span className="flex items-center gap-1">
            {getTierIcon(tier)}
            {tier.toUpperCase()}
          </span>
        </Badge>
        {isDefault && <Badge variant="info" size="sm">Default</Badge>}
      </div>
    )
  }

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free'
    return `$${(cents / 100).toFixed(2)}/mo`
  }

  const formatLimit = (value: number) => {
    if (value === 0) return '∞'
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
    return value.toString()
  }

  const columns = [
    {
      key: 'name',
      header: 'Plan',
      render: (plan: Plan) => (
        <div>
          <div className="font-medium">{plan.name}</div>
          <div className="text-sm text-gray-500">{plan.description}</div>
        </div>
      ),
    },
    {
      key: 'tier',
      header: 'Tier',
      render: (plan: Plan) => getTierBadge(plan.tier, plan.is_default),
    },
    {
      key: 'price',
      header: 'Price',
      render: (plan: Plan) => (
        <span className="font-semibold">{formatPrice(plan.price_monthly_cents)}</span>
      ),
    },
    {
      key: 'limits',
      header: 'Limits',
      render: (plan: Plan) => (
        <div className="text-sm space-y-1">
          <div>{formatLimit(plan.quota_daily)}/day • {formatLimit(plan.quota_monthly)}/mo</div>
          <div className="text-gray-500">{plan.rate_limit_rps} RPS • {plan.rate_limit_burst} burst</div>
        </div>
      ),
    },
    {
      key: 'resources',
      header: 'Resources',
      render: (plan: Plan) => (
        <div className="text-sm">
          <div>{formatLimit(plan.max_api_keys)} keys • {formatLimit(plan.max_routes)} routes</div>
        </div>
      ),
    },
    {
      key: 'features',
      header: 'Features',
      render: (plan: Plan) => (
        <div className="flex gap-1 flex-wrap">
          {plan.cache_enabled && <Badge size="sm" variant="success">Cache</Badge>}
          {plan.analytics_enabled && <Badge size="sm" variant="info">Analytics</Badge>}
          {plan.priority_support && <Badge size="sm" variant="warning">Support</Badge>}
          {plan.custom_domains && <Badge size="sm" variant="error">Domains</Badge>}
        </div>
      ),
    },
    {
      key: 'tenants',
      header: 'Tenants',
      render: (plan: Plan) => (
        <Badge variant={plan.tenant_count ? 'info' : undefined}>
          {plan.tenant_count || 0}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (plan: Plan) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleOpenModal(plan)}
            className="p-1 hover:bg-gray-100 rounded"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {!plan.is_default && (plan.tenant_count || 0) === 0 && (
            <button
              onClick={() => setDeleteConfirm(plan)}
              className="p-1 hover:bg-red-100 rounded text-red-600"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription Plans</h1>
          <p className="text-gray-500 mt-1">Manage pricing tiers and feature limits</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create Plan</span>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={plans || []}
        keyField="id"
        isLoading={isLoading}
        emptyMessage="No plans found"
      />

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPlan ? 'Edit Plan' : 'Create Plan'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Tier</label>
              <select
                value={formData.tier}
                onChange={(e) => setFormData({ ...formData, tier: e.target.value as Plan['tier'] })}
                className="input"
              >
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <input
              type="text"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="label">Price (cents/month)</label>
            <input
              type="number"
              value={formData.price_monthly_cents}
              onChange={(e) => setFormData({ ...formData, price_monthly_cents: parseInt(e.target.value) || 0 })}
              className="input"
              min="0"
            />
            <p className="text-sm text-gray-500 mt-1">
              {formatPrice(formData.price_monthly_cents || 0)}
            </p>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Request Limits</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Daily Quota (0 = unlimited)</label>
                <input
                  type="number"
                  value={formData.quota_daily}
                  onChange={(e) => setFormData({ ...formData, quota_daily: parseInt(e.target.value) || 0 })}
                  className="input"
                  min="0"
                />
              </div>
              <div>
                <label className="label">Monthly Quota (0 = unlimited)</label>
                <input
                  type="number"
                  value={formData.quota_monthly}
                  onChange={(e) => setFormData({ ...formData, quota_monthly: parseInt(e.target.value) || 0 })}
                  className="input"
                  min="0"
                />
              </div>
              <div>
                <label className="label">Rate Limit (RPS)</label>
                <input
                  type="number"
                  value={formData.rate_limit_rps}
                  onChange={(e) => setFormData({ ...formData, rate_limit_rps: parseFloat(e.target.value) || 0 })}
                  className="input"
                  min="0.1"
                  step="0.1"
                />
              </div>
              <div>
                <label className="label">Burst Limit</label>
                <input
                  type="number"
                  value={formData.rate_limit_burst}
                  onChange={(e) => setFormData({ ...formData, rate_limit_burst: parseInt(e.target.value) || 0 })}
                  className="input"
                  min="1"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Resource Limits</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Max API Keys (0 = unlimited)</label>
                <input
                  type="number"
                  value={formData.max_api_keys}
                  onChange={(e) => setFormData({ ...formData, max_api_keys: parseInt(e.target.value) || 0 })}
                  className="input"
                  min="0"
                />
              </div>
              <div>
                <label className="label">Max Routes (0 = unlimited)</label>
                <input
                  type="number"
                  value={formData.max_routes}
                  onChange={(e) => setFormData({ ...formData, max_routes: parseInt(e.target.value) || 0 })}
                  className="input"
                  min="0"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Features</h4>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.cache_enabled}
                  onChange={(e) => setFormData({ ...formData, cache_enabled: e.target.checked })}
                  className="rounded"
                />
                <span>Cache Enabled</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.analytics_enabled}
                  onChange={(e) => setFormData({ ...formData, analytics_enabled: e.target.checked })}
                  className="rounded"
                />
                <span>Analytics Enabled</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.priority_support}
                  onChange={(e) => setFormData({ ...formData, priority_support: e.target.checked })}
                  className="rounded"
                />
                <span>Priority Support</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.custom_domains}
                  onChange={(e) => setFormData({ ...formData, custom_domains: e.target.checked })}
                  className="rounded"
                />
                <span>Custom Domains</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  className="rounded"
                />
                <span>Default Plan</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingPlan ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
        title="Delete Plan"
        message={`Are you sure you want to delete the "${deleteConfirm?.name}" plan? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}
