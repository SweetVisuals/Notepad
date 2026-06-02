import { useState, useEffect, useRef } from 'react';
import { Note, NoteFilter } from './types';
import { supabase, checkSupabaseConnection } from './supabaseClient';
import { generateSyncCode } from './utils';
import Sidebar from './components/Sidebar';
import NoteEditor from './components/NoteEditor';
import DatabaseStatus from './components/DatabaseStatus';
import { Loader2, Settings, Smartphone } from 'lucide-react';

// Generates a robust uuid
function generateUUID(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function App() {
  // Syncing states
  const [syncCode, setSyncCode] = useState<string>(() => {
    const saved = localStorage.getItem('notes_sync_code');
    if (saved) return saved;
    const fresh = generateSyncCode();
    localStorage.setItem('notes_sync_code', fresh);
    return fresh;
  });

  // App core states
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [filter, setFilter] = useState<NoteFilter>('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Connection states
  const [isConnected, setIsConnected] = useState(true);
  const [tableExists, setTableExists] = useState(true);
  const [checkingDb, setCheckingDb] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'offline'>('synced');

  // Tracking timeouts for active edits (one timer per note ID to allow switching notes smoothly)
  const saveTimeoutRef = useRef<{ [key: string]: ReturnType<typeof setTimeout> }>({});

  const activeNote = notes.find(n => n.id === activeNoteId) || null;

  // Run initial diagnostic check on the database connection
  const runDiagnostics = async () => {
    setCheckingDb(true);
    try {
      const { data, error } = await supabase.from('notes').select('id').limit(1);
      if (error) {
        console.warn("DB Connection check returned: ", error);
        if (error.code === '42P01') {
          // Table does not exist in the Supabase schema
          setIsConnected(true);
          setTableExists(false);
        } else {
          // Offline, network failure, or permission issues
          setIsConnected(false);
          setTableExists(false);
        }
      } else {
        setIsConnected(true);
        setTableExists(true);
      }
    } catch (err) {
      console.error(err);
      setIsConnected(false);
      setTableExists(false);
    } finally {
      setCheckingDb(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  // Fetch notes from Supabase when connected and syncCode changes
  const fetchNotes = async () => {
    if (!tableExists || !isConnected) return;
    setLoadingNotes(true);
    setSyncStatus('syncing');
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', syncCode);

      if (error) {
        console.error("Error loading notes:", error);
        setSyncStatus('error');
      } else if (data) {
        setNotes(data as Note[]);
        
        // If notes exist, auto-select the most recently updated active note
        const activeNotes = (data as Note[]).filter(n => !n.is_deleted && !n.is_archived);
        if (activeNotes.length > 0) {
          // Sort by updated_at descending
          activeNotes.sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
          setActiveNoteId(activeNotes[0].id);
        } else if (data.length > 0) {
          setActiveNoteId(data[0].id);
        } else {
          // Database is empty for this syncCode, create welcoming default note
          await createDefaultNote(syncCode);
        }
        setSyncStatus('synced');
      }
    } catch (err) {
      console.error(err);
      setSyncStatus('offline');
    } finally {
      setLoadingNotes(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [syncCode, tableExists, isConnected]);

  // Real-time Postgres subscribe trigger
  useEffect(() => {
    if (!tableExists || !isConnected) return;

    const channel = supabase
      .channel(`realtime_feed_${syncCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
        },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;
          
          if (eventType === 'INSERT' && newRow && newRow.user_id === syncCode) {
            setNotes(prev => {
              if (prev.some(n => n.id === newRow.id)) return prev;
              return [newRow as Note, ...prev];
            });
          }
          
          else if (eventType === 'UPDATE' && newRow && newRow.user_id === syncCode) {
            setNotes(prev => prev.map(n => {
              if (n.id === newRow.id) {
                // If currently editing this exact note on this device, ONLY overwrite meta properties (archived/deleted states)
                // so we do not disrupt active cursor position
                const isCurrentlyEditing = saveTimeoutRef.current[newRow.id] !== undefined;
                if (isCurrentlyEditing) {
                  return {
                    ...n,
                    is_archived: newRow.is_archived,
                    is_deleted: newRow.is_deleted,
                  };
                } else {
                  return newRow as Note;
                }
              }
              return n;
            }));
          }
          
          else if (eventType === 'DELETE' && oldRow) {
            setNotes(prev => prev.filter(n => n.id !== oldRow.id));
            setActiveNoteId(prev => prev === oldRow.id ? null : prev);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [syncCode, tableExists, isConnected]);

  // Handle hotkeys (Ctrl + S to immediate save, Alt + N for New Note)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Trigger immediate save for active note
        if (activeNote) {
          const id = activeNote.id;
          if (saveTimeoutRef.current[id]) {
            clearTimeout(saveTimeoutRef.current[id]);
            delete saveTimeoutRef.current[id];
          }
          saveNoteToDb(id, activeNote.title, activeNote.content, new Date().toISOString());
        }
      }
      
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewNote();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeNote, syncCode]);

  // Cleanup pending timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(saveTimeoutRef.current).forEach(clearTimeout);
    };
  }, []);

  const createDefaultNote = async (code: string) => {
    const defaultNote: Note = {
      id: generateUUID(),
      user_id: code,
      title: 'Welcome to Sync Notes 🚀',
      content: `This is a mobile-first, distraction-free note-taking application syncing with Supabase in real-time.

💡 QUICK TIPS:
• Full-Screen Mode: This editor takes full priority on open to keep your workspace minimal.
• Sidebar Workspace: Click the burger menu (top-left) to search notes, create folders, or view your Archive/Trash.
• Word Stats: Check character and word metrics at the bottom of the active document.

🔄 DEVICES CROSS-SYNCING:
1. Tap the burger icon on this browser to open the sidebar.
2. Under "Cross-Device Syncing" at the bottom, copy your unique Sync Code.
3. Open this same link on any other mobile phone, tablet, or secondary desktop.
4. Click "Edit" next to the Sync Code, paste it and tap "Connect".
5. Both screens are now bridged in real-time! When you stop typing on one screen, it propagates to the other instantly.

Double-click standard inputs or click the note body below to start drafting immediately.`,
      is_archived: false,
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setNotes([defaultNote]);
    setActiveNoteId(defaultNote.id);

    try {
      await supabase.from('notes').insert([defaultNote]);
    } catch (err) {
      console.warn("Could not insert default welcome note:", err);
    }
  };

  const saveNoteToDb = async (id: string, title: string, content: string, updatedAt: string) => {
    if (!tableExists || !isConnected) return;

    try {
      const { error } = await supabase
        .from('notes')
        .upsert({
          id,
          user_id: syncCode,
          title,
          content,
          updated_at: updatedAt
        });

      if (error) {
        console.error("Autosave database error:", error);
        setSyncStatus('error');
      } else {
        setSyncStatus('synced');
      }
    } catch (err) {
      console.error(err);
      setSyncStatus('error');
    }
  };

  const debouncedSave = (id: string, title: string, content: string, updatedAt: string) => {
    if (saveTimeoutRef.current[id]) {
      clearTimeout(saveTimeoutRef.current[id]);
    }

    saveTimeoutRef.current[id] = setTimeout(() => {
      saveNoteToDb(id, title, content, updatedAt);
      delete saveTimeoutRef.current[id];
    }, 850);
  };

  // Immediate note updating of text contents
  const handleUpdateNote = (title: string, content: string) => {
    if (!activeNoteId) return;

    const now = new Date().toISOString();

    setNotes(prev => prev.map(n => {
      if (n.id === activeNoteId) {
        return { ...n, title, content, updated_at: now };
      }
      return n;
    }));

    setSyncStatus('syncing');
    debouncedSave(activeNoteId, title, content, now);
  };

  const handleNewNote = async () => {
    const newNote: Note = {
      id: generateUUID(),
      user_id: syncCode,
      title: '',
      content: '',
      is_archived: false,
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setNotes(prev => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    setSidebarOpen(false); // Clean viewport focus on creation
    setFilter('all'); // Ensure we are on All Notes so the newly created item is visible

    setSyncStatus('syncing');
    try {
      const { error } = await supabase.from('notes').insert([newNote]);
      if (error) {
        setSyncStatus('error');
        console.error(error);
      } else {
        setSyncStatus('synced');
      }
    } catch (err) {
      setSyncStatus('error');
    }
  };

  const handleArchiveToggle = async (noteToArchive: Note) => {
    const updated = {
      ...noteToArchive,
      is_archived: !noteToArchive.is_archived,
      updated_at: new Date().toISOString()
    };

    setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
    setSyncStatus('syncing');

    try {
      const { error } = await supabase.from('notes').upsert(updated);
      if (error) {
        setSyncStatus('error');
      } else {
        setSyncStatus('synced');
      }
    } catch (err) {
      setSyncStatus('error');
    }
  };

  const handleDeleteToggle = async (noteToDelete: Note) => {
    const updated = {
      ...noteToDelete,
      is_deleted: !noteToDelete.is_deleted,
      updated_at: new Date().toISOString()
    };

    setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
    setSyncStatus('syncing');

    try {
      const { error } = await supabase.from('notes').upsert(updated);
      if (error) {
        setSyncStatus('error');
      } else {
        setSyncStatus('synced');
      }
    } catch (err) {
      setSyncStatus('error');
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (saveTimeoutRef.current[id]) {
      clearTimeout(saveTimeoutRef.current[id]);
      delete saveTimeoutRef.current[id];
    }

    const rest = notes.filter(n => n.id !== id);
    setNotes(rest);
    
    if (activeNoteId === id) {
      // Pick a reasonable replacement
      const remainingActive = rest.filter(n => !n.is_deleted && !n.is_archived);
      setActiveNoteId(remainingActive.length > 0 ? remainingActive[0].id : (rest.length > 0 ? rest[0].id : null));
    }

    setSyncStatus('syncing');
    try {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) {
        setSyncStatus('error');
      } else {
        setSyncStatus('synced');
      }
    } catch (err) {
      setSyncStatus('error');
    }
  };

  const handleSyncCodeChange = (newCode: string) => {
    // Clear all active timers before changing context
    Object.values(saveTimeoutRef.current).forEach(clearTimeout);
    saveTimeoutRef.current = {};

    setSyncCode(newCode);
    localStorage.setItem('notes_sync_code', newCode);
    setNotes([]);
    setActiveNoteId(null);
  };

  const handleNotesSelect = (id: string) => {
    setActiveNoteId(id);
    // If selecting an archived or trash note, automatically switch our view folder to preview correctly
    const selectedNote = notes.find(n => n.id === id);
    if (selectedNote) {
      if (selectedNote.is_deleted) {
        setFilter('trash');
      } else if (selectedNote.is_archived) {
        setFilter('archived');
      } else {
        setFilter('all');
      }
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#FAF9F6] font-sans selection:bg-stone-200">
      {/* Setup notification layer if Supabase tables are absent */}
      <DatabaseStatus
        isConnected={isConnected}
        tableExists={tableExists}
        checking={checkingDb}
        onRetry={runDiagnostics}
      />

      {tableExists ? (
        <main className="flex-1 relative h-full">
          {/* Overlay loading notes on first load */}
          {loadingNotes && notes.length === 0 && (
            <div className="absolute inset-0 z-30 bg-stone-50/90 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-stone-700" />
              <p className="text-sm font-medium text-stone-600">Syncing with Supabase...</p>
            </div>
          )}

          {/* Full Screen Note Editor */}
          <NoteEditor
            note={activeNote}
            onUpdate={handleUpdateNote}
            onToggleSidebar={() => setSidebarOpen(true)}
            onNewNote={handleNewNote}
            onArchiveToggle={handleArchiveToggle}
            onDeleteToggle={handleDeleteToggle}
            onPermanentDelete={handlePermanentDelete}
            syncStatus={syncStatus}
            sidebarOpen={sidebarOpen}
          />

          {/* Full Screen Sliding Sidebar */}
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            notes={notes}
            activeNoteId={activeNoteId}
            onSelectNote={handleNotesSelect}
            filter={filter}
            onFilterChange={setFilter}
            syncCode={syncCode}
            onSyncCodeChange={handleSyncCodeChange}
            onNewNote={handleNewNote}
            onArchiveToggle={handleArchiveToggle}
            onDeleteToggle={handleDeleteToggle}
          />
        </main>
      ) : (
        <div className="flex-1 flex flex-col justify-center items-center px-4 bg-stone-50">
          <div className="max-w-md text-center mb-6">
            <div className="mx-auto w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center text-stone-700 mb-4 border border-stone-200">
              <Smartphone className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">Sync Notes Portal</h2>
            <p className="text-xs text-stone-500 mt-1">Please configure your backend Supabase table to finalize deployment.</p>
          </div>
        </div>
      )}
    </div>
  );
}
