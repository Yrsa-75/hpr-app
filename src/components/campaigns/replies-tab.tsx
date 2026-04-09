'use client';

import { InboxView, type ThreadWithJoins } from '@/components/inbox/inbox-view';
import { MessageSquare } from 'lucide-react';

export type { ThreadWithJoins };

interface RepliesTabProps {
  threads: ThreadWithJoins[];
}

export function RepliesTab({ threads }: RepliesTabProps) {
  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
          <MessageSquare className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="font-display text-sm font-medium text-foreground mb-1">
          Aucune réponse pour l'instant
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          Les réponses des journalistes apparaîtront ici dès leur réception.
        </p>
      </div>
    );
  }

  return <InboxView threads={threads} />;
}
