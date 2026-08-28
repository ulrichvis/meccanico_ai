export interface SourceFileUpload {
  content: Blob;
  contentType: "application/pdf";
  path: string;
}

export interface SourceFileInfo {
  contentType: string | null;
  sizeBytes: number;
}

export interface SourceStorage {
  createSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;
  getFileInfo(path: string): Promise<SourceFileInfo>;
  remove(path: string): Promise<void>;
  upload(input: SourceFileUpload): Promise<void>;
}
