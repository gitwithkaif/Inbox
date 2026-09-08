import fs from "fs";
import path from "path";
import { Pouch, PouchFile } from "./types";

interface DbSchema {
  pouches: Pouch[];
  files: PouchFile[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initialData: DbSchema = {
      pouches: [],
      files: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), "utf-8");
  }
}

function readDb(): DbSchema {
  ensureDirs();
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { pouches: [], files: [] };
  }
}

function writeDb(data: DbSchema) {
  ensureDirs();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export const localStore = {
  getPouches(): Pouch[] {
    const db = readDb();
    return [...db.pouches].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  getPouchBySlug(slug: string): Pouch | null {
    const db = readDb();
    return db.pouches.find((p) => p.slug === slug) || null;
  },

  getPouchById(id: string): Pouch | null {
    const db = readDb();
    return db.pouches.find((p) => p.id === id) || null;
  },

  createPouch(pouchData: Omit<Pouch, "id" | "created_at">): Pouch {
    const db = readDb();
    const newPouch: Pouch = {
      ...pouchData,
      id: "local_" + Math.random().toString(36).substring(2, 12),
      created_at: new Date().toISOString(),
    };
    db.pouches.unshift(newPouch);
    writeDb(db);
    return newPouch;
  },

  updatePouchPassword(id: string, password_hash: string | null): boolean {
    const db = readDb();
    const pouch = db.pouches.find((p) => p.id === id);
    if (!pouch) return false;
    pouch.password_hash = password_hash;
    writeDb(db);
    return true;
  },

  deletePouch(id: string): boolean {
    const db = readDb();
    const initialCount = db.pouches.length;
    db.pouches = db.pouches.filter((p) => p.id !== id);

    // Also remove files belonging to this pouch
    const filesToRemove = db.files.filter((f) => f.pouch_id === id);
    db.files = db.files.filter((f) => f.pouch_id !== id);

    // Clean up files on disk
    for (const f of filesToRemove) {
      try {
        const filePath = path.join(UPLOAD_DIR, f.storage_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.warn("Failed to delete local file:", err);
      }
    }

    writeDb(db);
    return db.pouches.length < initialCount;
  },

  getAllFiles(): PouchFile[] {
    const db = readDb();
    return db.files;
  },

  getFilesByPouchId(pouchId: string): PouchFile[] {
    const db = readDb();
    return db.files
      .filter((f) => f.pouch_id === pouchId)
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
  },

  createFile(fileData: Omit<PouchFile, "id" | "uploaded_at">): PouchFile {
    const db = readDb();
    const newFile: PouchFile = {
      ...fileData,
      id: "file_" + Math.random().toString(36).substring(2, 12),
      uploaded_at: new Date().toISOString(),
    };
    db.files.unshift(newFile);
    writeDb(db);
    return newFile;
  },

  getFileById(id: string): PouchFile | null {
    const db = readDb();
    return db.files.find((f) => f.id === id) || null;
  },
};
