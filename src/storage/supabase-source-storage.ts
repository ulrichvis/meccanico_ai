import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  SourceFileInfo,
  SourceFileUpload,
  SourceStorage,
} from "@/storage/source-storage";
import { StorageOperationError } from "@/storage/storage-errors";

const signedUrlLifetimeSchema = z.number().int().min(1).max(3_600);

export class SupabaseSourceStorage implements SourceStorage {
  constructor(
    private readonly client: SupabaseClient,
    private readonly bucket: string,
  ) {}

  async upload(input: SourceFileUpload): Promise<void> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(input.path, input.content, {
        cacheControl: "3600",
        contentType: input.contentType,
        upsert: false,
      });

    if (error) {
      throw new StorageOperationError("STORAGE_UPLOAD_FAILED", { cause: error });
    }
  }

  async remove(path: string): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).remove([path]);

    if (error) {
      throw new StorageOperationError("STORAGE_REMOVE_FAILED", { cause: error });
    }
  }

  async getFileInfo(path: string): Promise<SourceFileInfo> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .info(path);

    if (error) {
      throw new StorageOperationError("STORAGE_FILE_INFO_FAILED", {
        cause: error,
      });
    }

    return {
      contentType: data.contentType ?? data.metadata?.mimetype ?? null,
      sizeBytes: data.size ?? data.metadata?.size ?? 0,
    };
  }

  async createSignedUrl(path: string, expiresInSeconds = 300): Promise<string> {
    const validLifetime = signedUrlLifetimeSchema.parse(expiresInSeconds);
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(path, validLifetime);

    if (error) {
      throw new StorageOperationError("STORAGE_SIGNED_URL_FAILED", {
        cause: error,
      });
    }

    return data.signedUrl;
  }
}
