export interface SourceFileUpload {
  content: Blob;
  contentType: "application/pdf";
  path: string;
}

export interface SourceStorage {
  createSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;
  remove(path: string): Promise<void>;
  upload(input: SourceFileUpload): Promise<void>;
}
