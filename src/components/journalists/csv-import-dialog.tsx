'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Upload, FileText, ChevronRight, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { ImportError } from '@/app/[locale]/(dashboard)/journalists/actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { importJournalistsAction } from '@/app/[locale]/(dashboard)/journalists/actions';
import type { JournalistImport } from '@/app/[locale]/(dashboard)/journalists/actions';

type Step = 'upload' | 'mapping' | 'preview' | 'result';

const HPR_FIELDS = [
  { key: 'first_name', label: 'Prénom', required: true },
  { key: 'last_name', label: 'Nom', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'phone', label: 'Téléphone', required: false },
  { key: 'phone_direct', label: 'Téléphone (Ligne directe)', required: false },
  { key: 'media_outlet', label: 'Nom du média', required: true },
  { key: 'media_type', label: 'Type de média', required: false },
  { key: 'beat', label: 'Thématiques', required: false },
  { key: 'location', label: 'Localisation', required: false },
  { key: 'linkedin_url', label: 'LinkedIn URL', required: false },
  { key: 'twitter_handle', label: 'Twitter/X', required: false },
  { key: 'notes', label: 'Notes', required: false },
  { key: 'tags', label: 'Tags', required: false },
  { key: 'validate', label: 'Email vérifié (✓)', required: false },
] as const;

type HprFieldKey = typeof HPR_FIELDS[number]['key'];
const IGNORE_VALUE = '__ignore__' as const;

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  errorDetails: ImportError[];
}

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function autoMap(csvColumns: string[]): Record<string, HprFieldKey | '__ignore__'> {
  const mapping: Record<string, HprFieldKey | '__ignore__'> = {};
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  const synonyms: Record<string, HprFieldKey> = {
    prenom: 'first_name',
    firstname: 'first_name',
    first: 'first_name',
    nom: 'last_name',
    lastname: 'last_name',
    last: 'last_name',
    surname: 'last_name',
    mail: 'email',
    email: 'email',
    courriel: 'email',
    tel: 'phone',
    telephone: 'phone',
    phone: 'phone',
    direct: 'phone_direct',
    lignedirecte: 'phone_direct',
    phonedirect: 'phone_direct',
    teldirect: 'phone_direct',
    telephonedirect: 'phone_direct',
    media: 'media_outlet',
    mediaoutlet: 'media_outlet',
    journal: 'media_outlet',
    publication: 'media_outlet',
    redaction: 'media_outlet',
    type: 'media_type',
    mediatype: 'media_type',
    typemedia: 'media_type',
    beat: 'beat',
    thematique: 'beat',
    thematiques: 'beat',
    sujet: 'beat',
    sujets: 'beat',
    location: 'location',
    ville: 'location',
    localisation: 'location',
    pays: 'location',
    linkedin: 'linkedin_url',
    linkedinurl: 'linkedin_url',
    twitter: 'twitter_handle',
    twitterhandle: 'twitter_handle',
    handle: 'twitter_handle',
    notes: 'notes',
    note: 'notes',
    commentaires: 'notes',
    tags: 'tags',
    tag: 'tags',
    categorie: 'tags',
    validate: 'validate',
    verifie: 'validate',
    verified: 'validate',
    emailverifie: 'validate',
    emailverified: 'validate',
    verifiemail: 'validate',
  };

  for (const col of csvColumns) {
    const key = normalize(col);
    mapping[col] = synonyms[key] ?? IGNORE_VALUE;
  }

  return mapping;
}

