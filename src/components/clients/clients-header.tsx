'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClientFormDialog } from '@/components/clients/client-form-dialog';

export function ClientsHeader() {
  const t = useTranslations('clients');
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <Button variant="gold" size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('addClient')}
        </Button>
      </div>

      <ClientFormDialog open={open} onOpenChange={setOpen} client={null} />
    </>
  );
}
