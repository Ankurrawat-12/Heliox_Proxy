/**
 * API client for Heliox Admin
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ============================================================================
// AUTH TOKEN MANAGEMENT
// ============================================================================

let authToken: string | null = null

export function getAuthToken(): string | null {
  if (authToken) return authToken
  if (typeof window !== 'undefined') {
    authToken = localStorage.getItem('admin_auth_token')
  }
  return authToken
}

export function setAuthToken(token: string | null): void {
  authToken = token
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('admin_auth_token', token)
    } else {
      localStorage.removeItem('admin_auth_token')
    }
  }
}

// Get admin key from localStorage (client-side only) - for backward compatibility
function getAdminKey(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('adminKey') || ''
}

// Set admin key in localStorage (client-side only)
export function setAdminKey(key: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('adminKey', key)
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken()
  const adminKey = getAdminKey()
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  
  // Prefer JWT auth, fall back to API key
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  } else if (adminKey) {
    headers['X-Admin-Key'] = adminKey
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }

  return response.json()
}

// ============================================================================
// AUTH TYPES & API
// ============================================================================

export interface AdminUser {
  id: string
  email: string
  name: string
  avatar_url: string | null
  role: string
  tenant_id: string | null
  tenant_name: string | null
  plan_name: string | null
  email_verified: boolean
  created_at: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: AdminUser
}

export const authApi = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Login failed' }))
      throw new Error(error.detail || 'Login failed')
    }
    
    const data = await response.json()
    setAuthToken(data.access_token)
    return data
  },
  
  async logout(): Promise<void> {
    setAuthToken(null)
  },
  
  async getMe(): Promise<AdminUser> {
    return fetchApi<AdminUser>('/auth/me')
  },
  
  async refreshToken(): Promise<AuthResponse> {
    const response = await fetchApi<AuthResponse>('/auth/refresh', { method: 'POST' })
    setAuthToken(response.access_token)
    return response
  },
}

// Types
export interface Plan {
  id: string
  name: string
  tier: 'free' | 'pro' | 'enterprise' | 'custom'
  description?: string
  price_monthly_cents: number
  quota_daily: number
  quota_monthly: number
  rate_limit_rps: number
  rate_limit_burst: number
  max_api_keys: number
  max_routes: number
  cache_enabled: boolean
  analytics_enabled: boolean
  priority_support: boolean
  custom_domains: boolean
  is_active: boolean
  is_default: boolean
  created_at: string
  updated_at: string
  tenant_count?: number
}

export interface PlanSummary {
  id: string
  name: string
  tier: string
}

export interface Tenant {
  id: string
  name: string
  description: string
  plan_id?: string
  plan?: PlanSummary
  is_active: boolean
  created_at: string
  updated_at: string
  api_key_count?: number
  route_count?: number
}

export interface ApiKey {
  id: string
  tenant_id: string
  name: string
  key_prefix: string
  key?: string // Only returned on creation
  is_active: boolean
  status?: string
  rate_limit_rps: number
  rate_limit_burst: number
  daily_quota: number
  monthly_quota: number
  quota_daily?: number
  quota_monthly?: number
  daily_usage?: number
  monthly_usage?: number
  created_at: string
  last_used_at?: string
}

export interface Route {
  id: string
  tenant_id?: string
  policy_id?: string
  name: string
  description: string
  path_pattern: string
  methods: string[]
  upstream_base_url: string
  is_active: boolean
  timeout_ms: number
  priority: number
  created_at: string
  updated_at: string
}

export interface CachePolicy {
  id: string
  name: string
  description: string
  ttl_seconds: number
  stale_seconds: number
  vary_headers_json: string[]
  cacheable_methods: string[]
  cacheable_statuses_json: number[]
  max_body_bytes?: number
  cache_no_store?: boolean
  route_count?: number
  created_at: string
}

export interface AnalyticsSummary {
  total_requests: number
  cache_hits: number
  cache_misses: number
  cache_stale: number
  cache_hit_rate: number
  error_count: number
  error_rate: number
  avg_latency_ms: number
  requests_per_minute: number
  unique_keys: number
  unique_routes: number
}

export interface HealthStatus {
  status: string
  version: string
  timestamp: string
  components: Record<string, { status: string }>
}

export interface BlockedKey {
  api_key_id: string
  reason: string
  score: number
  blocked_at: string
  blocked_until: string
}

export interface BlockRule {
  id: string
  api_key_id: string
  reason: string
  reason_detail?: string
  anomaly_score?: number
  blocked_at: string
  blocked_until?: string
  is_active: boolean
}

export interface RequestLog {
  id: string
  request_id?: string
  api_key_id?: string
  route_id?: string
  tenant_id?: string
  tenant_name?: string
  method: string
  path: string
  status_code: number
  latency_ms: number
  cache_status: string
  timestamp: string
  error_type?: string
  client_ip?: string
  api_key_name?: string
  route_name?: string
}

export interface PaginatedLogs {
  items: RequestLog[]
  page: number
  page_size: number
  total: number
  has_more?: boolean
}

export interface LogFilters {
  page?: number
  page_size?: number
  status_code?: number
  cache_status?: string
}

// Admin API
export const adminApi = {
  // Health
  getHealth: async (): Promise<HealthStatus> => {
    const response = await fetch(`${API_URL}/health`)
    return response.json()
  },

  // Plans
  getPlans: async (): Promise<Plan[]> => {
    return fetchApi('/admin/plans')
  },

  getPlan: async (id: string): Promise<Plan> => {
    return fetchApi(`/admin/plans/${id}`)
  },

  createPlan: async (data: Partial<Plan>): Promise<Plan> => {
    return fetchApi('/admin/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updatePlan: async (id: string, data: Partial<Plan>): Promise<Plan> => {
    return fetchApi(`/admin/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  deletePlan: async (id: string): Promise<void> => {
    return fetchApi(`/admin/plans/${id}`, {
      method: 'DELETE',
    })
  },

  // Analytics
  getSummary: async (hours: number = 24): Promise<AnalyticsSummary> => {
    return fetchApi(`/admin/analytics/summary?hours=${hours}`)
  },

  getTopKeys: async (limit: number = 10): Promise<any[]> => {
    return fetchApi(`/admin/analytics/top-keys?limit=${limit}`)
  },

  getTopRoutes: async (limit: number = 10): Promise<any[]> => {
    return fetchApi(`/admin/analytics/top-routes?limit=${limit}`)
  },

  getCacheHitRate: async (hours: number = 24): Promise<any> => {
    return fetchApi(`/admin/analytics/cache-hit-rate?hours=${hours}`)
  },

  getLogs: async (filters: LogFilters = {}): Promise<PaginatedLogs> => {
    const params = new URLSearchParams()
    if (filters.page) params.append('page', String(filters.page))
    if (filters.page_size) params.append('page_size', String(filters.page_size))
    if (filters.status_code) params.append('status_code', String(filters.status_code))
    if (filters.cache_status) params.append('cache_status', filters.cache_status)
    return fetchApi(`/admin/analytics/logs?${params.toString()}`)
  },

  // Tenants
  getTenants: async (): Promise<Tenant[]> => {
    return fetchApi('/admin/tenants')
  },

  getTenant: async (id: string): Promise<Tenant> => {
    return fetchApi(`/admin/tenants/${id}`)
  },

  createTenant: async (data: Partial<Tenant>): Promise<Tenant> => {
    return fetchApi('/admin/tenants', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateTenant: async (id: string, data: Partial<Tenant>): Promise<Tenant> => {
    return fetchApi(`/admin/tenants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },
  
  deleteTenant: async (id: string): Promise<void> => {
    await fetchApi(`/admin/tenants/${id}`, {
      method: 'DELETE',
    })
  },

  // API Keys
  getKeys: async (): Promise<ApiKey[]> => {
    return fetchApi('/admin/keys')
  },

  getKey: async (id: string): Promise<ApiKey> => {
    return fetchApi(`/admin/keys/${id}`)
  },

  createKey: async (data: Partial<ApiKey>): Promise<ApiKey> => {
    return fetchApi('/admin/keys', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateKey: async (id: string, data: Partial<ApiKey>): Promise<ApiKey> => {
    return fetchApi(`/admin/keys/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  deleteKey: async (id: string): Promise<void> => {
    return fetchApi(`/admin/keys/${id}`, {
      method: 'DELETE',
    })
  },

  rotateKey: async (id: string): Promise<ApiKey> => {
    return fetchApi(`/admin/keys/${id}/rotate`, {
      method: 'POST',
    })
  },

  // Routes
  getRoutes: async (): Promise<Route[]> => {
    return fetchApi('/admin/routes')
  },

  getRoute: async (id: string): Promise<Route> => {
    return fetchApi(`/admin/routes/${id}`)
  },

  createRoute: async (data: Partial<Route>): Promise<Route> => {
    return fetchApi('/admin/routes', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateRoute: async (id: string, data: Partial<Route>): Promise<Route> => {
    return fetchApi(`/admin/routes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  deleteRoute: async (id: string): Promise<void> => {
    return fetchApi(`/admin/routes/${id}`, {
      method: 'DELETE',
    })
  },

  // Cache Policies
  getPolicies: async (): Promise<CachePolicy[]> => {
    return fetchApi('/admin/policies')
  },

  getPolicy: async (id: string): Promise<CachePolicy> => {
    return fetchApi(`/admin/policies/${id}`)
  },

  createPolicy: async (data: Partial<CachePolicy>): Promise<CachePolicy> => {
    return fetchApi('/admin/policies', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updatePolicy: async (id: string, data: Partial<CachePolicy>): Promise<CachePolicy> => {
    return fetchApi(`/admin/policies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  // Cache Management
  purgeCache: async (pattern?: string): Promise<{ deleted: number }> => {
    return fetchApi('/admin/cache/purge', {
      method: 'POST',
      body: JSON.stringify({ pattern }),
    })
  },

  // Abuse Management
  getBlockedKeys: async (): Promise<BlockRule[]> => {
    return fetchApi('/admin/abuse/blocked')
  },

  unblockKey: async (keyId: string, reason?: string): Promise<void> => {
    return fetchApi(`/admin/abuse/unblock/${keyId}`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  },

  // Metrics
  getMetrics: async (): Promise<any> => {
    const response = await fetch(`${API_URL}/metrics`)
    return response.json()
  },
}

export default adminApi
