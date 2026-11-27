-- CreateTable
CREATE TABLE "invite" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "code_hash" TEXT NOT NULL,
    "note" TEXT,
    "created_by_id" UUID NOT NULL,
    "used_by_id" UUID,
    "used_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invite_code_hash_key" ON "invite"("code_hash");

-- CreateIndex
CREATE UNIQUE INDEX "invite_used_by_id_key" ON "invite"("used_by_id");

-- CreateIndex
CREATE INDEX "invite_created_by_id_idx" ON "invite"("created_by_id");

-- AddForeignKey
ALTER TABLE "invite" ADD CONSTRAINT "invite_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite" ADD CONSTRAINT "invite_used_by_id_fkey" FOREIGN KEY ("used_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Same hash format as sessions
ALTER TABLE invite
  ADD CONSTRAINT invite_code_hash_format_chk
    CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  -- A user implies a date; the date stays if the account is deleted (SetNull)
  ADD CONSTRAINT invite_used_consistency_chk
    CHECK (used_by_id IS NULL OR used_at IS NOT NULL);
