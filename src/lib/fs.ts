import { invoke } from "@/lib/api/transport";

// Filesystem of the machine the backend runs on

export async function homeDir(): Promise<string> {
  return await invoke<string>("fs_home_dir");
}

export async function documentsDir(): Promise<string> {
  return await invoke<string>("fs_documents_dir");
}

export async function joinPath(...paths: string[]): Promise<string> {
  return await invoke<string>("fs_join", { paths });
}
