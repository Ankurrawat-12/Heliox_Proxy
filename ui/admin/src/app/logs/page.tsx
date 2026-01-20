'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApi, RequestLog } from '@/lib/api'
import DataTable from '@/components/DataTable'
import Badge from '@/components/Badge'
import { format } from 'date-fns'
import { RefreshCw } from 'lucide-react'

export default function LogsPage() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    status_code: '',
    cache_status: '',
  })
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['logs', page, filters],
    queryFn: () => adminApi.getLogs({
      page,
      page_size: 50,
      status_code: filters.status_code ? parseInt(filters.status_code) : undefined,
      cache_status: filters.cache_status || undefined,
    }),
    refetchInterval: 10000,
    retry: 1,
  })
  
  const getCacheStatusBadge = (status: string) => {
    switch (status) {
      case 'hit':
        return <Badge variant="success">HIT</Badge>
      case 'stale':
        return <Badge variant="warning">STALE</Badge>
      case 'miss':
        return <Badge variant="error">MISS</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }
  
  const getStatusCodeBadge = (code: number) => {
    if (code >= 200 && code < 300) {
      return <Badge variant="success">{code}</Badge>
    } else if (code >= 400 && code < 500) {
      return <Badge variant="warning">{code}</Badge>
    } else if (code >= 500) {
      return <Badge variant="error">{code}</Badge>
    }
    return <Badge>{code}</Badge>
  }
  
  const columns = [
    {
      key: 'timestamp',
      header: 'Time',
      render: (log: RequestLog) => (
        <span className="text-sm font-mono">
          {format(new Date(log.timestamp), 'HH:mm:ss')}
        </span>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      render: (log: RequestLog) => (
        <Badge variant="info" size="sm">{log.method}</Badge>
      ),
    },
    {
      key: 'path',
      header: 'Path',
      render: (log: RequestLog) => (
        <span className="font-mono text-sm truncate max-w-xs block" title={log.path}>
          {log.path}
        </span>
      ),
    },
    {
      key: 'status_code',
      header: 'Status',
      render: (log: RequestLog) => getStatusCodeBadge(log.status_code),
    },
    {
      key: 'cache_status',
      header: 'Cache',
      render: (log: RequestLog) => getCacheStatusBadge(log.cache_status),
    },
    {
      key: 'latency_ms',
      header: 'Latency',
      render: (log: RequestLog) => (
        <span className={`font-mono text-sm ${log.latency_ms > 1000 ? 'text-red-600' : ''}`}>
          {log.latency_ms}ms
        </span>
      ),
    },
    {
      key: 'api_key_name',
      header: 'API Key',
      render: (log: RequestLog) => log.api_key_name || '-',
    },
    {
      key: 'route_name',
      header: 'Route',
      render: (log: RequestLog) => log.route_name || '-',
    },
  ]
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Request Logs</h1>
          <p className="text-gray-500 mt-1">View recent gateway requests</p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-secondary flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>
      
      {/* Filters */}
      <div className="card">
        <div className="flex items-center space-x-4">
          <div>
            <label className="label">Cache Status</label>
            <select
              value={filters.cache_status}
              onChange={(e) => {
                setFilters({ ...filters, cache_status: e.target.value })
                setPage(1)
              }}
              className="input w-40"
            >
              <option value="">All</option>
              <option value="hit">Hit</option>
              <option value="stale">Stale</option>
              <option value="miss">Miss</option>
              <option value="bypass">Bypass</option>
            </select>
          </div>
          <div>
            <label className="label">Status Code</label>
            <select
              value={filters.status_code}
              onChange={(e) => {
                setFilters({ ...filters, status_code: e.target.value })
                setPage(1)
              }}
              className="input w-40"
            >
              <option value="">All</option>
              <option value="200">200 OK</option>
              <option value="404">404 Not Found</option>
              <option value="429">429 Rate Limited</option>
              <option value="500">500 Server Error</option>
            </select>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="card bg-red-50 border border-red-200 text-red-700">
          <p className="font-medium">Error loading logs</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      )}
      
      {/* Debug info */}
      {data && (
        <div className="text-sm text-gray-500">
          Showing {data.items?.length || 0} of {data.total} total logs (page {data.page})
        </div>
      )}
      
      <DataTable
        columns={columns}
        data={data?.items || []}
        keyField="id"
        isLoading={isLoading}
        pagination={data ? {
          page: data.page,
          pageSize: data.page_size,
          total: data.total,
          onPageChange: setPage,
        } : undefined}
        emptyMessage="No request logs found"
      />
    </div>
  )
}
