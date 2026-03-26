'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Save, Sparkles, Send, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  savePressReleaseAction,
  analyzePressReleaseAction,
  rewriteSectionAction,
} from '@/app/[locale]/(dashboard)/clients/[clientId]/campaigns/[campaignId]/actions';
import type { PressReleaseRow } from '@/types/database';

interface QualityScores {
  global: number;
  accroche: number;
  lisibilite: number;
  structure: number;
  angle_media: number;
  suggestions: string[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface PressReleaseEditorProps {
  campaignId: string;
  initialPressRelease: PressReleaseRow | null;
}

function ScoreCircle({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 75 ? '#22C55E' : score >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="4"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span
        className="text-xl font-bold -mt-[68px] mb-[52px] relative z-10"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 75 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{score}</span>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export function PressReleaseEditor({ campaignId, initialPressRelease }: PressReleaseEditorProps) {
  const t = useTranslations('pressReleases');
  const tCommon = useTranslations('common');
  const { toast } = useToast();

  const [pressReleaseId, setPressReleaseId] = React.useState<string | null>(
    initialPressRelease?.id ?? null
  );
  const [version, setVersion] = React.useState(initialPressRelease?.version ?? 1);

  // Form fields
  const [emailSubject, setEmailSubject] = React.useState(initialPressRelease?.email_subject ?? '');
  const [title, setTitle] = React.useState(initialPressRelease?.title ?? '');
  const [subtitle, setSubtitle] = React.useState(initialPressRelease?.subtitle ?? '');
  const [bodyHtml, setBodyHtml] = React.useState(initialPressRelease?.body_html ?? '');
  const [emailPreviewText, setEmailPreviewText] = React.useState(
    initialPressRelease?.email_preview_text ?? ''
  );

  // AI state
  const [scores, setScores] = React.useState<QualityScores | null>(() => {
    if (!initialPressRelease?.ai_quality_score) return null;
    const analysis = initialPressRelease.ai_quality_analysis as Record<string, number> | null;
    const suggestions = initialPressRelease.ai_suggestions as string[] | null;
    if (!analysis) return null;
    return {
      global: initialPressRelease.ai_quality_score,
      accroche: analysis.accroche ?? 0,
      lisibilite: analysis.lisibilite ?? 0,
      structure: analysis.structure ?? 0,
      angle_media: analysis.angle_media ?? 0,
      suggestions: suggestions ?? [],
    };
  });
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isRewriting, setIsRewriting] = React.useState(false);
  const [chatInput, setChatInput] = React.useState('');
  const [chatHistory, setChatHistory] = React.useState<ChatMessage[]>([]);
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null);

  // Auto-save debounce
  const autoSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerAutoSave = React.useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(async () => {
      await handleSave(true);
    }, 30000); // 30 seconds
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    triggerAutoSave();
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [emailSubject, title, subtitle, bodyHtml, emailPreviewText, triggerAutoSave]);

  const handleSave = async (silent = false) => {
    if (!silent) setIsSaving(true);
    try {
      const formData = new FormData();
      formData.set('email_subject', emailSubject);
      formData.set('title', title || 'Sans titre');
      formData.set('subtitle', subtitle);
      formData.set('body_html', bodyHtml);
      formData.set('email_preview_text', emailPreviewText);
      if (pressReleaseId) {
        formData.set('press_release_id', pressReleaseId);
      }

      const result = await savePressReleaseAction(campaignId, formData);

      if (result.success && result.data) {
        setPressReleaseId(result.data.id);
        setVersion(result.data.version);
        setLastSaved(new Date());
        if (!silent) {
          toast({ title: tCommon('success'), description: 'Communiqué enregistré.' });
        }
      } else if (result.error && !silent) {
        toast({ title: tCommon('error'), description: result.error, variant: 'destructive' });
      }
    } finally {
      if (!silent) setIsSaving(false);
    }
  };

  const handleAnalyze = async () => {
    if (!pressReleaseId) {
      // Save first
      await handleSave(false);
      toast({
        title: 'Info',
        description: 'Communiqué enregistré. Lancez l\'analyse à nouveau.',
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await analyzePressReleaseAction(pressReleaseId);
      if (result.success && result.scores) {
        setScores(result.scores);
        toast({ title: tCommon('success'), description: 'Analyse IA terminée.' });
      } else {
        toast({ title: tCommon('error'), description: result.error, variant: 'destructive' });
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplySuggestion = async (suggestion: string) => {
    const currentContent = [title, subtitle, bodyHtml].filter(Boolean).join('\n\n');
    if (!currentContent.trim()) {
      toast({ title: tCommon('error'), description: 'Aucun contenu à réécrire.', variant: 'destructive' });
      return;
    }

    setIsRewriting(true);
    try {
      const result = await rewriteSectionAction(suggestion, bodyHtml || currentContent);
      if (result.success && result.content) {
        setBodyHtml(result.content);
        toast({ title: tCommon('success'), description: 'Suggestion appliquée.' });
      } else {
        toast({ title: tCommon('error'), description: result.error, variant: 'destructive' });
      }
    } finally {
      setIsRewriting(false);
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatHistory((prev) => [...prev, { role: 'user', content: userMessage }]);

    setIsRewriting(true);
    try {
      const currentContent = bodyHtml || [title, subtitle].filter(Boolean).join('\n\n') || 'Contenu vide';
      const result = await rewriteSectionAction(userMessage, currentContent);

      if (result.success && result.content) {
        setBodyHtml(result.content);
        setChatHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Contenu mis à jour selon votre instruction.',
          },
        ]);
      } else {
        setChatHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: result.error ?? 'Une erreur s\'est produite.',
          },
        ]);
      }
    } finally {
      setIsRewriting(false);
    }
  };

  return (
    <div className="flex gap-6 min-h-0">
      {/* LEFT PANEL — Editor (2/3) */}
      <div className="flex-1 space-y-4 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground/60">
            {lastSaved ? (
              <>Enregistré à {lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</>
            ) : pressReleaseId ? (
              <>Version {version}</>
            ) : (
              'Non enregistré'
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={isSaving}
            className="border-white/[0.08] hover:border-white/20 text-muted-foreground hover:text-foreground"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-2 h-3.5 w-3.5" />
            )}
            Enregistrer
          </Button>
        </div>

        {/* Email subject */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t('emailSubject')}
          </Label>
          <Input
            placeholder="Objet de l'email (vu par le journaliste dans sa boîte)"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
          />
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t('pressReleaseTitle')} <span className="text-red-400">*</span>
          </Label>
          <Input
            placeholder="Titre accrocheur du communiqué de presse"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50 text-lg font-semibold"
          />
        </div>

        {/* Subtitle */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t('subtitle_field')}
          </Label>
          <Input
            placeholder="Sous-titre (facultatif)"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
          />
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t('body')}
          </Label>
          <Textarea
            placeholder={t('noContent')}
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50 resize-none font-mono text-sm leading-relaxed"
            style={{ minHeight: '400px' }}
          />
        </div>

        {/* Email preview text */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t('emailPreview')}
          </Label>
          <Input
            placeholder="Court texte affiché après l'objet dans la boîte mail (160 car. max)"
            value={emailPreviewText}
            onChange={(e) => setEmailPreviewText(e.target.value)}
            maxLength={160}
            className="bg-white/[0.03] border-white/[0.08] focus:border-hpr-gold/50"
          />
        </div>
      </div>

      {/* RIGHT PANEL — AI assistant (1/3) */}
      <div className="w-80 shrink-0 space-y-4">
        {/* Quality score panel */}
        <div className="border border-white/[0.08] bg-white/[0.02] rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-hpr-gold" />
              Score de qualité
            </h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="h-7 text-xs text-muted-foreground hover:text-hpr-gold hover:bg-hpr-gold/5"
            >
              {isAnalyzing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              <span className="ml-1">Analyser</span>
            </Button>
          </div>

          {scores ? (
            <div className="space-y-4">
              {/* Global score circle */}
              <div className="flex justify-center">
                <div className="relative flex flex-col items-center">
                  <ScoreCircle score={scores.global} size={80} />
                  <span className="text-xs text-muted-foreground -mt-1">Score global</span>
                </div>
              </div>

              {/* Sub-scores */}
              <div className="space-y-2.5">
                <ScoreBar label="Accroche" score={scores.accroche} />
                <ScoreBar label="Lisibilité" score={scores.lisibilite} />
                <ScoreBar label="Structure" score={scores.structure} />
                <ScoreBar label="Angle média" score={scores.angle_media} />
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground">
                {isAnalyzing
                  ? 'Analyse en cours...'
                  : 'Cliquez sur "Analyser" pour obtenir un score de qualité IA.'}
              </p>
            </div>
          )}
        </div>

        {/* Suggestions panel */}
        {scores && scores.suggestions.length > 0 && (
          <div className="border border-white/[0.08] bg-white/[0.02] rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{t('aiSuggestions')}</h3>
            <div className="space-y-2">
              {scores.suggestions.map((suggestion, i) => (
                <div
                  key={i}
                  className="border border-white/[0.06] rounded-lg p-3 space-y-2 bg-white/[0.01]"
                >
                  <p className="text-xs text-muted-foreground leading-relaxed">{suggestion}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleApplySuggestion(suggestion)}
                    disabled={isRewriting}
                    className="h-6 text-[11px] text-hpr-gold/70 hover:text-hpr-gold hover:bg-hpr-gold/5 px-2"
                  >
                    {isRewriting ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    Appliquer
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI chat panel */}
        <div className="border border-white/[0.08] bg-white/[0.02] rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Assistant IA</h3>

          {/* Chat history */}
          {chatHistory.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-2.5 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-hpr-gold/10 text-hpr-gold/90 border border-hpr-gold/20 ml-4'
                      : 'bg-white/[0.04] text-muted-foreground border border-white/[0.06] mr-4'
                  }`}
                >
                  {msg.content}
                </div>
              ))}
            </div>
          )}

          {/* Chat input */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Donnez une instruction à l'IA..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleChat();
                }
              }}
              disabled={isRewriting}
              className="flex-1 min-w-0 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-hpr-gold/50 disabled:opacity-50"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={handleChat}
              disabled={isRewriting || !chatInput.trim()}
              className="h-9 w-9 p-0 text-muted-foreground hover:text-hpr-gold hover:bg-hpr-gold/5 shrink-0"
            >
              {isRewriting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
