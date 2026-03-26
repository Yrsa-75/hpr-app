'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { JournalistFormDialog } from '@/components/journalists/journalist-form-dialog';
import { CsvImportDialog } from '@/components/journalists/csv-import-dialog';

export function JournalistsHeader() {
  const t = useTranslations('journalists');

  const [addOpen, setAddOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            className="border-white/10 hover:border-white/20"
          >
            <Upload className="mr-2 h-4 w-4" />
            {t('importJournalists')}
          </Button>
          <Button variant="gold" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('addJournalist')}
          </Button>
        </div>
      </div>

      <JournalistFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        journalist={null}
      />

      <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
