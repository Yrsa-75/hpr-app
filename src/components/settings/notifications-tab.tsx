'use client';

import * as React from 'react';
import { Bell, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { updateNotificationPreferencesAction } from '@/app/[locale]/(dashboard)/settings/actions';

const NOTIFICATION_TYPES = [
  {
    key: 'journalist_replied',
    label: 'Réponse d\'un journaliste',
    description: 'Quand un journaliste répond à un de vos emails',
  },
  {
    key: 'article_published',
    label: 'Article publié',
    description: 'Quand une retombée presse est détectée',
  },
  {
    key: 'campaign_milestone',
    label: 'Jalons de campagne',
    description: 'Quand une campagne atteint un seuil d\'ouvertures ou de clics',
  },
  {
    key: 'approval_needed',
    label: 'Validation requise',
    description: 'Quand un communiqué attend votre approbation',
  },
  {
    key: 'system_alert',
    label: 'Alertes système',
    description: 'Erreurs d\'envoi, bounces excessifs, problèmes techniques',
  },
  {
    key: 'improvement_ready',
    label: 'Améliorations disponibles',
    description: 'Quand une boucle d\'amélioration a de nouvelles recommandations',
  },
] as const;

interface NotificationsTabProps {
  preferences: Record<string, boolean>;
}

export function NotificationsTab({ preferences }: NotificationsTabProps) {
  const [prefs, setPrefs] = React.useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    NOTIFICATION_TYPES.forEach(({ key }) => {
      defaults[key] = preferences[key] !== false; // default ON
    });
    return defaults;
  });
  const [result, setResult] = React.useState<{ success?: boolean; error?: string } | null>(null);
  const [pending, setPending] = React.useState(false);

  function toggle(key: string) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
    setResult(null);
  }

  async function handleSave() {
    setPending(true);
    setResult(null);
    const res = await updateNotificationPreferencesAction(prefs);
    setResult(res);
    setPending(false);
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="flex items-center gap-2 mb-6 text-sm font-medium text-foreground">
        <Bell className="h-4 w-4 text-muted-foreground" />
        Préférences de notifications
      </div>

      <div className="space-y-1">
        {NOTIFICATION_TYPES.map(({ key, label, description }) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            className="w-full flex items-center justify-between rounded-lg px-4 py-3 hover:bg-white/5 transition-colors text-left"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
            <div
              className={`relative ml-4 h-5 w-9 shrink-0 rounded-full transition-colors ${
                prefs[key] ? 'bg-hpr-gold' : 'bg-white/10'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  prefs[key] ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 mt-2 border-t border-white/[0.06]">
        {result?.success && (
          <p className="flex items-center gap-1.5 text-xs text-green-400">
            <Check className="h-3.5 w-3.5" /> Préférences enregistrées
          </p>
        )}
        {result?.error && (
          <p className="flex items-center gap-1.5 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5" /> {result.error}
          </p>
        )}
        {!result && <span />}
        <Button size="sm" onClick={handleSave} disabled={pending}>
          {pending ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  );
}
