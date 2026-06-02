import { Note } from '../types';
import { Menu, Plus, Archive, Trash2, CloudCheck, CloudLightning, Loader2, ArrowLeft, ArchiveRestore, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NoteEditorProps {
  note: Note | null;
  onUpdate: (title: string, content: string) => void;
  onToggleSidebar: () => void;
  onNewNote: () => void;
  onArchiveToggle: (note: Note) => void;
  onDeleteToggle: (note: Note) => void;
  onPermanentDelete?: (id: string) => void;
  syncStatus: 'synced' | 'syncing' | 'error' | 'offline';
  sidebarOpen: boolean;
}

export default function NoteEditor({
  note,
  onUpdate,
  onToggleSidebar,
  onNewNote,
  onArchiveToggle,
  onDeleteToggle,
  onPermanentDelete,
  syncStatus,
  sidebarOpen
}: NoteEditorProps) {
  
  // Calculate stats
  const charCount = note?.content.length || 0;
  const wordCount = note?.content.trim() ? note.content.trim().split(/\s+/).length : 0;

  const renderSyncIndicator = () => {
    switch (syncStatus) {
      case 'syncing':
        return (
          <div className="flex items-center gap-1.5 text-xs text-stone-500 font-mono">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-400" />
            <span className="hidden sm:inline">Saving to cloud...</span>
          </div>
        );
      case 'synced':
        return (
          <div className="flex items-center gap-1.5 text-xs text-stone-400 font-mono">
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="hidden sm:inline">Cloud synced</span>
          </div>
        );
      case 'offline':
        return (
          <div className="flex items-center gap-1.5 text-xs text-stone-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-stone-300"></span>
            <span className="hidden sm:inline">Local mode</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1.5 text-xs text-red-500 font-mono">
            <CloudLightning className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sync issue</span>
          </div>
        );
    }
  };

  return (
    <div id="note-editor" className="flex flex-col h-full bg-[#FAF9F6] text-[#1A1A1A] relative font-sans">
      {/* Top Header Panel */}
      <header className="h-20 px-4 sm:px-8 border-b border-gray-200 bg-[#FAF9F6] flex items-center justify-between sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button
            id="burger-btn"
            onClick={onToggleSidebar}
            className="p-2 -ml-1 rounded hover:bg-gray-100/50 active:bg-gray-100 transition-colors text-[#1A1A1A] cursor-pointer relative"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
            <AnimatePresence>
              {sidebarOpen === false && (
                <motion.span 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute top-2 right-2 w-2 h-2 bg-black rounded-full" 
                />
              )}
            </AnimatePresence>
          </button>
          
          <div className="flex items-center gap-2">
            {renderSyncIndicator()}
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {note && (
            <>
              {/* Archive Button */}
              <button
                onClick={() => onArchiveToggle(note)}
                className={`p-2 rounded hover:bg-gray-100 transition-all cursor-pointer ${
                  note.is_archived
                    ? 'text-amber-800 bg-amber-50 hover:bg-amber-100/70'
                    : 'text-gray-500 hover:text-black'
                }`}
                title={note.is_archived ? 'Unarchive Note' : 'Archive Note'}
              >
                {note.is_archived ? (
                  <ArchiveRestore className="w-4 h-4" />
                ) : (
                  <Archive className="w-4 h-4" />
                )}
              </button>

              {/* Trash/Delete Button */}
              <button
                onClick={() => onDeleteToggle(note)}
                className={`p-2 rounded transition-all cursor-pointer ${
                  note.is_deleted
                    ? 'text-red-700 bg-red-50 hover:bg-red-100'
                    : 'text-gray-500 hover:text-red-600 hover:bg-red-50/50'
                }`}
                title={note.is_deleted ? 'Restore from Trash' : 'Move to Trash'}
              >
                {note.is_deleted ? (
                  <RotateCcw className="w-4 h-4" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>

              {note.is_deleted && onPermanentDelete && (
                <button
                  onClick={() => onPermanentDelete(note.id)}
                  className="px-2.5 py-1.5 text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 uppercase tracking-wider rounded transition-colors cursor-pointer"
                  title="Permanently Delete Note"
                >
                  Empty
                </button>
              )}
            </>
          )}

          <div className="w-px h-5 bg-gray-200 mx-1"></div>

          {/* New Note Button */}
          <button
            onClick={onNewNote}
            className="px-5 py-2 bg-black text-white text-[11px] font-bold uppercase tracking-widest rounded hover:bg-gray-800 active:bg-black transition-colors shadow-none flex items-center gap-1.5 cursor-pointer"
            title="Create New Note (Alt + N)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>
      </header>

      {/* Editor Main Canvas */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-12 py-10 flex flex-col max-w-4xl mx-auto w-full">
        {note ? (
          <div className="flex-1 flex flex-col">
            {/* Note Status Banners if Archived or in Trash */}
            {note.is_deleted && (
              <div className="mb-6 px-4 py-3 bg-red-50/60 border border-red-100 rounded text-red-800 text-xs flex items-center justify-between font-sans">
                <span>This note is in the <b>Trash</b> and will be deleted permanently if emptied.</span>
                <button 
                  onClick={() => onDeleteToggle(note)} 
                  className="font-semibold underline hover:text-red-950 cursor-pointer"
                >
                  Restore
                </button>
              </div>
            )}
            {note.is_archived && !note.is_deleted && (
              <div className="mb-6 px-4 py-3 bg-amber-50/60 border border-amber-100 rounded text-amber-900 text-xs flex items-center justify-between font-sans">
                <span>This note is <b>Archived</b> and hidden from your main feed.</span>
                <button 
                  onClick={() => onArchiveToggle(note)} 
                  className="font-semibold underline hover:text-amber-950 cursor-pointer"
                >
                  Unarchive
                </button>
              </div>
            )}

            {/* Note Title Input */}
            <input
              type="text"
              value={note.title}
              onChange={(e) => onUpdate(e.target.value, note.content)}
              placeholder="Note Title"
              className="w-full text-2xl sm:text-3xl font-serif italic mb-6 focus:outline-none placeholder-gray-300 text-[#1A1A1A] bg-transparent border-none outline-none focus:ring-0 leading-tight"
            />

            {/* Editorial Line divider */}
            <div className="w-full h-[1px] bg-gray-200 mb-6"></div>

            {/* Content Textarea */}
            <textarea
              value={note.content}
              onChange={(e) => onUpdate(note.title, e.target.value)}
              placeholder="Start writing your thoughts..."
              spellCheck="false"
              className="w-full flex-1 text-base sm:text-lg font-serif leading-relaxed text-[#4A4A4A] placeholder-gray-300 border-none outline-none focus:ring-0 bg-transparent resize-none min-h-[420px] h-full pb-16"
            />

            {/* Footer metrics info row */}
            <footer className="py-4 border-t border-gray-200/60 flex items-center justify-between text-[10px] font-mono text-gray-400 uppercase tracking-wider">
              <div className="flex gap-6">
                <span>Words: {wordCount}</span>
                <span>Chars: {charCount}</span>
                <span>Reading: {Math.max(1, Math.ceil(wordCount / 200))} min</span>
              </div>
              <div className="text-[9px]">
                Updated {new Date(note.updated_at || note.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </footer>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
            <div className="w-12 h-12 bg-black text-white rounded flex items-center justify-center mb-6">
              <Plus className="w-5 h-5 animate-pulse" />
            </div>
            <h3 className="font-serif italic text-2xl text-stone-900 mb-2">Begin a custom draft</h3>
            <p className="text-sm font-sans text-stone-500 max-w-sm mb-8 leading-relaxed">
              Log your thoughts, list read chronicles, or archive milestones. All drafts sync automatically in real-time across your workspace.
            </p>
            <button
              onClick={onNewNote}
              className="px-6 py-2.5 bg-black text-white text-[11px] font-bold uppercase tracking-widest rounded hover:bg-gray-800 transition-colors shadow-none cursor-pointer"
            >
              Write First Note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
