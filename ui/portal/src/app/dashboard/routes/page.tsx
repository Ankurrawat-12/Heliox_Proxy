'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { portalApi, Route } from '@/lib/api';
import {
  Route as RouteIcon,
  Plus,
  Edit2,
  Trash2,
  X,
  ExternalLink,
} from 'lucide-react';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function Modal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function RoutesPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    path_pattern: '',
    upstream_url: '',
    methods: ['GET'] as string[],
  });

  const { data: routes, isLoading } = useQuery({
    queryKey: ['routes'],
    queryFn: portalApi.getRoutes,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Route>) => portalApi.createRoute(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Route> }) =>
      portalApi.updateRoute(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => portalApi.deleteRoute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      setDeleteId(null);
    },
  });

  const resetForm = () => {
    setShowModal(false);
    setEditingRoute(null);
    setFormData({
      name: '',
      path_pattern: '',
      upstream_url: '',
      methods: ['GET'],
    });
  };

  const handleEdit = (route: Route) => {
    setEditingRoute(route);
    setFormData({
      name: route.name,
      path_pattern: route.path_pattern,
      upstream_url: route.upstream_url,
      methods: route.methods,
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRoute) {
      updateMutation.mutate({ id: editingRoute.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleMethod = (method: string) => {
    setFormData((prev) => ({
      ...prev,
      methods: prev.methods.includes(method)
        ? prev.methods.filter((m) => m !== method)
        : [...prev.methods, method],
    }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Routes</h1>
          <p className="text-zinc-400 mt-1">
            Configure how requests are routed to your upstream services
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          Add Route
        </button>
      </div>

      {/* Routes List */}
      <div className="card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
          </div>
        ) : routes?.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <RouteIcon size={32} className="text-zinc-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No routes yet</h3>
            <p className="text-zinc-400 mb-4">
              Create your first route to start proxying requests
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus size={18} />
              Add Route
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {routes?.map((route) => (
              <div
                key={route.id}
                className="flex items-start gap-4 p-4 bg-zinc-800/30 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                  <RouteIcon size={20} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-medium text-white">{route.name}</h3>
                      <code className="text-sm text-zinc-400 font-mono">
                        {route.path_pattern}
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(route)}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteId(route.id)}
                        className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {route.methods.map((method) => (
                      <span
                        key={method}
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          method === 'GET' ? 'bg-green-500/10 text-green-400' :
                          method === 'POST' ? 'bg-blue-500/10 text-blue-400' :
                          method === 'PUT' || method === 'PATCH' ? 'bg-yellow-500/10 text-yellow-400' :
                          method === 'DELETE' ? 'bg-red-500/10 text-red-400' :
                          'bg-zinc-500/10 text-zinc-400'
                        }`}
                      >
                        {method}
                      </span>
                    ))}
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                      route.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {route.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
                    <ExternalLink size={14} />
                    <span className="truncate">{route.upstream_url}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={resetForm}
        title={editingRoute ? 'Edit Route' : 'Create Route'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Route Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="e.g., Products API"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Path Pattern
            </label>
            <input
              type="text"
              value={formData.path_pattern}
              onChange={(e) => setFormData({ ...formData, path_pattern: e.target.value })}
              className="input font-mono"
              placeholder="e.g., /api/products/*"
              required
            />
            <p className="text-xs text-zinc-500 mt-1">Use * for wildcards</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Upstream URL
            </label>
            <input
              type="url"
              value={formData.upstream_url}
              onChange={(e) => setFormData({ ...formData, upstream_url: e.target.value })}
              className="input font-mono"
              placeholder="e.g., https://api.example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Allowed Methods
            </label>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => toggleMethod(method)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    formData.methods.includes(method)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : editingRoute ? (
                'Save Changes'
              ) : (
                'Create Route'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Route"
      >
        <div className="space-y-4">
          <p className="text-zinc-400">
            Are you sure you want to delete this route? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteId(null)}
              className="flex-1 btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              className="flex-1 btn-danger flex items-center justify-center gap-2"
            >
              {deleteMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Trash2 size={16} />
                  Delete
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
