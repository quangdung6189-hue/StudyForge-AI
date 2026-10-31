-- Additive migration: existing accounts, documents and study data remain intact.
CREATE TABLE "DocumentFile" (
    "documentId" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "metadata" JSONB,
    CONSTRAINT "DocumentFile_pkey" PRIMARY KEY ("documentId")
);

CREATE TABLE "DocumentUpload" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "receivedBytes" INTEGER NOT NULL DEFAULT 0,
    "nextPart" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'uploading',
    "documentId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DocumentUpload_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentUploadPart" (
    "uploadId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    CONSTRAINT "DocumentUploadPart_pkey" PRIMARY KEY ("uploadId", "position")
);

CREATE INDEX "DocumentUpload_ownerId_expiresAt_idx" ON "DocumentUpload"("ownerId", "expiresAt");
CREATE INDEX "DocumentUpload_expiresAt_idx" ON "DocumentUpload"("expiresAt");
ALTER TABLE "DocumentFile" ADD CONSTRAINT "DocumentFile_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentUpload" ADD CONSTRAINT "DocumentUpload_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentUploadPart" ADD CONSTRAINT "DocumentUploadPart_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "DocumentUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;