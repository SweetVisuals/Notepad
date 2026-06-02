import { useState } from 'react';
import { Database, AlertTriangle, CheckCircle, Copy, Check, Info } from 'lucide-react';

interface DatabaseStatusProps {
  isConnected: boolean;
  tableExists: boolean;
  checking: boolean;
  onRetry: () => void;
}

export default function DatabaseStatus({ isConnected, tableExists, checking, onRetry }: DatabaseStatusProps) {
  const [copied, setCopied] = useState(false);

  const sqlCode = `-- 1. Create the notes table
create table if not exists public.notes (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  title text not null default 'Untitled',
  content text not null default '',
  is_archived boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create an index on user_id for extremely fast syncing
create index if not exists notes_user_id_idx on public.notes (user_id);

-- 3. Enable row-level security for robust security
alter table public.notes enable row level security;

-- 4. Create a policy that allows anonymous sync via our app (or you can scope it based on Auth rules)
create policy "Allow all operations for anyone" on public.notes 
  for all using (true) with check (true);`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (checking) {
    return (
      <div className="p-4 bg-[#FAF9F6] border-b border-gray-200 flex items-center justify-between text-xs text-gray-600 animate-pulse font-sans font-medium">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-gray-405" />
          <span>Verifying connection to Supabase database...</span>
        </div>
      </div>
    );
  }

  // If connected and table exists, show a subtle tiny successful sync state or nothing (to avoid clutter)
  if (isConnected && tableExists) {
    return null; // Don't show clutter if everything is perfectly set up!
  }

  return (
    <div className="max-w-md mx-auto my-6 p-6 bg-white border border-gray-200 rounded text-stone-800 font-sans shadow-sm">
      <div className="flex items-start gap-4 mb-4">
        <div className="p-3 bg-amber-50 text-amber-700 rounded">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-serif italic text-lg text-stone-900">Database Setup Required</h3>
          <p className="text-xs text-stone-600 mt-1 leading-relaxed">
            {!isConnected 
              ? "We couldn't connect to Supabase. Please double check your VITE_SUPABASE_URL and key settings."
              : "Connected to Supabase, but the 'notes' table does not exist in your database project."}
          </p>
        </div>
      </div>

      {isConnected && !tableExists && (
        <div className="space-y-4">
          <div className="bg-[#FAF9F6] p-4 rounded text-gray-600 space-y-2 border border-gray-250">
            <h4 className="font-bold text-[10px] uppercase tracking-wider text-stone-900 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-stone-500" /> Quick Instruction:
            </h4>
            <ol className="list-decimal pl-4 text-xs space-y-1">
              <li>Open your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-stone-900 font-semibold underline hover:text-stone-700">Supabase Dashboard</a></li>
              <li>Go to the <b>SQL Editor</b> in the sidebar</li>
              <li>Create a new query, paste the script below, and click <b>Run</b></li>
            </ol>
          </div>

          <div className="relative">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#FAF9F6] text-gray-500 text-[10px] uppercase font-bold tracking-wider rounded-t border-t border-x border-gray-200">
              <span>setup_notes_table.sql</span>
              <button 
                onClick={handleCopy}
                className="flex items-center gap-1 bg-[#F5F5F5] text-stone-900 px-2 py-1 rounded hover:bg-gray-150 transition-colors uppercase tracking-wider font-bold text-[9px] cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 bg-stone-950 text-stone-200 font-mono text-[10px] overflow-x-auto rounded-b max-h-48 leading-relaxed">
              {sqlCode}
            </pre>
          </div>

          <button 
            onClick={onRetry}
            className="w-full py-2 px-4 rounded font-bold text-[10px] bg-black text-white hover:bg-gray-800 active:bg-black transition-all cursor-pointer uppercase tracking-wider text-center"
          >
            I've run the SQL, test connection again
          </button>
        </div>
      )}

      {(!isConnected) && (
        <button 
          onClick={onRetry}
          className="w-full py-2 px-4 rounded font-bold text-[10px] bg-black text-white hover:bg-gray-800 active:bg-black transition-all cursor-pointer uppercase tracking-wider text-center"
        >
          Retry Connection Check
        </button>
      )}
    </div>
  );
}
