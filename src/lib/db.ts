import { getAdminClient } from "./supabase/admin";
import { localStore } from "./local-store";
import { Pouch, PouchFile } from "./types";

export function isSupabaseAvailable(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  if (url.includes("placeholder-project") || url.includes("your-project")) return false;
  if (key.includes("placeholder-") || key.includes("your-anon")) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export const db = {
  async getPouches(): Promise<{ pouches: Pouch[]; totalStorageBytes: number; isLocal: boolean }> {
    if (isSupabaseAvailable()) {
      try {
        const client = getAdminClient();
        const { data: pouches, error: pErr } = await client
          .from("pouches")
          .select("*")
          .order("created_at", { ascending: false });

        if (pErr) throw pErr;

        const { data: files, error: fErr } = await client
          .from("files")
          .select("id, pouch_id, file_size");

        if (fErr) throw fErr;

        const fileCounts: Record<string, number> = {};
        let totalBytes = 0;

        (files || []).forEach((f) => {
          totalBytes += Number(f.file_size || 0);
          fileCounts[f.pouch_id] = (fileCounts[f.pouch_id] || 0) + 1;
        });

        const enriched: Pouch[] = (pouches || []).map((p) => ({
          ...p,
          file_count: fileCounts[p.id] || 0,
          has_password: Boolean(p.password_hash),
        }));

        return { pouches: enriched, totalStorageBytes: totalBytes, isLocal: false };
      } catch (err) {
        console.warn("Supabase fetch failed, using local store:", err);
      }
    }

    // Local fallback
    const pouches = localStore.getPouches();
    const files = localStore.getAllFiles();
    const fileCounts: Record<string, number> = {};
    let totalBytes = 0;

    files.forEach((f) => {
      totalBytes += Number(f.file_size || 0);
      fileCounts[f.pouch_id] = (fileCounts[f.pouch_id] || 0) + 1;
    });

    const enriched: Pouch[] = pouches.map((p) => ({
      ...p,
      file_count: fileCounts[p.id] || 0,
      has_password: Boolean(p.password_hash),
    }));

    return { pouches: enriched, totalStorageBytes: totalBytes, isLocal: true };
  },

  async getPouchBySlug(slug: string): Promise<{ pouch: Pouch | null; files: PouchFile[]; isLocal: boolean }> {
    if (isSupabaseAvailable()) {
      try {
        const client = getAdminClient();
        const { data: pouch, error: pErr } = await client
          .from("pouches")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();

        if (pErr) throw pErr;
        if (pouch) {
          const { data: files, error: fErr } = await client
            .from("files")
            .select("*")
            .eq("pouch_id", pouch.id)
            .order("uploaded_at", { ascending: false });

          if (fErr) throw fErr;

          return {
            pouch: {
              ...pouch,
              has_password: Boolean(pouch.password_hash),
            },
            files: files || [],
            isLocal: false,
          };
        }
      } catch (err) {
        console.warn("Supabase getPouchBySlug failed, using local store:", err);
      }
    }

    // Local fallback
    const pouch = localStore.getPouchBySlug(slug);
    if (!pouch) {
      return { pouch: null, files: [], isLocal: true };
    }
    const files = localStore.getFilesByPouchId(pouch.id);
    return {
      pouch: {
        ...pouch,
        has_password: Boolean(pouch.password_hash),
      },
      files,
      isLocal: true,
    };
  },

  async createPouch(data: {
    name: string;
    slug: string;
    message: string | null;
    password_hash: string | null;
  }): Promise<{ pouch: Pouch; isLocal: boolean }> {
    if (isSupabaseAvailable()) {
      try {
        const client = getAdminClient();
        const { data: newPouch, error } = await client
          .from("pouches")
          .insert(data)
          .select()
          .single();

        if (error) throw error;
        return { pouch: newPouch, isLocal: false };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("Supabase createPouch failed (" + msg + "), using local store.");
      }
    }

    const newPouch = localStore.createPouch(data);
    return { pouch: newPouch, isLocal: true };
  },

  async updatePassword(id: string, password_hash: string | null): Promise<boolean> {
    if (isSupabaseAvailable()) {
      try {
        const client = getAdminClient();
        const { error } = await client
          .from("pouches")
          .update({ password_hash })
          .eq("id", id);

        if (!error) return true;
      } catch (err) {
        console.warn("Supabase updatePassword failed, using local store:", err);
      }
    }

    return localStore.updatePouchPassword(id, password_hash);
  },

  async deletePouch(id: string): Promise<boolean> {
    if (isSupabaseAvailable()) {
      try {
        const client = getAdminClient();
        // Remove storage files
        try {
          const { data: fileList } = await client.storage.from("pouch-files").list(id);
          if (fileList && fileList.length > 0) {
            await client.storage.from("pouch-files").remove(fileList.map((f) => `${id}/${f.name}`));
          }
        } catch {}

        const { error } = await client.from("pouches").delete().eq("id", id);
        if (!error) return true;
      } catch (err) {
        console.warn("Supabase deletePouch failed, using local store:", err);
      }
    }

    return localStore.deletePouch(id);
  },

  async addFile(fileData: {
    pouch_id: string;
    file_name: string;
    file_size: number;
    storage_path: string;
    sender_name: string;
    sender_message?: string | null;
  }): Promise<PouchFile> {
    if (isSupabaseAvailable()) {
      try {
        const client = getAdminClient();
        const { data, error } = await client
          .from("files")
          .insert(fileData)
          .select()
          .single();

        if (!error && data) return data;
      } catch (err) {
        console.warn("Supabase addFile failed, using local store:", err);
      }
    }

    return localStore.createFile(fileData);
  },
};
