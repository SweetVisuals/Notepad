import React, { useState } from 'react';
import { Note, NoteFilter } from '../types';
import { formatFriendlyDate } from '../utils';
import { 
  X, Search, Inbox, Archive, Trash2, Plus, 
  Settings, Check, Copy, RefreshCw, LayoutGrid, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  filter: NoteFilter;
  onFilterChange: (filter: NoteFilter) => void;
  onNewNote: () => void;
  onArchiveToggle: (note: Note) => void;
  onDeleteToggle: (note: Note) => void;
}

export default function Sidebar({
  isOpen,
  onClose,
  notes,
  activeNoteId,
  onSelectNote,
  filter,
  onFilterChange,
  onNewNote,
  onArchiveToggle,
  onDeleteToggle
}: SidebarProps) {
  const [search, setSearch] = useState('');

  // Filter notes based on general states
  const filteredNotes = notes.filter(note => {
    // 1. Filter by deletion/archived state
    if (filter === 'trash') {
      if (!note.is_deleted) return false;
    } else if (filter === 'archived') {
      if (!note.is_archived || note.is_deleted) return false;
    } else {
      // 'all' notes - neither deleted nor archived
      if (note.is_deleted || note.is_archived) return false;
    }

    // 2. Filter by search query
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        note.title.toLowerCase().includes(q) ||
        note.content.toLowerCase().includes(q)
      );
    }

    return true;
  });

  // Calculate stats for filter buttons
  const activeCount = notes.filter(n => !n.is_deleted && !n.is_archived).length;
  const archivedCount = notes.filter(n => n.is_archived && !n.is_deleted).length;
  const trashCount = notes.filter(n => n.is_deleted).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Blur Layer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-stone-900/10 backdrop-blur-xs z-40 transition-opacity"
          />

          {/* Full Screen Sidebar Container */}
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
            className="fixed inset-y-0 left-0 w-full sm:max-w-md bg-white border-r border-gray-200 shadow-xl z-50 flex flex-col h-full overflow-hidden"
          >
            {/* Header Block */}
            <div className="h-20 px-6 border-b border-gray-100 flex items-center justify-between shrink-0">
              <span className="font-serif italic text-2xl tracking-tight text-[#1A1A1A] flex items-center gap-2">
                <span>Chronicle</span>
              </span>
              
              <button
                onClick={onClose}
                className="p-2 -mr-2 rounded text-gray-400 hover:bg-gray-50 hover:text-[#1A1A1A] transition-all cursor-pointer"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions Search Area */}
            <div className="p-5 space-y-4 border-b border-gray-100 shrink-0 bg-[#FAF9F6]/50">
              {/* Search Note Field */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search titles or text..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded text-xs outline-none bg-white placeholder-gray-400 text-[#1A1A1A] focus:border-gray-400 transition-all"
                />
              </div>

              {/* Filtering Controls */}
              <div className="grid grid-cols-3 gap-1 px-1">
                {/* Active Folder */}
                <button
                  type="button"
                  onClick={() => onFilterChange('all')}
                  className={`py-2 px-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    filter === 'all'
                      ? 'bg-black text-white'
                      : 'text-gray-400 hover:text-black hover:bg-gray-50'
                  }`}
                >
                  <Inbox className="w-3.5 h-3.5" />
                  <span>Notes ({activeCount})</span>
                </button>

                {/* Archive Folder */}
                <button
                  type="button"
                  onClick={() => onFilterChange('archived')}
                  className={`py-2 px-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    filter === 'archived'
                      ? 'bg-black text-white'
                      : 'text-gray-400 hover:text-black hover:bg-gray-50'
                  }`}
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive ({archivedCount})</span>
                </button>

                {/* Trash Folder */}
                <button
                  type="button"
                  onClick={() => onFilterChange('trash')}
                  className={`py-2 px-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    filter === 'trash'
                      ? 'bg-black text-white'
                      : 'text-gray-400 hover:text-black hover:bg-gray-50'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Trash ({trashCount})</span>
                </button>
              </div>
            </div>

            {/* Scrolling Notes Items */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-2 bg-[#FAF9F6]/20">
              {filteredNotes.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <span className="block text-xl mb-1.5 font-serif italic">No chronicles found</span>
                  <p className="text-[10px] text-gray-400 max-w-[200px] mx-auto mt-1 leading-normal uppercase tracking-wider">
                    Adjust folders or tap New to begin.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredNotes.sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).map((note, index) => {
                    const isActive = note.id === activeNoteId;
                    return (
                      <motion.div
                        key={note.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.02, 0.2) }}
                        className={`group relative rounded p-4 flex flex-col gap-1 transition-all cursor-pointer border ${
                          isActive
                            ? 'bg-white border-gray-200 ring-1 ring-black/5 shadow-xs'
                            : 'bg-transparent border-transparent hover:bg-white hover:border-gray-150'
                        }`}
                        onClick={() => {
                          onSelectNote(note.id);
                          // Close sidebar on small viewports
                          if (window.innerWidth < 640) {
                            onClose();
                          }
                        }}
                      >
                        {/* Note Header Title and Toggle Buttons */}
                        <div className="flex justify-between items-start gap-2">
                          <h4 className={`text-sm font-medium truncate ${isActive ? 'text-black font-semibold' : 'text-[#1A1A1A]'}`}>
                            {note.title.trim() === '' ? 'Untitled' : note.title}
                          </h4>

                          {/* Quick Actions (Visually secondary) */}
                          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onArchiveToggle(note);
                              }}
                              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-[#1A1A1A] transition-colors cursor-pointer"
                              title={note.is_archived ? 'Restore context' : 'Send to Archive'}
                            >
                              <Archive className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteToggle(note);
                              }}
                              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                              title={note.is_deleted ? 'Put back' : 'Send to Trash'}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Text Snippet view */}
                        <p className="text-xs text-gray-500 line-clamp-1 leading-relaxed">
                          {note.content.trim() === '' ? 'Empty thoughts draft...' : note.content}
                        </p>

                        {/* Footer details */}
                        <div className="mt-2 pt-2 border-t border-gray-150 text-[9px] font-mono text-gray-400 flex items-center justify-between uppercase tracking-wider">
                          <span>{formatFriendlyDate(note.updated_at || note.created_at)}</span>
                          <span className="flex items-center gap-1 font-sans text-[8px] font-bold">
                            EDIT DRAFT
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sticky Sync Management Block */}
            <div className="p-5 bg-white border-t border-gray-200 shrink-0 text-center text-[10px] text-gray-400 font-sans tracking-wide">
              <span>Private Notepad Portal</span>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
