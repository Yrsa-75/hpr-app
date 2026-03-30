'use client';

import * as React from 'react';
import * as Diff from 'diff';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface DiffPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion: string;
  oldHtml: string;
  newHtml: string;
  onConfirm: () => void;
  isApplying: boolean;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Walks the HTML string character by character in parallel with the plain text
 * produced by stripHtml. For each character range in the plain text that falls
 * within a highlighted range, wraps the corresponding HTML text in a <span>.
 * HTML tags and entities are passed through unchanged.
 */
function annotateHtml(
  html: string,
  highlightRanges: Array<{ start: number; end: number }>,
  spanClass: string
): string {
  if (highlightRanges.length === 0) return html;

  let result = '';
  let textPos = 0; // position in the plain text (as produced by stripHtml)
  let i = 0;

  const isHighlighted = (pos: number) =>
    highlightRanges.some((r) => pos >= r.start && pos < r.end);

  while (i < html.length) {
    // HTML tag — pass through without advancing textPos
    if (html[i] === '<') {
      const closeIdx = html.indexOf('>', i);
      if (closeIdx === -1) {
        result += html.slice(i);
        break;
      }
      const tag = html.slice(i, closeIdx + 1);
      result += tag;
      i = closeIdx + 1;

      // Closing block tags produce a '\n' in stripHtml — advance textPos
      if (/^<\/(p|h[1-6]|li)>/i.test(tag)) {
        textPos += 1; // the '\n' character
      }
      // Self-closing <br> also produces a '\n'
      if (/^<br[\s/]/i.test(tag) || tag.toLowerCase() === '<br>') {
        textPos += 1;
      }
      continue;
    }

    // HTML entity (e.g. &amp;, &nbsp;, &lt;, &gt;) — counts as 1 char in plain text
    if (html[i] === '&') {
      const semi = html.indexOf(';', i);
      if (semi !== -1 && semi - i <= 8) {
        const entity = html.slice(i, semi + 1);
        if (isHighlighted(textPos)) {
          result += `<span class="${spanClass}">${entity}</span>`;
        } else {
          result += entity;
        }
        textPos += 1;
        i = semi + 1;
        continue;
      }
    }

    // Regular text character
    const highlighted = isHighlighted(textPos);
    if (highlighted) {
      // Collect all consecutive highlighted characters (avoids a span per char)
      let j = i;
      while (
        j < html.length &&
        html[j] !== '<' &&
        html[j] !== '&' &&
        isHighlighted(textPos + (j - i))
      ) {
        j++;
      }
      result += `<span class="${spanClass}">${html.slice(i, j)}</span>`;
      textPos += j - i;
      i = j;
    } else {
      result += html[i];
      textPos++;
      i++;
    }
  }

  return result;
}

/**
 * Compute the plain-text character ranges for diff parts that match the given mode.
 */
function getHighlightRanges(
  diff: Diff.Change[],
  mode: 'added' | 'removed'
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let pos = 0;
  for (const part of diff) {
    const len = part.value.length;
    if (mode === 'removed' && part.removed) {
      ranges.push({ start: pos, end: pos + len });
    }
    if (mode === 'added' && part.added) {
      ranges.push({ start: pos, end: pos + len });
    }
    // Only advance pos for parts that appear in the relevant text
    if (mode === 'removed' && !part.added) pos += len;
    if (mode === 'added' && !part.removed) pos += len;
  }
  return ranges;
}

export function DiffPreviewDialog({
  open,
  onOpenChange,
  suggestion,
  oldHtml,
  newHtml,
  onConfirm,
  isApplying,
}: DiffPreviewDialogProps) {
  const oldText = stripHtml(oldHtml);
  const newText = stripHtml(newHtml);

  const diff = Diff.diffWords(oldText, newText);
  const hasChanges = diff.some((part) => part.added || part.removed);

  const removedRanges = React.useMemo(
    () => getHighlightRanges(diff, 'removed'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [oldHtml, newHtml]
  );
  const addedRanges = React.useMemo(
    () => getHighlightRanges(diff, 'added'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [oldHtml, newHtml]
  );

  const annotatedOld = React.useMemo(
    () =>
      annotateHtml(
        oldHtml,
        removedRanges,
        'bg-red-500/20 text-red-300 line-through decoration-red-400/60 rounded px-0.5'
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [oldHtml, newHtml]
  );

  const annotatedNew = React.useMemo(
    () =>
      annotateHtml(
        newHtml,
        addedRanges,
        'bg-emerald-500/20 text-emerald-300 underline decoration-emerald-400/60 rounded px-0.5'
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [oldHtml, newHtml]
  );

  const removedWordCount = diff
    .filter((p) => p.removed)
    .reduce((acc, p) => acc + p.value.split(/\s+/).filter(Boolean).length, 0);
  const addedWordCount = diff
    .filter((p) => p.added)
    .reduce((acc, p) => acc + p.value.split(/\s+/).filter(Boolean).length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-base">
            Prévisualisation de la modification
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Suggestion : <span className="text-foreground italic">"{suggestion}"</span>
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {!hasChanges ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Aucune modification détectée.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Legend */}
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded bg-red-500/30 border border-red-500/50" />
                  Supprimé
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/50" />
                  Ajouté
                </span>
              </div>

              {/* Side-by-side diff with full HTML formatting */}
              <div className="grid grid-cols-2 gap-3">
                {/* Before */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Avant
                  </p>
                  <div
                    className="border border-red-500/20 bg-red-500/[0.03] rounded-xl p-4 text-sm leading-relaxed prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: annotatedOld }}
                  />
                </div>

                {/* After */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Après
                  </p>
                  <div
                    className="border border-emerald-500/20 bg-emerald-500/[0.03] rounded-xl p-4 text-sm leading-relaxed prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: annotatedNew }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {removedWordCount > 0 && (
                  <span className="text-red-400">
                    -{removedWordCount} mot{removedWordCount > 1 ? 's' : ''} supprimé{removedWordCount > 1 ? 's' : ''}
                  </span>
                )}
                {addedWordCount > 0 && (
                  <span className="text-emerald-400">
                    +{addedWordCount} mot{addedWordCount > 1 ? 's' : ''} ajouté{addedWordCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-4 border-t border-white/[0.06]">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isApplying}
            className="text-muted-foreground hover:text-foreground"
          >
            Annuler
          </Button>
          <Button
            variant="gold"
            onClick={onConfirm}
            disabled={isApplying || !hasChanges}
            className="min-w-[120px]"
          >
            {isApplying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Application...
              </>
            ) : (
              'Appliquer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
