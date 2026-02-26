'use client';

import React, { useEffect, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { L2ConceptSdk, DelegationStatus } from '@l2conceptv1/sdk';

interface DelegationStatusProps {
  sdk: L2ConceptSdk | null;
  owner: PublicKey | null;
  mints: PublicKey[];
  refreshInterval?: number;
}

export function DelegationStatusComponent({
  sdk,
  owner,
  mints,
  refreshInterval = 30000,
}: DelegationStatusProps) {
  const [status, setStatus] = useState<DelegationStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    if (!sdk || !owner) return;

    try {
      setLoading(true);
      setError(null);
      const delegationStatus = await sdk.getDelegationStatus(owner, mints);
      setStatus(delegationStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch delegation status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchStatus, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [sdk, owner, mints.join(','), refreshInterval]);

  const delegatedCount = status.filter((s) => s.isDelegated).length;
  const totalCount = status.length;

  if (!sdk || !owner) {
    return null;
  }

  return (
    <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Delegation Status</h3>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">
            {delegatedCount} of {totalCount} accounts delegated
          </span>
          {delegatedCount > 0 && (
            <span className="text-yellow-400 text-xs">
              ⚠️ Withdrawals blocked while delegated
            </span>
          )}
        </div>
        <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              delegatedCount === totalCount
                ? 'bg-green-500'
                : delegatedCount > 0
                ? 'bg-yellow-500'
                : 'bg-gray-500'
            }`}
            style={{ width: `${totalCount > 0 ? (delegatedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {status.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {status.map((item) => (
            <div
              key={item.account.toBase58()}
              className="flex items-center justify-between p-2 bg-gray-800/50 rounded text-sm"
            >
              <span className="font-mono text-xs text-gray-400 truncate max-w-[200px]">
                {item.account.toBase58().slice(0, 8)}...{item.account.toBase58().slice(-8)}
              </span>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  item.isDelegated
                    ? 'bg-green-900/50 text-green-400'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {item.isDelegated ? 'Delegated' : 'L1'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800 rounded text-sm text-blue-300">
        <p className="font-medium mb-1">About Delegation</p>
        <p className="text-xs text-blue-400/80">
          Delegating to MagicBlock Ephemeral Rollup enables fast, low-cost transactions.
          Accounts must be undelegated before withdrawing to L1.
        </p>
      </div>
    </div>
  );
}
