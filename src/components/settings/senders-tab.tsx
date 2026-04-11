'use client';

import { Mail, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface SenderClient {
  id: string;
  name: string;
  sender_name: string | null;
  sender_email: string | null;
  logo_url: string | null;
}

interface SendersTabProps {
  clients: SenderClient[];
  locale: string;
}

export function SendersTab({ clients, locale }: SendersTabProps) {
  const configured = clients.filter((c) => c.sender_name && c.sender_email);
  const unconfigured = clients.filter((c) => !c.sender_name || !c.sender_email);

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="rounded-xl border border-hpr-gold/20 bg-hpr-gold/5 p-4">
        <div className="flex gap-3">
          <Mail className="h-4 w-4 text-hpr-gold mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Configuration des expéditeurs</p>
            <p className="text-xs text-muted-foreground mt-1">
              Chaque client peut avoir un expéditeur email dédié (nom + adresse).
              Ces informations sont configurées dans la fiche de chaque client.
              Pour que les emails arrivent bien, l'adresse doit être vérifiée dans Resend.
            </p>
          </div>
        </div>
      </div>

      {/* Configured */}
      {configured.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Configurés ({configured.length})
          </h3>
          <div className="space-y-2">
            {configured.map((client) => (
              <div
                key={client.id}
                className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {client.logo_url ? (
                    <img src={client.logo_url} alt={client.name} className="h-7 w-7 rounded object-contain" />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-white/5 text-xs font-bold text-muted-foreground">
                      {client.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">{client.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {client.sender_name} &lt;{client.sender_email}&gt;
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Configuré
                  </span>
                  <a
                    href={`/${locale}/clients/${client.id}`}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Modifier <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unconfigured */}
      {unconfigured.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            À configurer ({unconfigured.length})
          </h3>
          <div className="space-y-2">
            {unconfigured.map((client) => (
              <div
                key={client.id}
                className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 opacity-60"
              >
                <div className="flex items-center gap-3">
                  {client.logo_url ? (
                    <img src={client.logo_url} alt={client.name} className="h-7 w-7 rounded object-contain" />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-white/5 text-xs font-bold text-muted-foreground">
                      {client.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <p className="text-sm font-medium text-foreground">{client.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-orange-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Expéditeur manquant
                  </span>
                  <a
                    href={`/${locale}/clients/${client.id}`}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Configurer <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {clients.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
          <Mail className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Aucun client créé</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Ajoutez des clients pour configurer leurs expéditeurs email.
          </p>
        </div>
      )}
    </div>
  );
}
