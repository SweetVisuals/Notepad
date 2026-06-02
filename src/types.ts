export interface Note {
  id: string; // uuid
  user_id: string; // used for syncing across devices
  title: string;
  content: string;
  is_archived: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export type NoteFilter = 'all' | 'archived' | 'trash';
