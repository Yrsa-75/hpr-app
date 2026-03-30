'use client';

import * as React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import {
  Bold,
  Italic,
  UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading2,
  Heading3,
  Minus,
  Undo,
  Redo,
  Link2,
  Link2Off,
  ExternalLink,
  Pencil,
  Check,
  X,
} from 'lucide-react';

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      title={title}
      className={`h-7 w-7 flex items-center justify-center rounded text-xs transition-colors ${
        active
          ? 'bg-hpr-gold/20 text-hpr-gold'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
      } disabled:opacity-30 disabled:pointer-events-none`}
    >
      {children}
    </button>
  );
}

export function RichEditor({ value, onChange, placeholder, minHeight = 400 }: RichEditorProps) {
  // Link input mode: 'none' | 'add' | 'edit'
  const [linkMode, setLinkMode] = React.useState<'none' | 'add' | 'edit'>('none');
  const [linkInputValue, setLinkInputValue] = React.useState('');
  const [activeLinkHref, setActiveLinkHref] = React.useState('');
  const linkInputRef = React.useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-hpr-gold underline cursor-pointer' },
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onSelectionUpdate: ({ editor }) => {
      const href: string = editor.getAttributes('link').href ?? '';
      setActiveLinkHref(href);
      // If cursor moves off a link and we're in 'edit' mode, close it
      if (!href && linkMode === 'edit') {
        setLinkMode('none');
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm max-w-none focus:outline-none',
        style: `min-height: ${minHeight}px; padding: 16px;`,
      },
    },
  });

  // Sync external value changes (e.g. AI rewrite)
  React.useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || '');
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus link input when it appears
  React.useEffect(() => {
    if (linkMode !== 'none') {
      setTimeout(() => linkInputRef.current?.focus(), 0);
    }
  }, [linkMode]);

  const handleOpenAdd = () => {
    setLinkInputValue('');
    setLinkMode('add');
  };

  const handleOpenEdit = () => {
    setLinkInputValue(activeLinkHref);
    setLinkMode('edit');
  };

  const handleConfirmLink = () => {
    if (!editor) return;
    const url = linkInputValue.trim();
    if (url) {
      const href = url.startsWith('http') ? url : `https://${url}`;
      if (linkMode === 'edit') {
        editor.chain().focus().extendMarkRange('link').setLink({ href, target: '_blank' }).run();
      } else {
        editor.chain().focus().setLink({ href, target: '_blank' }).run();
      }
      setActiveLinkHref(href);
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setActiveLinkHref('');
    }
    setLinkMode('none');
    setLinkInputValue('');
  };

  const handleCancelLink = () => {
    setLinkMode('none');
    setLinkInputValue('');
    editor?.commands.focus();
  };

  const handleRemoveLink = () => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setActiveLinkHref('');
    setLinkMode('none');
  };

  if (!editor) return null;

  const isOnLink = !!activeLinkHref;

  return (
    <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-white/[0.03] focus-within:border-hpr-gold/50 transition-colors">
      {/* Main toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-white/[0.06] bg-white/[0.02]">
        {/* History */}
        <ToolbarButton title="Annuler" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
          <Undo className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Rétablir" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
          <Redo className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-white/[0.08] mx-1" />

        {/* Headings */}
        <ToolbarButton
          title="Titre H2"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Titre H3"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-white/[0.08] mx-1" />

        {/* Formatting */}
        <ToolbarButton
          title="Gras"
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Italique"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Souligné"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-white/[0.08] mx-1" />

        {/* Lists */}
        <ToolbarButton
          title="Liste à puces"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Liste numérotée"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-white/[0.08] mx-1" />

        {/* Alignment */}
        <ToolbarButton
          title="Aligner à gauche"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })}
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Centrer"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })}
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Aligner à droite"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })}
        >
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-white/[0.08] mx-1" />

        {/* Horizontal rule */}
        <ToolbarButton
          title="Séparateur horizontal"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-white/[0.08] mx-1" />

        {/* Link button */}
        <ToolbarButton
          title={isOnLink ? 'Gérer le lien' : 'Ajouter un lien'}
          active={isOnLink || linkMode !== 'none'}
          onClick={() => {
            if (linkMode !== 'none') {
              handleCancelLink();
            } else if (isOnLink) {
              handleOpenEdit();
            } else {
              handleOpenAdd();
            }
          }}
        >
          <Link2 className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {/* Link info bar — shown when cursor is on a link (and not editing) */}
      {isOnLink && linkMode === 'none' && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.06] bg-hpr-gold/[0.04]">
          <Link2 className="h-3 w-3 text-hpr-gold/60 shrink-0" />
          <span className="flex-1 min-w-0 text-xs text-hpr-gold/80 truncate">{activeLinkHref}</span>
          <a
            href={activeLinkHref}
            target="_blank"
            rel="noopener noreferrer"
            onMouseDown={(e) => e.stopPropagation()}
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-hpr-gold hover:bg-hpr-gold/10 transition-colors shrink-0"
            title="Ouvrir dans un nouvel onglet"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleOpenEdit(); }}
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors shrink-0"
            title="Modifier le lien"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleRemoveLink(); }}
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
            title="Supprimer le lien"
          >
            <Link2Off className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Link input bar — shown when adding or editing a link */}
      {linkMode !== 'none' && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.06] bg-white/[0.02]">
          <Link2 className="h-3.5 w-3.5 text-hpr-gold shrink-0" />
          <input
            ref={linkInputRef}
            type="url"
            value={linkInputValue}
            onChange={(e) => setLinkInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleConfirmLink(); }
              if (e.key === 'Escape') { e.preventDefault(); handleCancelLink(); }
            }}
            placeholder="https://exemple.com"
            className="flex-1 min-w-0 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleConfirmLink(); }}
            className="h-6 px-2 flex items-center gap-1 rounded bg-hpr-gold/20 text-hpr-gold text-xs hover:bg-hpr-gold/30 transition-colors shrink-0"
          >
            <Check className="h-3 w-3" />
            Appliquer
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleCancelLink(); }}
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Editor content */}
      <div className="relative">
        {!value && (
          <div className="absolute top-4 left-4 text-muted-foreground/40 text-sm pointer-events-none select-none">
            {placeholder}
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
