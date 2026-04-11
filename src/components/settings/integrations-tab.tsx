'use client';

import * as React from 'react';
import { Mail, Brain, MessageSquare, CheckCircle2, XCircle, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  testResendConnectionAction,
  testAnthropicConnectionAction,
  updateSlackWebhookAction,
} from '@/app/[locale]/(dashboard)/settings/actions';

interface IntegrationsTabProps {
  slackWebhookUrl: string | null;
}

type ConnectionStatus = 'idle' | 'testing' | 'ok' | 'error';

interface ApiCardProps {
  icon: React.ReactNode;
  name: string;
  description: string;
  envVar: string;
  onTest: () => Promise<{ ok: boolean; message: string }>;
}

function ApiCard({ icon, name, description, envVar, onTest }: ApiCardProps) {
  const [status, setStatus] = React.useState<ConnectionStatus>('idle');
  const [message, setMessage] = React.useState('');

  async function handleTest() {
    setStatus('testing');
    const result = await onTest();
    setStatus(result.ok ? 'ok' : 'error');
    setMessage(result.message);
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5">
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{name}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === 'ok' && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {message}
            </span>
          )}
          {status === 'error' && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <XCircle className="h-3.5 w-3.5" />
              {message}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={status === 'testing'}
            className="text-xs"
          >
            {status === 'testing' ? (
              <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Test...</>
            ) : (
              'Tester la connexion'
            )}
          </Button>
        </div>
      </div>
      <div className="mt-3 rounded-md bg-white/[0.03] px-3 py-2">
        <p className="text-[11px] font-mono text-muted-foreground">{envVar}</p>
      </div>
    </div>
  );
}

export function IntegrationsTab({ slackWebhookUrl }: IntegrationsTabProps) {
  const [webhook, setWebhook] = React.useState(slackWebhookUrl ?? '');
  const [slackResult, setSlackResult] = React.useState<{ success?: boolean; error?: string } | null>(null);
  const [slackPending, setSlackPending] = React.useState(false);

  async function handleSlackSave() {
    setSlackPending(true);
    setSlackResult(null);
    const result = await updateSlackWebhookAction(webhook);
    setSlackResult(result);
    setSlackPending(false);
  }

  return (
    <div className="space-y-4">
      <ApiCard
        icon={<Mail className="h-4 w-4 text-blue-400" />}
        name="Resend"
        description="Envoi d'emails transactionnels et tracking"
        envVar="RESEND_API_KEY"
        onTest={testResendConnectionAction}
      />

      <ApiCard
        icon={<Brain className="h-4 w-4 text-hpr-gold" />}
        name="Anthropic Claude"
        description="IA pour la rédaction et l'analyse"
        envVar="ANTHROPIC_API_KEY"
        onTest={testAnthropicConnectionAction}
      />

      {/* Slack */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5">
            <MessageSquare className="h-4 w-4 text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Slack</p>
            <p className="text-xs text-muted-foreground">Notifications dans votre workspace Slack</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="slack_webhook">URL du webhook entrant</Label>
            <Input
              id="slack_webhook"
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Créez un webhook dans les paramètres de votre app Slack.
            </p>
          </div>
          <div className="flex items-center justify-between">
            {slackResult?.success && (
              <p className="flex items-center gap-1.5 text-xs text-green-400">
                <Check className="h-3.5 w-3.5" /> Enregistré
              </p>
            )}
            {slackResult?.error && (
              <p className="flex items-center gap-1.5 text-xs text-red-400">
                <AlertCircle className="h-3.5 w-3.5" /> {slackResult.error}
              </p>
            )}
            {!slackResult && <span />}
            <Button size="sm" onClick={handleSlackSave} disabled={slackPending}>
              {slackPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
