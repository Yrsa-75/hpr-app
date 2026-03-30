'use client';

import * as React from 'react';
import {
  Inbox,
  ChevronRight,
  Sparkles,
  Send,
  CheckCheck,
  RefreshCw,
  Loader2,
  MailOpen,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  replyToThreadAction,
  updateThreadStatusAction,
  reAnalyzeThreadAction,
} from '@/app/[locale]/(dashboard)/inbox/actions';
import type { EmailThreadRow, EmailMessageRow } from '@/types/database';

// Extended types with joins
export interface ThreadWithJoins extends EmailThreadRow {
  journalists: {
    first_name: string;
    last_name: string;
    email: string;
    media_outlet: string | null;
  } | null;
  campaigns: {
    id: string;
    name: string;
    clients: { name: string } | null;
  } | null;
  email_messages: EmailMessageRow[];
}

interface InboxViewProps {
  threads: ThreadWithJoins[];
}

const SENTIMENT_CONFIG = {
  positive: { label: 'Positif', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  interested: { label: 'Intéressé', color: 'text-hpr-gold', bg: 'bg-hpr-gold/10 border-hpr-gold/20' },
  neutral: { label: 'Neutre', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  negative: { label: 'Négatif', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  not_interested: { label: 'Pas intéressé', color: 'text-muted-foreground', bg: 'bg-white/5 border-white/10' },
} as const;

const STATUS_CONFIG = {
  new: { label: 'Nouveau', color: 'text-hpr-gold', dot: 'bg-hpr-gold' },
  needs_response: { label: 'À traiter', color: 'text-amber-400', dot: 'bg-amber-400' },
  responded: { label: 'Répondu', color: 'text-emerald-400', dot: 'bg-emerald-400' },
  follow_up_scheduled: { label: 'Relance planifiée', color: 'text-blue-400', dot: 'bg-blue-400' },
  closed: { label: 'Fermé', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  positive: { label: 'Positif', color: 'text-emerald-400', dot: 'bg-emerald-400' },
  negative: { label: 'Négatif', color: 'text-red-400', dot: 'bg-red-400' },
} as const;

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `${mins} min`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function ThreadListItem({
  thread,
  selected,
  isRead,
  onClick,
}: {
  thread: ThreadWithJoins;
  selected: boolean;
  isRead: boolean;
  onClick: () => void;
}) {
  const j = thread.journalists;
  const lastMsg = thread.email_messages[thread.email_messages.length - 1];
  const preview = lastMsg?.body_plain?.slice(0, 100).replace(/\s+/g, ' ') ?? '';
  const statusCfg = STATUS_CONFIG[thread.status] ?? STATUS_CONFIG.new;
  const sentimentCfg = thread.sentiment ? SENTIMENT_CONFIG[thread.sentiment] : null;
  const showDot = !isRead && (thread.status === 'new' || thread.status === 'needs_response');

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-white/[0.04] transition-colors ${
        selected
          ? 'bg-hpr-gold/5 border-l-2 border-l-hpr-gold'
          : 'hover:bg-white/[0.03] border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${showDot ? statusCfg.dot : 'bg-transparent'}`} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {j ? `${j.first_name} ${j.last_name}` : '—'}
            </p>
            {j?.media_outlet && (
              <p className="text-xs text-muted-foreground/70 truncate">{j.media_outlet}</p>
            )}
          </div>
        </div>
        <span className="text-[11px] text-muted-foreground/50 shrink-0">
          {formatRelative(thread.updated_at)}
        </span>
      </div>
      <div className="ml-4 mt-1 space-y-1">
        {preview && (
          <p className="text-xs text-muted-foreground/50 truncate">{preview}</p>
        )}
        {sentimentCfg && (
          <span className={`inline-block text-[10px] px-1.5 py-0 rounded border ${sentimentCfg.bg} ${sentimentCfg.color}`}>
            {sentimentCfg.label}
          </span>
        )}
      </div>
    </button>
  );
}

function MessageBubble({ message }: { message: EmailMessageRow }) {
  const isInbound = message.direction === 'inbound';
  const text = message.body_plain ?? '';

  return (
    <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
          isInbound
            ? 'bg-white/[0.05] border border-white/[0.08] text-foreground/90'
            : 'bg-hpr-gold/10 border border-hpr-gold/20 text-foreground/90'
        }`}
      >
        {isInbound && message.body_html ? (
          <div
            className="prose prose-invert prose-sm max-w-none text-sm"
            dangerouslySetInnerHTML={{ __html: message.body_html }}
          />
        ) : (
          <p className="whitespace-pre-wrap">{text}</p>
        )}
        <p className={`text-[11px] mt-1.5 ${isInbound ? 'text-muted-foreground/50' : 'text-hpr-gold/50'}`}>
          {new Date(message.created_at).toLocaleString('fr-FR', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
          })}
          {isInbound && message.is_auto_reply && ' · Réponse automatique'}
        </p>
      </div>
    </div>
  );
}

function ThreadDetail({ thread, onBack }: { thread: ThreadWithJoins; onBack: () => void }) {
  const { toast } = useToast();
  const [replyText, setReplyText] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [isClosing, setIsClosing] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const j = thread.journalists;
  const sentimentCfg = thread.sentiment ? SENTIMENT_CONFIG[thread.sentiment] : null;

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.email_messages.length]);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setIsSending(true);
    try {
      const result = await replyToThreadAction(thread.id, replyText);
      if (result.success) {
        setReplyText('');
        toast({ title: 'Réponse envoyée' });
      } else {
        toast({ title: 'Erreur', description: result.error, variant: 'destructive' });
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleUseSuggestion = () => {
    if (thread.ai_suggested_response) {
      setReplyText(thread.ai_suggested_response);
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const result = await reAnalyzeThreadAction(thread.id);
      if (result.success) {
        toast({ title: 'Analyse IA mise à jour' });
      } else {
        toast({ title: 'Erreur', description: result.error, variant: 'destructive' });
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClose = async () => {
    setIsClosing(true);
    try {
      await updateThreadStatusAction(thread.id, 'closed');
      toast({ title: 'Fil fermé' });
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] shrink-0">
        <button
          onClick={onBack}
          className="lg:hidden h-8 w-8 flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {j ? `${j.first_name} ${j.last_name}` : '—'}
            </p>
            {sentimentCfg && (
              <span className={`text-[10px] px-1.5 py-0 rounded border ${sentimentCfg.bg} ${sentimentCfg.color}`}>
                {sentimentCfg.label}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground/70 truncate">
            {j?.media_outlet && `${j.media_outlet} · `}{thread.campaigns?.name}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {thread.priority_score != null && (
            <span className="text-xs text-muted-foreground">
              Priorité{' '}
              <span className={`font-semibold ${thread.priority_score >= 70 ? 'text-hpr-gold' : thread.priority_score >= 40 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                {thread.priority_score}
              </span>
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClose}
            disabled={isClosing || thread.status === 'closed'}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            {isClosing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            <span className="ml-1 hidden sm:inline">Fermer</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-0">
        {/* Messages + reply */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {thread.email_messages.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                Aucun message dans ce fil.
              </div>
            ) : (
              thread.email_messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply input */}
          {thread.status !== 'closed' && (
            <div className="border-t border-white/[0.06] px-4 py-3 shrink-0 space-y-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Rédigez votre réponse..."
                rows={3}
                disabled={isSending}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-hpr-gold/50 resize-none disabled:opacity-50"
              />
              <div className="flex items-center justify-between">
                {thread.ai_suggested_response && !replyText && (
                  <button
                    onClick={handleUseSuggestion}
                    className="text-xs text-hpr-gold/70 hover:text-hpr-gold transition-colors flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3" />
                    Utiliser la suggestion IA
                  </button>
                )}
                {!thread.ai_suggested_response && <div />}
                <Button
                  size="sm"
                  variant="gold"
                  onClick={handleReply}
                  disabled={isSending || !replyText.trim()}
                  className="h-7 text-xs"
                >
                  {isSending ? (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="mr-1.5 h-3 w-3" />
                  )}
                  Envoyer
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* AI panel */}
        <div className="w-64 shrink-0 border-l border-white/[0.06] flex flex-col hidden xl:flex">
          <div className="px-3 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-hpr-gold" />
              Analyse IA
            </h4>
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-hpr-gold hover:bg-hpr-gold/5 transition-colors disabled:opacity-50"
              title="Ré-analyser"
            >
              {isAnalyzing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {thread.ai_suggested_response || thread.ai_response_strategy ? (
              <>
                {thread.ai_response_strategy && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Stratégie
                    </p>
                    <p className="text-xs text-foreground/80 leading-relaxed">
                      {thread.ai_response_strategy}
                    </p>
                  </div>
                )}

                {thread.ai_suggested_response && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Réponse suggérée
                    </p>
                    <div className="border border-white/[0.08] rounded-lg p-2.5 bg-white/[0.02]">
                      <p className="text-xs text-foreground/80 leading-relaxed">
                        {thread.ai_suggested_response}
                      </p>
                      <button
                        onClick={handleUseSuggestion}
                        className="mt-2 text-[10px] text-hpr-gold/70 hover:text-hpr-gold transition-colors"
                      >
                        ↗ Utiliser
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground">
                  {thread.email_messages.some((m) => m.direction === 'inbound')
                    ? 'Cliquez sur ↻ pour analyser ce fil.'
                    : 'En attente d\'une réponse du journaliste.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function InboxView({ threads }: InboxViewProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(
    threads[0]?.id ?? null
  );
  const [filter, setFilter] = React.useState<'all' | 'needs_response' | 'positive' | 'negative' | 'closed'>('all');
  const [showDetail, setShowDetail] = React.useState(false);
  const [readIds, setReadIds] = React.useState<Set<string>>(new Set());
  const [, startTransition] = React.useTransition();

  const filtered = threads.filter((t) => {
    if (filter === 'all') return t.status !== 'closed';
    if (filter === 'needs_response') return t.status === 'new' || t.status === 'needs_response';
    if (filter === 'positive') return t.sentiment === 'positive' || t.sentiment === 'interested';
    if (filter === 'negative') return t.sentiment === 'negative' || t.sentiment === 'not_interested';
    if (filter === 'closed') return t.status === 'closed';
    return true;
  });

  const selected = filtered.find((t) => t.id === selectedId) ?? filtered[0] ?? null;

  const counts = {
    needs_response: threads.filter((t) => (t.status === 'new' || t.status === 'needs_response') && !readIds.has(t.id)).length,
  };

  if (threads.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] border-dashed bg-white/[0.01] p-16 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
          <Inbox className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="font-display text-sm font-medium text-foreground mb-1">Aucune réponse</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Les réponses des journalistes apparaîtront ici une fois les emails envoyés.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-160px)] border border-white/[0.08] rounded-xl overflow-hidden">
      {/* Left panel — thread list */}
      <div className={`w-72 shrink-0 border-r border-white/[0.06] flex flex-col ${showDetail ? 'hidden lg:flex' : 'flex'}`}>
        {/* Filters */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-white/[0.06] overflow-x-auto">
          {([
            { key: 'all', label: 'Tous' },
            { key: 'needs_response', label: `À traiter${counts.needs_response > 0 ? ` (${counts.needs_response})` : ''}` },
            { key: 'positive', label: 'Positifs' },
            { key: 'negative', label: 'Négatifs' },
            { key: 'closed', label: 'Fermés' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`shrink-0 text-xs px-2.5 py-1 rounded-lg transition-colors ${
                filter === key
                  ? 'bg-hpr-gold/15 text-hpr-gold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.05]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Thread list grouped by campaign */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Aucun fil dans cette catégorie.
            </div>
          ) : (
            (() => {
              // Group threads by campaign
              const groups = new Map<string, { campaignName: string; clientName: string | null; threads: typeof filtered }>();
              for (const thread of filtered) {
                const key = thread.campaign_id ?? 'unknown';
                if (!groups.has(key)) {
                  groups.set(key, {
                    campaignName: thread.campaigns?.name ?? 'Campagne inconnue',
                    clientName: thread.campaigns?.clients?.name ?? null,
                    threads: [],
                  });
                }
                groups.get(key)!.threads.push(thread);
              }

              return Array.from(groups.entries()).map(([campaignId, group]) => (
                <div key={campaignId}>
                  {/* Campaign header */}
                  <div className="px-4 py-2 border-b border-white/[0.04] bg-white/[0.02] sticky top-0 z-10">
                    <p className="text-[11px] font-semibold text-foreground/70 truncate">
                      {group.campaignName}
                    </p>
                    {group.clientName && (
                      <p className="text-[10px] text-hpr-gold/60 truncate">{group.clientName}</p>
                    )}
                  </div>
                  {group.threads.map((thread) => (
                    <ThreadListItem
                      key={thread.id}
                      thread={thread}
                      selected={thread.id === selected?.id}
                      isRead={readIds.has(thread.id) || thread.status !== 'new'}
                      onClick={() => {
                        setSelectedId(thread.id);
                        setShowDetail(true);
                        if (thread.status === 'new' && !readIds.has(thread.id)) {
                          setReadIds((prev) => new Set([...prev, thread.id]));
                          startTransition(() => {
                            updateThreadStatusAction(thread.id, 'needs_response');
                          });
                        }
                      }}
                    />
                  ))}
                </div>
              ));
            })()
          )}
        </div>
      </div>

      {/* Right panel — thread detail */}
      <div className={`flex-1 min-w-0 ${showDetail ? 'flex' : 'hidden lg:flex'} flex-col`}>
        {selected ? (
          <ThreadDetail
            key={selected.id}
            thread={selected}
            onBack={() => setShowDetail(false)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MailOpen className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Sélectionnez un fil de conversation
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
