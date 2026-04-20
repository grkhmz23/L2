'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWalletContext } from '@/contexts/WalletContext';
import { useWallet } from '@solana/wallet-adapter-react';
import { WSOL_MINT } from '@sable/sdk';
import { CompleteSetupModal } from './CompleteSetupModal';
import {
  GlassPanel,
  LuxuryButton,
  Pill,
  SectionHeader,
  truncateAddress,
} from '@/components/ui/luxury';
import toast from 'react-hot-toast';

type SetupStep = 'not_joined' | 'joined_no_wsol' | 'completed';

export function UserStatus() {
  const { sdk } = useWalletContext();
  const { publicKey } = useWallet();
  const [hasJoined, setHasJoined] = useState<boolean | null>(null);
  const [hasWsolBalance, setHasWsolBalance] = useState<boolean | null>(null);
  const [userState, setUserState] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [setupStep, setSetupStep] = useState<SetupStep>('not_joined');
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [overlayDismissed, setOverlayDismissed] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!sdk || !publicKey) return;

    try {
      const state = await sdk.getUserState(publicKey);
      setHasJoined(!!state);
      setUserState(state);

      if (state) {
        const wsolBalance = await sdk.getUserBalance(publicKey, WSOL_MINT);
        setHasWsolBalance(!!wsolBalance);
        setSetupStep(wsolBalance ? 'completed' : 'joined_no_wsol');
      } else {
        setHasWsolBalance(false);
        setSetupStep('not_joined');
      }
    } catch (error) {
      console.error('Error checking user status:', error);
      setHasJoined(false);
      setHasWsolBalance(false);
      setUserState(null);
      setSetupStep('not_joined');
    }
  }, [sdk, publicKey]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    setOverlayDismissed(false);
  }, [setupStep, publicKey?.toBase58()]);

  const handleJoin = async () => {
    if (!sdk) return;
    setIsLoading(true);

    try {
      const result = await sdk.join();
      toast.success('Join transaction submitted');
      console.log('Join transaction:', result.signature);
      await checkStatus();
    } catch (error: any) {
      console.error('Join error:', error);
      const message = error?.message || String(error);
      if (message.toLowerCase().includes('already in use')) {
        toast('UserState already exists. Refreshing status...');
        await checkStatus();
      } else {
        toast.error(message || 'Failed to join');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSetup = async () => {
    if (!sdk) return;
    setIsLoading(true);

    try {
      // If UserState already exists (join-only path), create wSOL via addMint instead of
      // calling completeSetup again (which would re-init UserState and fail).
      let result;
      if (hasJoined) {
        result = await sdk.addMint(WSOL_MINT);
        toast.success('wSOL balance PDA created');
        console.log('wSOL add-mint transaction:', result.signature);
      } else {
        result = await sdk.completeSetup([]);
        toast.success('Setup complete (wSOL enabled)');
        console.log('Complete setup transaction:', result.signature);
      }
      await checkStatus();
    } catch (error: any) {
      console.error('Complete setup error:', error);
      const message = error?.message || String(error);
      if (message.toLowerCase().includes('already in use')) {
        toast('Setup account already exists. Refreshing status...');
        await checkStatus();
      } else {
        toast.error(message || 'Failed to complete setup');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const overlayVisible =
    publicKey && hasJoined !== null && setupStep !== 'completed' && !overlayDismissed;

  return (
    <>
      <SetupOverlay
        visible={!!overlayVisible}
        step={setupStep}
        isLoading={isLoading}
        onJoin={handleJoin}
        onQuickSetup={handleQuickSetup}
        onFullSetup={() => setShowSetupModal(true)}
        onDismiss={() => setOverlayDismissed(true)}
      />

      <GlassPanel className="p-6 md:p-7">
        <SectionHeader
          eyebrow="Identity"
          title="Treasury Identity"
          subtitle="UserState + wSOL readiness determine whether your treasury is initialized for agent operations."
          action={
            <LuxuryButton
              variant="secondary"
              className="px-4 py-2"
              onClick={() => checkStatus()}
              disabled={isLoading}
            >
              Refresh
            </LuxuryButton>
          }
        />

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Treasury Status"
            value={
              hasJoined === null ? 'Checking' : hasJoined ? 'Created' : 'Not Created'
            }
            tone={hasJoined ? 'green' : 'amber'}
          />
          <MetricCard
            label="Base Asset"
            value={
              hasWsolBalance === null
                ? 'Checking'
                : hasWsolBalance
                ? 'Ready'
                : 'Missing'
            }
            tone={hasWsolBalance ? 'green' : hasWsolBalance === null ? 'default' : 'amber'}
          />
          <MetricCard
            label="State Version"
            value={userState ? userState.stateVersion.toString() : '—'}
            tone="default"
            mono
          />
        </div>

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-white/8 bg-black/35 p-4">
            <div className="flex flex-wrap items-center gap-2">
              {setupStep === 'completed' ? (
                <Pill tone="green">Setup Complete</Pill>
              ) : setupStep === 'joined_no_wsol' ? (
                <Pill tone="amber">Join Completed · Setup Pending</Pill>
              ) : (
                <Pill tone="amber">Initialization Required</Pill>
              )}
              <Pill>wSOL Default Mint Included</Pill>
            </div>
            {publicKey ? (
              <p className="mt-3 text-xs text-zinc-400">
                Connected owner:{' '}
                <span className="font-mono text-zinc-300">
                  {truncateAddress(publicKey.toBase58(), 12, 10)}
                </span>
              </p>
            ) : null}
            {userState ? (
              <p className="mt-1 text-xs text-zinc-500">
                UserState owner:{' '}
                <span className="font-mono text-zinc-400">
                  {truncateAddress(userState.owner.toBase58(), 12, 10)}
                </span>
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <LuxuryButton
              fullWidth
              variant="secondary"
              onClick={handleJoin}
              isLoading={isLoading}
              disabled={!sdk || hasJoined === true}
            >
              {hasJoined ? 'Treasury Exists' : 'Create Treasury'}
            </LuxuryButton>
            <LuxuryButton
              fullWidth
              onClick={() => setShowSetupModal(true)}
              isLoading={isLoading}
              disabled={!sdk}
            >
              Add Assets
            </LuxuryButton>
          </div>

          {setupStep === 'joined_no_wsol' ? (
            <LuxuryButton
              fullWidth
              variant="secondary"
              onClick={handleQuickSetup}
              isLoading={isLoading}
              disabled={!sdk}
            >
              Add wSOL Asset
            </LuxuryButton>
          ) : null}
        </div>
      </GlassPanel>

      <CompleteSetupModal
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onComplete={checkStatus}
      />
    </>
  );
}

function MetricCard({
  label,
  value,
  tone = 'default',
  mono = false,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'green' | 'amber';
  mono?: boolean;
}) {
  const toneClasses =
    tone === 'green'
      ? 'text-emerald-100 border-emerald-300/10 bg-emerald-300/5'
      : tone === 'amber'
      ? 'text-amber-100 border-amber-300/10 bg-amber-300/5'
      : 'text-white border-white/8 bg-white/[0.02]';

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses}`}>
      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className={`mt-2 text-base ${mono ? 'font-mono text-sm' : ''}`}>{value}</p>
    </div>
  );
}

function SetupOverlay({
  visible,
  step,
  isLoading,
  onJoin,
  onQuickSetup,
  onFullSetup,
  onDismiss,
}: {
  visible: boolean;
  step: SetupStep;
  isLoading: boolean;
  onJoin: () => Promise<void>;
  onQuickSetup: () => Promise<void>;
  onFullSetup: () => void;
  onDismiss: () => void;
}) {
  if (!visible) return null;

  const notJoined = step === 'not_joined';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" />
      <GlassPanel className="relative w-full max-w-2xl p-6 md:p-8" highlight>
        <div className="absolute right-4 top-4">
          <LuxuryButton variant="ghost" className="px-3 py-2" onClick={onDismiss}>
            Dismiss
          </LuxuryButton>
        </div>

        <div className="max-w-xl">
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-200/70">
            {notJoined ? 'Treasury Initialization' : 'Setup Continuation'}
          </p>
          <h2 className="mt-3 text-3xl text-white md:text-4xl">
            {notJoined ? 'Create Your Treasury' : 'Finish Treasury Setup'}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            {notJoined
              ? 'Initialize your Sable treasury with a UserState PDA and balance accounts. When delegated to PER, your balances remain private — only you can read them.'
              : 'Your treasury identity exists, but the default wSOL balance PDA is still missing. Complete setup to enable agent funding and private transfers.'}
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-black/35 p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Base Asset</p>
            <p className="mt-2 font-mono text-amber-100">{WSOL_MINT.toBase58()}</p>
            <p className="mt-2 text-xs text-zinc-500">wSOL is included by default for gas and base operations.</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/35 p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Privacy</p>
            <p className="mt-2 text-white">Balances hidden when delegated to PER</p>
            <p className="mt-2 text-xs text-zinc-500">Delegation moves state to MagicBlock ER with private read semantics.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {notJoined ? (
            <LuxuryButton fullWidth variant="secondary" onClick={onJoin} isLoading={isLoading}>
              Create Identity
            </LuxuryButton>
          ) : (
            <LuxuryButton fullWidth variant="secondary" onClick={onQuickSetup} isLoading={isLoading}>
              Add wSOL
            </LuxuryButton>
          )}
          <LuxuryButton fullWidth onClick={onFullSetup} isLoading={isLoading}>
            Add Assets
          </LuxuryButton>
          <LuxuryButton fullWidth variant="ghost" onClick={onDismiss}>
            Continue Browsing
          </LuxuryButton>
        </div>
      </GlassPanel>
    </div>
  );
}
