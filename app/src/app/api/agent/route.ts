import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deterministicPlan, normalizeAgentPlan } from '@/agent/planner';
import {
  buildClarificationPlan,
  buildOutOfScopePlan,
  classifySableScope,
} from '@/agent/scope';
import type { AgentProvider, AgentToolContext } from '@/agent/types';

export const runtime = 'nodejs';

const actionTypeSchema = z.enum([
  'CREATE_TREASURY',
  'COMPLETE_SETUP',
  'ADD_WS0L_BALANCE',
  'ADD_MINT',
  'DEPOSIT',
  'INTERNAL_TRANSFER',
  'BATCH_TRANSFER',
  'EXTERNAL_SEND',
  'DELEGATE',
  'COMMIT_UNDELEGATE',
  'WITHDRAW',
  'EXPLAIN_BALANCES',
  'SHOW_SETTINGS',
  'OUT_OF_SCOPE',
  'CLARIFY_SABLE_ACTION',
  'UNKNOWN',
]);

const planSchema = z.object({
  actionType: actionTypeSchema,
  domain: z.enum(['sable_protocol', 'out_of_scope', 'ambiguous']).optional(),
  summary: z.string().min(1),
  amount: z.string().optional(),
  mint: z.string().optional(),
  mintSymbol: z.string().optional(),
  recipient: z.string().optional(),
  recipients: z.array(z.object({ address: z.string(), amount: z.string().optional() })).optional(),
  destinationAta: z.string().optional(),
  route: z.enum(['Direct Anchor', 'MagicBlock Router', 'ER', 'Read only', 'Unknown']).optional(),
  requiresTransaction: z.boolean().optional(),
  missingFields: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
});

const requestSchema = z.object({
  message: z.string().min(1).max(2000),
  context: z.custom<Partial<AgentToolContext>>().optional(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid agent request' }, { status: 400 });
  }

  const provider = providerFromEnv();
  const model = process.env.SABLE_AGENT_LLM_MODEL || defaultModel(provider);
  const scope = classifySableScope(parsed.data.message, parsed.data.context);

  if (scope.domain === 'out_of_scope') {
    return NextResponse.json({
      provider: 'deterministic',
      model: 'scope-classifier',
      plan: buildOutOfScopePlan(parsed.data.message),
      usedFallback: true,
      scope,
    });
  }

  if (scope.domain === 'ambiguous') {
    return NextResponse.json({
      provider: 'deterministic',
      model: 'scope-classifier',
      plan: buildClarificationPlan(parsed.data.message),
      usedFallback: true,
      scope,
    });
  }

  const deterministic = deterministicPlan(parsed.data.message, parsed.data.context);

  if (provider === 'none' || !process.env.SABLE_AGENT_LLM_API_KEY) {
    return NextResponse.json({
      provider: 'deterministic',
      model: 'rule-based',
      plan: deterministic,
      usedFallback: true,
    });
  }

  try {
    const llmPlan = await callProvider({
      provider,
      model,
      message: parsed.data.message,
      context: safeContext(parsed.data.context),
      deterministic,
    });
    const plan = normalizeAgentPlan(llmPlan, parsed.data.message);
    return NextResponse.json({ provider, model, plan, usedFallback: false });
  } catch {
    return NextResponse.json({
      provider: 'deterministic',
      model: 'rule-based',
      plan: deterministic,
      usedFallback: true,
    });
  }
}

function providerFromEnv(): AgentProvider {
  const raw = (process.env.SABLE_AGENT_LLM_PROVIDER || 'none').toLowerCase();
  if (raw === 'deepseek' || raw === 'gemini' || raw === 'groq' || raw === 'none') return raw;
  return 'none';
}

function defaultModel(provider: AgentProvider) {
  if (provider === 'gemini') return 'gemini-2.5-flash-lite';
  if (provider === 'groq') return 'llama-3.1-8b-instant';
  if (provider === 'deepseek') return 'deepseek-chat';
  return 'rule-based';
}

async function callProvider(params: {
  provider: AgentProvider;
  model: string;
  message: string;
  context: unknown;
  deterministic: unknown;
}) {
  const prompt = [
    'You are Sable Agent Chat. Return strict JSON only.',
    'You are Sable Agent, not a general assistant.',
    'Only return structured JSON for Sable protocol actions.',
    'If request is out of scope, return { "actionType": "OUT_OF_SCOPE", "domain": "out_of_scope", "summary": "I can only help with Sable treasury actions inside this app: setup, assets, deposits, transfers, delegation, commit/undelegate, withdrawals, and settings." }.',
    'Do not answer general knowledge questions.',
    'Do not provide investment advice.',
    'Do not discuss unrelated topics.',
    'Do not output markdown chat unless schema requires a short user-facing message.',
    'Never claim you can sign, hold keys, or execute without wallet approval.',
    'Choose one supported action and fill only fields present or confidently inferred.',
    'Supported actions: CREATE_TREASURY, COMPLETE_SETUP, ADD_WS0L_BALANCE, ADD_MINT, DEPOSIT, INTERNAL_TRANSFER, BATCH_TRANSFER, EXTERNAL_SEND, DELEGATE, COMMIT_UNDELEGATE, WITHDRAW, EXPLAIN_BALANCES, SHOW_SETTINGS, OUT_OF_SCOPE, CLARIFY_SABLE_ACTION, UNKNOWN.',
    `Safe public context: ${JSON.stringify(params.context)}`,
    `Deterministic draft: ${JSON.stringify(params.deterministic)}`,
    `User message: ${params.message}`,
  ].join('\n');

  const content =
    params.provider === 'gemini'
      ? await callGemini(params.model, prompt)
      : await callOpenAiCompatible(params.provider, params.model, prompt);
  const json = parseJsonObject(content);
  return planSchema.parse(json);
}

async function callOpenAiCompatible(provider: AgentProvider, model: string, prompt: string) {
  const baseUrl =
    process.env.SABLE_AGENT_LLM_BASE_URL ||
    (provider === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://api.deepseek.com');
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.SABLE_AGENT_LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature: Number(process.env.SABLE_AGENT_TEMPERATURE ?? 0),
      max_tokens: Number(process.env.SABLE_AGENT_MAX_TOKENS ?? 700),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Return only one JSON object matching the requested schema.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!response.ok) throw new Error('LLM provider failed');
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGemini(model: string, prompt: string) {
  const baseUrl = process.env.SABLE_AGENT_LLM_BASE_URL || 'https://generativelanguage.googleapis.com';
  const response = await fetch(
    `${baseUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent?key=${process.env.SABLE_AGENT_LLM_API_KEY}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        generationConfig: {
          temperature: Number(process.env.SABLE_AGENT_TEMPERATURE ?? 0),
          maxOutputTokens: Number(process.env.SABLE_AGENT_MAX_TOKENS ?? 700),
          responseMimeType: 'application/json',
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      }),
    }
  );
  if (!response.ok) throw new Error('Gemini provider failed');
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function parseJsonObject(content: string) {
  const trimmed = content.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Malformed JSON');
  return JSON.parse(trimmed.slice(start, end + 1));
}

function safeContext(context?: Partial<AgentToolContext>) {
  if (!context) return {};
  return {
    walletConnected: context.walletConnected,
    walletPubkey: context.walletPubkey,
    userStateExists: context.userStateExists,
    knownMints: context.knownMints,
    selectedMint: context.selectedMint,
    usdcMint: context.usdcMint,
    wsolMint: context.wsolMint,
    routingMode: context.routingMode,
    magicBlockAvailable: context.magicBlockAvailable,
    settings: context.settings,
  };
}
