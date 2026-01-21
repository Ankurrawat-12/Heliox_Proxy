'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi, Tenant, Plan } from '@/lib/api'
import DataTable from '@/components/DataTable'
import Modal from '@/components/Modal'
import Badge from '@/components/Badge'
import { useToast } from '@/components/Toast'
import { Plus, Edit2, Crown, Zap, Building2, Trash2 } from 'lucide-react'
import ConfirmModal from '@/components/ConfirmModal'
import { format } from 'date-fns'

export default function TenantsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '', plan_id: '' })
  const { showToast } = useToast()
  
  const queryClient = useQueryClient()
  
  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: adminApi.getTenants,
  })
  
  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: adminApi.getPlans,
  })
  
  const createMutation = useMutation({
    mutationFn: adminApi.createTenant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setIsCreateOpen(false)
      setFormData({ name: '', description: '', plan_id: '' })
      showToast('Tenant created successfully', 'success')
    },
    onError: (error: Error) => {
      showToast(error.message, 'error')
    },
  })
  
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Tenant> }) =>
      adminApi.updateTenant(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setEditingTenant(null)
      showToast('Tenant updated successfully', 'success')
    },
    onError: (error: Error) => {
      showToast(error.message, 'error')
    },
  })
  
  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteTenant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setDeletingTenant(null)
      showToast('Tenant deleted successfully', 'success')
    },
    onError: (error: Error) => {
      showToast(error.message, 'error')
    },
  })
  
  const getTierIcon = (tier?: string) => {
    switch (tier) {
      case 'free': return <Zap className="w-3 h-3" />
      case 'pro': return <Crown className="w-3 h-3" />
      case 'enterprise': return <Building2 className="w-3 h-3" />
      default: return null
    }
  }
  
  const getTierBadge = (plan?: { name: string; tier: string }) => {
    if (!plan) return <Badge size="sm">No Plan</Badge>
    
    const variants: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
      free: 'success',
      pro: 'warning',
      enterprise: 'error',
      custom: 'info',
    }
    return (
      <Badge variant={variants[plan.tier] || 'info'} size="sm">
        <span className="flex items-center gap-1">
          {getTierIcon(plan.tier)}
          {plan.name}
        </span>
      </Badge>
    )
  }
  
  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (tenant: Tenant) => (
        <div>
          <p className="font-medium text-gray-900">{tenant.name}</p>
          {tenant.description && (
            <p className="text-sm text-gray-500 truncate max-w-xs">{tenant.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (tenant: Tenant) => getTierBadge(tenant.plan),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (tenant: Tenant) => (
        <Badge variant={tenant.is_active ? 'success' : 'error'}>
          {tenant.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'api_key_count',
      header: 'API Keys',
      render: (tenant: Tenant) => tenant.api_key_count,
    },
    {
      key: 'route_count',
      header: 'Routes',
      render: (tenant: Tenant) => tenant.route_count,
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (tenant: Tenant) => format(new Date(tenant.created_at), 'MMM d, yyyy'),
    },
    {
      key: 'actions',
      header: '',
      render: (tenant: Tenant) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setEditingTenant(tenant)
              setFormData({ 
                name: tenant.name, 
                description: tenant.description || '',
                plan_id: tenant.plan_id || '',
              })
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Edit tenant"
          >
            <Edit2 className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setDeletingTenant(tenant)
            }}
            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete tenant"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
  ]
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      ...formData,
      plan_id: formData.plan_id || undefined,
    }
    if (editingTenant) {
      updateMutation.mutate({ id: editingTenant.id, data })
    } else {
      createMutation.mutate(data)
    }
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="text-gray-500 mt-1">Manage customer organizations</p>
        </div>
        <button
          onClick={() => {
            setFormData({ name: '', description: '', plan_id: '' })
            setIsCreateOpen(true)
          }}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Tenant</span>
        </button>
      </div>
      
      <DataTable
        columns={columns}
        data={tenants}
        keyField="id"
        isLoading={isLoading}
        emptyMessage="No tenants found. Create one to get started."
      />
      
      {/* Create/Edit Modal */}
      <Modal
        isOpen={isCreateOpen || !!editingTenant}
        onClose={() => {
          setIsCreateOpen(false)
          setEditingTenant(null)
        }}
        title={editingTenant ? 'Edit Tenant' : 'Create Tenant'}
        footer={
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => {
                setIsCreateOpen(false)
                setEditingTenant(null)
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
              className="btn-primary"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="Acme Corp"
              required
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input"
              rows={3}
              placeholder="Optional description..."
            />
          </div>
          <div>
            <label className="label">Subscription Plan</label>
            <select
              value={formData.plan_id}
              onChange={(e) => setFormData({ ...formData, plan_id: e.target.value })}
              className="input"
            >
              <option value="">Default (Free)</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} - ${(plan.price_monthly_cents / 100).toFixed(2)}/mo
                  {plan.is_default && ' (Default)'}
                </option>
              ))}
            </select>
            {formData.plan_id && plans.find(p => p.id === formData.plan_id) && (
              <p className="text-sm text-gray-500 mt-1">
                {(() => {
                  const plan = plans.find(p => p.id === formData.plan_id)!
                  return `${plan.quota_daily === 0 ? '∞' : plan.quota_daily.toLocaleString()} req/day • ${plan.max_api_keys === 0 ? '∞' : plan.max_api_keys} keys • ${plan.max_routes === 0 ? '∞' : plan.max_routes} routes`
                })()}
              </p>
            )}
          </div>
          {editingTenant && (
            <div>
              <label className="label">Status</label>
              <select
                value={editingTenant.is_active ? 'active' : 'inactive'}
                onChange={(e) => setEditingTenant({
                  ...editingTenant,
                  is_active: e.target.value === 'active',
                })}
                className="input"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          )}
        </form>
      </Modal>
      
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingTenant}
        onClose={() => setDeletingTenant(null)}
        onConfirm={() => deletingTenant && deleteMutation.mutate(deletingTenant.id)}
        title="Delete Tenant"
        message={`Are you sure you want to delete "${deletingTenant?.name}"? This will also delete all associated API keys and routes. This action cannot be undone.`}
        confirmText={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
        variant="danger"
      />
    </div>
  )
}
