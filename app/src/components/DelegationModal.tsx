'use client';

import React, { useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { L2ConceptSdk, WSOL_MINT } from '@l2conceptv1/sdk';

interface DelegationModalProps {
  sdk: L2ConceptSdk | null;
  owner: PublicKey | null;
  userMints: PublicKey[];
  onClose: () => void;
  onSuccess: () => void;
}

type DelegationMode = 'delegate' | 'undelegate';

export function DelegationModal({
  sdk,
  owner,
  userMints,
  onClose,
  onSuccess,
}: DelegationModalProps) {
  const [mode, setMode] = useState<DelegationMode>('delegate');
  const [selectedMints, setSelectedMints] = useState<PublicKey[]>([WSOL_MINT]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const toggleMint = useCallback((mint: PublicKey) => {
    setSelectedMints((prev) => {
      const exists = prev.some((m) => m.equals(mint));
      if (exists) {
        return prev.filter((m) => !m.equals(mint));
      }
      if (prev.length >= 10) {
        return prev; // Max 10 mints
      }
      return [...prev, mint];
    });
  }, []);

  const handleSubmit = async () => {
    if (!sdk || !owner || selectedMints.length === 0) return;

    try {
      setLoading(true);
      setError(null);
      setTxSignature(null);

      let result;
      if (mode === 'delegate') {
        result = await sdk.delegate({ mintList: selectedMints });
      } else {
        result = await sdk.commitAndUndelegate({ mintList: selectedMints });
      }

      setTxSignature(result.signature);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const allMints = [WSOL_MINT, ...userMints.filter((m) => !m.equals(WSOL_MINT))];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 max-w-md w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">MagicBlock Delegation</h2>
          <p className="text-sm text-gray-400 mt-1">
            {mode === 'delegate'
              ? 'Delegate accounts to Ephemeral Rollup for fast transactions'
              : 'Commit and undelegate accounts back to L1'}
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setMode('delegate')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                mode === 'delegate'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Delegate
            </button>
            <button
              onClick={() => setMode('undelegate')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                mode === 'undelegate'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Undelegate
            </button>
          </div>
        </div>

        {/* Mint Selection */}
        <div className="p-4 max-h-64 overflow-y-auto">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Select Accounts ({selectedMints.length}/10)
          </label>
          <div className="space-y-2">
            {allMints.map((mint) => {
              const isSelected = selectedMints.some((m) => m.equals(mint));
              const isWsol = mint.equals(WSOL_MINT);

              return (
                <button
                  key={mint.toBase58()}
                  onClick={() => toggleMint(mint)}
                  disabled={loading}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-blue-900/30 border-blue-600'
                      : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-500'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">
                        {isWsol ? 'wSOL' : `Token ${mint.toBase58().slice(0, 4)}...`}
                      </p>
                      <p className="text-xs text-gray-500 font-mono">
                        {mint.toBase58().slice(0, 16)}...
                      </p>
                    </div>
                  </div>
                  {isWsol && (
                    <span className="text-xs bg-purple-900/50 text-purple-400 px-2 py-1 rounded">
                      Default
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Error/Success Messages */}
        <div className="px-4">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-300">
              {error}
            </div>
          )}
          {txSignature && (
            <div className="p-3 bg-green-900/30 border border-green-700 rounded-lg text-sm">
              <p className="text-green-300 font-medium mb-1">Success!</p>
              <a
                href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300 underline break-all"
              >
                View on Explorer: {txSignature.slice(0, 20)}...
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Close
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || selectedMints.length === 0}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 ${
              mode === 'delegate'
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-yellow-600 hover:bg-yellow-700 text-white'
            }`}
          >
            {loading
              ? 'Processing...'
              : mode === 'delegate'
              ? `Delegate ${selectedMints.length} Account(s)`
              : `Undelegate ${selectedMints.length} Account(s)`}
          </button>
        </div>

        {/* Info Box */}
        <div className="px-4 pb-4">
          <div className="p-3 bg-gray-800/50 rounded-lg text-xs text-gray-400">
            <p className="font-medium text-gray-300 mb-1">
              {mode === 'delegate' ? 'About Delegation' : 'About Undelegation'}
            </p>
            <p>
              {mode === 'delegate'
                ? 'Delegating moves your accounts to MagicBlock ER for fast, low-cost transactions. Your accounts remain secure and can be undelegated at any time.'
                : 'Undelegating commits any pending changes and returns your accounts to L1. This is required before withdrawing funds.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
