/**
 * API client for Customer Portal
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ============================================================================
// TYPES
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: string;
  tenant_id: string | null;
  tenant_name: string | null;
  plan_name: string | null;
  email_verified: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface Tenant {
  id: string;
  name: string;
  description: string | null;
  plan_id: string | null;
  plan_name: string | null;
  plan_tier: string | null;
  api_key_count: number;
  route_count: number;
  max_api_keys: number;
  max_routes: number;
  quota_daily: number;
  quota_monthly: number;
  created_at: string;
}

export interface Plan {
  id: string;
  name: string;
  tier: string;
  description: string | null;
  price_monthly_cents: number;
  quota_daily: number;
  quota_monthly: number;
  rate_limit_rps: number;
  rate_limit_burst: number;
  max_api_keys: number;
  max_routes: number;
  cache_enabled: boolean;
  analytics_enabled: boolean;
  priority_support: boolean;
  custom_domains: boolean;
  is_active: boolean;
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  tenant_id?: string;
  status?: string;
  is_active: boolean;
  rate_limit_rps: number | null;
  rate_limit_burst?: number | null;
  quota_daily: number | null;
  quota_monthly: number | null;
  requests_today?: number;
  requests_this_month?: number;
  last_used_at: string | null;
  expires_at?: string | null;
  created_at: string;
}

export interface Route {
  id: string;
  name: string;
  path_pattern: string;
  upstream_url: string;
  methods: string[];
  is_active: boolean;
  created_at: string;
}

export interface UsageStats {
  daily_requests: number;
  monthly_requests: number;
  daily_limit: number;
  monthly_limit: number;
  daily_percent: number;
  monthly_percent: number;
  cache_hit_rate: number;
  avg_latency_ms: number;
  error_rate: number;
}

export interface RequestLog {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  status_code: number;
  latency_ms: number;
  cache_status: string | null;
  api_key_name: string | null;
}

// ============================================================================
// AUTH TOKEN MANAGEMENT
// ============================================================================

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== 'undefined') {
    authToken = localStorage.getItem('auth_token');
  }
  return authToken;
}

// ============================================================================
// API CLIENT
// ============================================================================

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// AUTH API
// ============================================================================

export const authApi = {
  async signup(data: {
    email: string;
    password: string;
    name: string;
    company_name: string;
  }): Promise<AuthResponse> {
    const response = await request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setAuthToken(response.access_token);
    return response;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(response.access_token);
    return response;
  },

  async logout(): Promise<void> {
    setAuthToken(null);
  },

  async getMe(): Promise<User> {
    return request<User>('/auth/me');
  },

  async updateProfile(data: { name?: string; avatar_url?: string }): Promise<User> {
    return request<User>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async changePassword(current_password: string, new_password: string): Promise<void> {
    await request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password }),
    });
  },

  async forgotPassword(email: string): Promise<void> {
    await request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(token: string, new_password: string): Promise<void> {
    await request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password }),
    });
  },

  async refreshToken(): Promise<AuthResponse> {
    const response = await request<AuthResponse>('/auth/refresh', {
      method: 'POST',
    });
    setAuthToken(response.access_token);
    return response;
  },
};

// ============================================================================
// PORTAL API
// ============================================================================

export const portalApi = {
  // Tenant
  async getTenant(): Promise<Tenant> {
    return request<Tenant>('/portal/tenant');
  },

  async updateTenant(data: { name?: string; description?: string }): Promise<Tenant> {
    return request<Tenant>('/portal/tenant', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Usage
  async getUsage(): Promise<UsageStats> {
    return request<UsageStats>('/portal/usage');
  },

  // API Keys
  async getApiKeys(): Promise<ApiKey[]> {
    return request<ApiKey[]>('/portal/keys');
  },

  async createApiKey(data: { name: string; expires_at?: string }): Promise<ApiKey & { key: string }> {
    return request('/portal/keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteApiKey(id: string): Promise<void> {
    await request(`/portal/keys/${id}`, { method: 'DELETE' });
  },

  async rotateApiKey(id: string): Promise<ApiKey & { key: string }> {
    return request(`/portal/keys/${id}/rotate`, { method: 'POST' });
  },

  async toggleApiKey(id: string): Promise<ApiKey> {
    return request(`/portal/keys/${id}/toggle`, { method: 'PATCH' });
  },

  // Logs
  async getLogs(params?: { page?: number; page_size?: number }): Promise<{ items: RequestLog[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.page_size) query.set('page_size', params.page_size.toString());
    return request(`/portal/logs?${query.toString()}`);
  },

  // Plans
  async getPlans(): Promise<Plan[]> {
    return request<Plan[]>('/portal/plans');
  },
};

// ============================================================================
// PAYMENT API
// ============================================================================

export const paymentApi = {
  async createOrder(plan_id: string): Promise<{
    order_id: string;
    amount: number;
    currency: string;
    key_id: string;
    plan_name: string;
  }> {
    return request('/payments/create-order', {
      method: 'POST',
      body: JSON.stringify({ plan_id }),
    });
  },

  async verifyPayment(data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    plan_id: string;
  }): Promise<{ message: string; plan: string }> {
    return request('/payments/verify-payment', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async cancelSubscription(): Promise<void> {
    await request('/payments/cancel-subscription', { method: 'POST' });
  },
};
