export class StorageOperationError extends Error {
  constructor(
    public readonly code:
      | "STORAGE_UPLOAD_FAILED"
      | "STORAGE_REMOVE_FAILED"
      | "STORAGE_SIGNED_URL_FAILED"
      | "STORAGE_FILE_INFO_FAILED",
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "StorageOperationError";
  }
}

export class StorageCompensationError extends Error {
  constructor(
    public readonly storagePath: string,
    public readonly persistenceError: unknown,
    public readonly cleanupError: unknown,
  ) {
    super("STORAGE_COMPENSATION_FAILED", { cause: cleanupError });
    this.name = "StorageCompensationError";
  }
}
