import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import {
  Search, ShieldCheck, Newspaper, CheckCircle2,
  XCircle, Clock, Users, Mail,
} from 'lucide-react';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('improvements');
  return { title: t('title') };
}

type TaskType = 'hunter_finder' | 'hunter_verifier' | 'google_news';

interface BackgroundTask {
  id: string;
  type: TaskType;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at: string | null;
  total: number;
  processed: number;
  found: number;
  skipped: number;
  failed_count: number;
  credits_used: number;
  error_message: string | null;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(start: string, end: string | null) {
  if (!end) return 'en cours…';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}min`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
      <CheckCircle2 className="h-2.5 w-2.5" /> Terminé
    </span>
  );
  if (status === 'failed') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
      <XCircle className="h-2.5 w-2.5" /> Échec
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
      <Clock className="h-2.5 w-2.5 animate-spin" /> En cours
    </span>
  );
}

function ProgressBar({ value, max, color = 'bg-hpr-gold' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{value.toLocaleString('fr-FR')} / {max.toLocaleString('fr-FR')}</span>
        <span className="font-medium text-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RunsHistory({ runs }: { runs: BackgroundTask[] }) {
  if (runs.length === 0) return (
    <p className="text-xs text-muted-foreground/60 italic">Aucun run encore</p>
  );
  return (
    <div className="space-y-1.5">
      {runs.map((run) => (
        <div key={run.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-white/[0.04] last:border-0">
          <StatusBadge status={run.status} />
          <span className="text-muted-foreground flex-1">{formatDate(run.started_at)}</span>
          <span className="text-muted-foreground/60">{formatDuration(run.started_at, run.completed_at)}</span>
          {run.status === 'completed' && run.found > 0 && (
            <span className="text-emerald-400 font-medium">+{run.found}</span>
          )}
          {run.status === 'completed' && run.credits_used > 0 && (
            <span className="text-muted-foreground/50">{run.credits_used} crédits</span>
          )}
          {run.status === 'failed' && run.error_message && (
            <span className="text-red-400/70 truncate max-w-[160px]" title={run.error_message}>
              {run.error_message}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default async function ImprovementsPage() {
  const t = await getTranslations('improvements');
  const supabase = await createClient();

  // Stats journalistes — comptages directs en base (évite la limite PostgREST ~1000 lignes)
  const [
    { count: total },
    { count: with_email },
    { count: to_search },
    { count: hunter_tried },
    { count: verified },
  ] = await Promise.all([
    supabase.from('journalists').select('*', { count: 'exact', head: true }).eq('is_opted_out', false),
    supabase.from('journalists').select('*', { count: 'exact', head: true }).eq('is_opted_out', false).not('email', 'is', null),
    supabase.from('journalists').select('*', { count: 'exact', head: true }).eq('is_opted_out', false).is('email', null).not('tags', 'cs', '{"hunter-tried"}'),
    supabase.from('journalists').select('*', { count: 'exact', head: true }).eq('is_opted_out', false).is('email', null).contains('tags', ['hunter-tried']),
    supabase.from('journalists').select('*', { count: 'exact', head: true }).eq('is_opted_out', false).not('email', 'is', null).or('tags.cs.{"email-verified"},tags.cs.{"validate"},tags.cs.{"via-hunter"}'),
  ]);

  const stats = {
    total: total ?? 0,
    with_email: with_email ?? 0,
    to_search: to_search ?? 0,
    hunter_tried: hunter_tried ?? 0,
    verified: verified ?? 0,
  };

  // Historique des tâches (10 derniers runs par type)
  const taskTypes: TaskType[] = ['hunter_finder', 'hunter_verifier', 'google_news'];
  const taskRuns: Record<TaskType, BackgroundTask[]> = {
    hunter_finder: [],
    hunter_verifier: [],
    google_news: [],
  };

  for (const type of taskTypes) {
    const { data } = await supabase
      .from('background_tasks')
      .select('*')
      .eq('type', type)
      .order('started_at', { ascending: false })
      .limit(8);
    taskRuns[type] = (data ?? []) as BackgroundTask[];
  }

  const lastRun = (type: TaskType) => taskRuns[type][0] ?? null;
  const nextSchedule: Record<TaskType, string> = {
    hunter_finder: 'Toutes les 4h',
    hunter_verifier: 'Quotidien à 7h',
    google_news: 'Quotidien à 12h',
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Stats globales journalistes */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="border border-white/[0.08] bg-white/[0.02] rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-xs">Journalistes</span>
          </div>
          <p className="text-2xl font-bold font-display text-foreground">{stats.total.toLocaleString('fr-FR')}</p>
        </div>
        <div className="border border-white/[0.08] bg-white/[0.02] rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span className="text-xs">Avec email</span>
          </div>
          <p className="text-2xl font-bold font-display text-emerald-400">{stats.with_email.toLocaleString('fr-FR')}</p>
          <p className="text-xs text-muted-foreground">{stats.total > 0 ? Math.round((stats.with_email / stats.total) * 100) : 0}%</p>
        </div>
        <div className="border border-white/[0.08] bg-white/[0.02] rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Search className="h-4 w-4" />
            <span className="text-xs">À rechercher</span>
          </div>
          <p className="text-2xl font-bold font-display text-hpr-gold">{stats.to_search.toLocaleString('fr-FR')}</p>
          <p className="text-xs text-muted-foreground">{stats.hunter_tried} déjà essayés</p>
        </div>
        <div className="border border-white/[0.08] bg-white/[0.02] rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-xs">Emails vérifiés</span>
          </div>
          <p className="text-2xl font-bold font-display text-blue-400">{stats.verified.toLocaleString('fr-FR')}</p>
          <p className="text-xs text-muted-foreground">{stats.with_email > 0 ? Math.round((stats.verified / stats.with_email) * 100) : 0}% des emails</p>
        </div>
      </div>

      {/* Tâches en fond */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Tâches automatiques</h2>

        {/* Hunter Finder */}
        <div className="border border-white/[0.08] bg-white/[0.02] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-hpr-gold/10">
                  <Search className="h-4 w-4 text-hpr-gold" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Recherche d'emails (Hunter Finder)</p>
                  <p className="text-xs text-muted-foreground">Trouve les emails manquants · {nextSchedule.hunter_finder}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {lastRun('hunter_finder') && <StatusBadge status={lastRun('hunter_finder')!.status} />}
                {lastRun('hunter_finder') && (
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    Dernier run : {formatDate(lastRun('hunter_finder')!.started_at)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Progression</p>
              <ProgressBar
                value={stats.with_email}
                max={stats.total}
                color="bg-hpr-gold"
              />
              <p className="text-xs text-muted-foreground">
                {stats.to_search > 0
                  ? <span className="text-hpr-gold">{stats.to_search} email{stats.to_search > 1 ? 's' : ''} restant{stats.to_search > 1 ? 's' : ''} à trouver</span>
                  : <span className="text-emerald-400">Tous les emails trouvables ont été traités ✓</span>
                }
                {stats.hunter_tried > 0 && <span className="ml-2 text-muted-foreground/60">({stats.hunter_tried} introuvables)</span>}
              </p>
            </div>
            {taskRuns.hunter_finder.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Historique des runs</p>
                <RunsHistory runs={taskRuns.hunter_finder} />
              </div>
            )}
            {taskRuns.hunter_finder.length === 0 && (
              <p className="text-xs text-muted-foreground/60 italic">Premier run dans moins de 4h</p>
            )}
          </div>
        </div>

        {/* Hunter Verifier */}
        <div className="border border-white/[0.08] bg-white/[0.02] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                  <ShieldCheck className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Vérification d'emails (Hunter Verifier)</p>
                  <p className="text-xs text-muted-foreground">Valide les emails existants · {nextSchedule.hunter_verifier}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {lastRun('hunter_verifier') && <StatusBadge status={lastRun('hunter_verifier')!.status} />}
                {lastRun('hunter_verifier') && (
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    Dernier run : {formatDate(lastRun('hunter_verifier')!.started_at)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Progression</p>
              <ProgressBar
                value={stats.verified}
                max={stats.with_email}
                color="bg-blue-400"
              />
              {stats.with_email - stats.verified > 0
                ? <p className="text-xs text-blue-400">{(stats.with_email - stats.verified).toLocaleString('fr-FR')} emails à vérifier</p>
                : <p className="text-xs text-emerald-400">Tous les emails sont vérifiés ✓</p>
              }
            </div>
            {taskRuns.hunter_verifier.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Historique des runs</p>
                <RunsHistory runs={taskRuns.hunter_verifier} />
              </div>
            )}
            {taskRuns.hunter_verifier.length === 0 && (
              <p className="text-xs text-muted-foreground/60 italic">Premier run demain à 7h</p>
            )}
          </div>
        </div>

        {/* Google News Monitor */}
        <div className="border border-white/[0.08] bg-white/[0.02] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Newspaper className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Monitoring Google News</p>
                  <p className="text-xs text-muted-foreground">Détecte les retombées presse · {nextSchedule.google_news}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {lastRun('google_news') && <StatusBadge status={lastRun('google_news')!.status} />}
                {lastRun('google_news') && (
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    Dernier run : {formatDate(lastRun('google_news')!.started_at)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="px-5 py-4 space-y-4">
            {taskRuns.google_news.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Historique des runs</p>
                <RunsHistory runs={taskRuns.google_news} />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/60 italic">Premier run aujourd&apos;hui à 12h</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
