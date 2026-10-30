-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleSubject" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "GoogleAuthAttempt" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "browserTokenHash" TEXT NOT NULL,
    "nonceHash" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleAuthAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleAuthAttempt_stateHash_key" ON "GoogleAuthAttempt"("stateHash");

-- CreateIndex
CREATE INDEX "GoogleAuthAttempt_expiresAt_idx" ON "GoogleAuthAttempt"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");

-- AddForeignKey
ALTER TABLE "GoogleAuthAttempt" ADD CONSTRAINT "GoogleAuthAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

