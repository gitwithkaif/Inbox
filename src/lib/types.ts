export interface Pouch {
  id: string;
  slug: string;
  name: string;
  message: string | null;
  password_hash?: string | null;
  has_password?: boolean;
  created_at: string;
  file_count?: number;
  total_size?: number;
}

export interface PouchFile {
  id: string;
  pouch_id: string;
  file_name: string;
  file_size: number;
  storage_path: string;
  sender_name: string;
  sender_message?: string | null;
  uploaded_at: string;
}

export interface PouchPublicInfo {
  id: string;
  slug: string;
  name: string;
  message: string | null;
  has_password: boolean;
  created_at: string;
}
