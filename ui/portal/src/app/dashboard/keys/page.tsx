'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { portalApi, ApiKey } from '@/lib/api';
import {
  Key,
  Plus,
  Copy,
  Trash2,
  RefreshCw,
  Check,
  X,
  AlertTriangle,
  Eye,
  EyeOff,
  Power,
} from 'lucide-react';

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
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md p-6 animate-fade-in">
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

export default function KeysPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [newSecret, setNewSecret] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [copied, setCopied] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: keys, isLoading } = useQuery({
    queryKey: ['keys'],
    queryFn: portalApi.getApiKeys,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => portalApi.createApiKey({ name }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['keys'] });
      setNewSecret(data.key);  // Backend returns full key in 'key' field
      setShowCreateModal(false);
      setShowSecretModal(true);
      setNewKeyName('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => portalApi.deleteApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys'] });
      setDeleteId(null);
    },
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) => portalApi.rotateApiKey(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['keys'] });
      setNewSecret(data.key);  // Backend returns full key in 'key' field
      setShowSecretModal(true);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => portalApi.toggleApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys'] });
    },
  });

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">API Keys</h1>
          <p className="text-zinc-400 mt-1">
            Manage your API keys for authenticating requests
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          Create Key
        </button>
      </div>

      {/* Keys list */}
      <div className="card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
          </div>
        ) : keys?.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Key size={32} className="text-zinc-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No API keys yet</h3>
            <p className="text-zinc-400 mb-4">
              Create your first API key to start making requests
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus size={18} />
              Create Key
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Key</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Usage</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Last Used</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-zinc-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys?.map((key) => (
                  <tr key={key.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                          <Key size={16} className="text-indigo-400" />
                        </div>
                        <span className="font-medium text-white">{key.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <code className="text-sm text-zinc-400 bg-zinc-800 px-2 py-1 rounded">
                        {key.key_prefix}...
                      </code>
                    </td>
                    <td className="py-4 px-4 text-sm text-zinc-400">
                      {key.requests_today?.toLocaleString() || 0} today
                    </td>
                    <td className="py-4 px-4 text-sm text-zinc-400">
                      {key.last_used_at
                        ? new Date(key.last_used_at).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          key.is_active
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${key.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
                        {key.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleMutation.mutate(key.id)}
                          disabled={toggleMutation.isPending}
                          className={`p-2 rounded-lg transition-colors ${
                            key.is_active
                              ? 'text-green-400 hover:text-red-400 hover:bg-red-500/10'
                              : 'text-red-400 hover:text-green-400 hover:bg-green-500/10'
                          }`}
                          title={key.is_active ? 'Disable key' : 'Enable key'}
                        >
                          <Power size={16} />
                        </button>
                        <button
                          onClick={() => rotateMutation.mutate(key.id)}
                          disabled={rotateMutation.isPending}
                          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                          title="Rotate key"
                        >
                          <RefreshCw size={16} className={rotateMutation.isPending ? 'animate-spin' : ''} />
                        </button>
                        <button
                          onClick={() => setDeleteId(key.id)}
                          className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete key"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create API Key"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(newKeyName);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Key Name
            </label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="input"
              placeholder="e.g., Production, Development"
              required
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="flex-1 btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Plus size={16} />
                  Create
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Secret Modal */}
      <Modal
        isOpen={showSecretModal}
        onClose={() => setShowSecretModal(false)}
        title="Your API Key"
      >
        <div className="space-y-4">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-yellow-400">Important</p>
                <p className="text-sm text-yellow-400/80 mt-1">
                  This is the only time you'll see this key. Copy it now and store it securely.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              API Key
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSecret}
                readOnly
                className="input font-mono text-sm flex-1"
              />
              <button
                onClick={() => copyToClipboard(newSecret)}
                className="btn-secondary flex items-center gap-2"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowSecretModal(false)}
            className="w-full btn-primary"
          >
            Done
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete API Key"
      >
        <div className="space-y-4">
          <p className="text-zinc-400">
            Are you sure you want to delete this API key? This action cannot be undone and will immediately revoke access for any applications using this key.
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