export function CsvImportDialog({ open, onOpenChange }: CsvImportDialogProps) {
  const t = useTranslations('journalists');
  const tCommon = useTranslations('common');
  const { toast } = useToast();

  const [step, setStep] = React.useState<Step>('upload');
  const [isDragging, setIsDragging] = React.useState(false);
  const [fileName, setFileName] = React.useState('');
  const [csvColumns, setCsvColumns] = React.useState<string[]>([]);
  const [csvRows, setCsvRows] = React.useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = React.useState<Record<string, HprFieldKey | '__ignore__'>>({});
  const [isImporting, setIsImporting] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Reset when dialog closes
  React.useEffect(() => {
    if (!open) {
      setStep('upload');
      setFileName('');
      setCsvColumns([]);
      setCsvRows([]);
      setMapping({});
      setResult(null);
    }
  }, [open]);

  const parseFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast({ title: 'Format invalide', description: 'Veuillez sélectionner un fichier .csv', variant: 'destructive' });
      return;
    }

    setFileName(file.name);

    // Auto-detect encoding: try strict UTF-8, fall back to Windows-1252 (common for Excel CSVs)
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      let encoding = 'UTF-8';
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        encoding = 'windows-1252';
      }

      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        encoding,
        complete: (result) => {
          const columns = result.meta.fields ?? [];
          const rows = result.data;

          if (columns.length === 0) {
            toast({ title: 'Fichier vide', description: 'Le fichier CSV ne contient pas de colonnes.', variant: 'destructive' });
            return;
          }

          setCsvColumns(columns);
          setCsvRows(rows);
          setMapping(autoMap(columns));
          setStep('mapping');
        },
        error: () => {
          toast({ title: 'Erreur de lecture', description: 'Impossible de lire le fichier CSV.', variant: 'destructive' });
        },
      });
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  const getMappedData = (): JournalistImport[] => {
    return csvRows.map((row) => {
      const journalist: Record<string, string> = {};
      for (const [csvCol, hprField] of Object.entries(mapping)) {
        if (hprField && hprField !== IGNORE_VALUE && row[csvCol] !== undefined) {
          journalist[hprField] = row[csvCol];
        }
      }
      return journalist as JournalistImport;
    });
  };

  const requiredMapped = HPR_FIELDS.filter((f) => f.required).every((f) =>
    Object.values(mapping).includes(f.key)
  );

  const handleImport = async () => {
    const data = getMappedData();
    setIsImporting(true);
    try {
      const res = await importJournalistsAction(data);
      if (res.success) {
        setResult({ imported: res.imported, skipped: res.skipped, errors: res.errors, errorDetails: res.errorDetails });
        setStep('result');
      } else {
        toast({ title: tCommon('error'), description: res.error, variant: 'destructive' });
      }
    } finally {
      setIsImporting(false);
    }
  };

  const previewData = getMappedData().slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <Upload className="h-5 w-5 text-hpr-gold" />
            {t('importJournalists')}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-1">
          {(['upload', 'mapping', 'preview', 'result'] as Step[]).map((s, i) => {
            const labels: Record<Step, string> = {
              upload: 'Fichier',
              mapping: 'Colonnes',
              preview: 'Aperçu',
              result: 'Résultat',
            };
            const isActive = step === s;
            const isDone =
              ['upload', 'mapping', 'preview', 'result'].indexOf(step) >
              ['upload', 'mapping', 'preview', 'result'].indexOf(s);

            return (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-1.5 text-xs ${isActive ? 'text-hpr-gold' : isDone ? 'text-green-400' : 'text-muted-foreground'}`}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[12px] font-medium ${isActive ? 'bg-hpr-gold/20 text-hpr-gold' : isDone ? 'bg-green-500/20 text-green-400' : 'bg-white/[0.06]'}`}>
                    {isDone ? '✓' : i + 1}
                  </span>
                  {labels[s]}
                </div>
                {i < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors cursor-pointer ${isDragging ? 'border-hpr-gold/50 bg-hpr-gold/5' : 'border-white/[0.10] hover:border-white/20 bg-white/[0.01]'}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={handleFileInput}
            />
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06] mb-4">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              Glissez votre fichier CSV ici
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              ou cliquez pour sélectionner un fichier
            </p>
            <Button type="button" variant="outline" size="sm" className="border-white/10">
              Choisir un fichier .csv
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">
              Colonnes requises : prénom, nom, email, nom du média
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Pour les thématiques et tags multi-valeurs, séparez avec <code className="font-mono bg-white/[0.06] px-1 rounded">/</code> (ex : <code className="font-mono bg-white/[0.06] px-1 rounded">web/tv</code>)
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Colonne <code className="font-mono bg-white/[0.06] px-1 rounded">validate</code> : toute valeur non vide (ex : <code className="font-mono bg-white/[0.06] px-1 rounded">x</code>, <code className="font-mono bg-white/[0.06] px-1 rounded">oui</code>) marquera l'email comme vérifié ✓
            </p>
          </div>
        )}

        {/* Step 2: Column mapping */}
        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-hpr-gold" />
              <span className="text-sm text-foreground/80">{fileName}</span>
              <Badge variant="secondary">{csvRows.length} lignes</Badge>
            </div>

            <p className="text-xs text-muted-foreground">
              Associez les colonnes de votre CSV aux champs HPR. Les champs marqués <span className="text-red-400">*</span> sont obligatoires.
            </p>

            <div className="rounded-lg border border-white/[0.08] overflow-hidden">
              <div className="grid grid-cols-2 gap-0 px-3 py-2 bg-white/[0.03] text-xs font-medium text-muted-foreground">
                <span>Colonne CSV</span>
                <span>Champ HPR</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {csvColumns.map((col) => (
                  <div key={col} className="grid grid-cols-2 gap-3 items-center px-3 py-2">
                    <span className="text-sm text-foreground/80 truncate font-mono text-xs bg-white/[0.03] rounded px-2 py-1">
                      {col}
                    </span>
                    <Select
                      value={mapping[col] ?? IGNORE_VALUE}
                      onValueChange={(val) =>
                        setMapping((prev) => ({ ...prev, [col]: val as HprFieldKey | '__ignore__' }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs bg-white/[0.03] border-white/[0.08]">
                        <SelectValue placeholder="Ignorer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={IGNORE_VALUE}>Ignorer cette colonne</SelectItem>
                        {HPR_FIELDS.map((field) => (
                          <SelectItem key={field.key} value={field.key}>
                            {field.label}{field.required ? ' *' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {!requiredMapped && (
              <div className="flex items-center gap-2 rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2">
                <AlertCircle className="h-4 w-4 text-orange-400 shrink-0" />
                <p className="text-xs text-orange-400">
                  Vous devez mapper les champs obligatoires : Prénom, Nom, Email, Nom du média.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Aperçu des 5 premières lignes qui seront importées ({csvRows.length} au total).
            </p>

            <div className="rounded-lg border border-white/[0.08] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/[0.03]">
                    {HPR_FIELDS.filter((f) => Object.values(mapping).includes(f.key)).map((field) => (
                      <th key={field.key} className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">
                        {field.label}{field.required ? ' *' : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {previewData.map((row, i) => (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      {HPR_FIELDS.filter((f) => Object.values(mapping).includes(f.key)).map((field) => (
                        <td key={field.key} className="px-3 py-2 text-foreground/80 truncate max-w-[120px]">
                          {(row as Record<string, string>)[field.key] ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Les doublons (même email) seront ignorés automatiquement.
            </p>
          </div>
        )}

        {/* Step 4: Result */}
        {step === 'result' && result && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-6 w-6 text-green-400" />
              </div>
            </div>
            <p className="text-center text-sm font-medium text-foreground">Import terminé</p>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-center">
                <p className="text-2xl font-bold text-green-400">{result.imported}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Importés</p>
              </div>
              <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 text-center">
                <p className="text-2xl font-bold text-orange-400">{result.skipped}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Ignorés (doublons)</p>
              </div>
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-center">
                <p className="text-2xl font-bold text-red-400">{result.errors}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Erreurs</p>
              </div>
            </div>

            {result.errorDetails.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-red-400">
                  Détail des {result.errorDetails.length} erreur{result.errorDetails.length > 1 ? 's' : ''} :
                </p>
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 overflow-hidden max-h-56 overflow-y-auto">
                  <div className="grid grid-cols-[auto_1fr_1fr_2fr] gap-0 px-3 py-1.5 bg-red-500/10 text-[12px] font-medium text-red-400/80 sticky top-0">
                    <span className="w-10">Ligne</span>
                    <span>Nom</span>
                    <span>Email</span>
                    <span>Raison</span>
                  </div>
                  <div className="divide-y divide-red-500/10">
                    {result.errorDetails.map((err, i) => (
                      <div key={i} className="grid grid-cols-[auto_1fr_1fr_2fr] gap-0 px-3 py-1.5 text-[13px]">
                        <span className="w-10 text-muted-foreground/60 font-mono">{err.row}</span>
                        <span className="text-foreground/80 truncate pr-2">{err.name}</span>
                        <span className="text-muted-foreground/70 truncate pr-2 font-mono text-[12px]">{err.email || '—'}</span>
                        <span className="text-red-400/80">{err.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer actions */}
        <DialogFooter className="gap-2">
          {step === 'upload' && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground"
            >
              {tCommon('cancel')}
            </Button>
          )}

          {step === 'mapping' && (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep('upload')}
                className="text-muted-foreground"
              >
                {tCommon('back')}
              </Button>
              <Button
                type="button"
                variant="gold"
                disabled={!requiredMapped}
                onClick={() => setStep('preview')}
              >
                Aperçu
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep('mapping')}
                className="text-muted-foreground"
              >
                {tCommon('back')}
              </Button>
              <Button
                type="button"
                variant="gold"
                disabled={isImporting}
                onClick={handleImport}
                className="min-w-[140px]"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Import en cours...
                  </>
                ) : (
                  `Importer ${csvRows.length} contact${csvRows.length !== 1 ? 's' : ''}`
                )}
              </Button>
            </>
          )}

          {step === 'result' && (
            <Button
              type="button"
              variant="gold"
              onClick={() => onOpenChange(false)}
            >
              Fermer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
