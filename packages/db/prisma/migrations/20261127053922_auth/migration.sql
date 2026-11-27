-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('member', 'admin');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "username" TEXT NOT NULL,
    "username_key" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key_key" ON "user"("username_key");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_hash_key" ON "session"("token_hash");

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- CreateIndex
CREATE INDEX "session_expires_at_idx" ON "session"("expires_at");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Minecraft nickname rules: 3–16 chars, letters, digits, underscore
ALTER TABLE "user"
  ADD CONSTRAINT user_username_format_chk
    CHECK (username ~ '^[A-Za-z0-9_]{3,16}$'),
  ADD CONSTRAINT user_username_key_lower_chk
    CHECK (username_key = lower(username));

-- SHA-256 hex is always 64 lowercase hex chars
ALTER TABLE session
  ADD CONSTRAINT session_token_hash_format_chk
    CHECK (token_hash ~ '^[0-9a-f]{64}$');
