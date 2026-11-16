-- CreateEnum
CREATE TYPE "CollectionKind" AS ENUM ('case', 'set', 'event', 'other');

-- CreateEnum
CREATE TYPE "EditionStatus" AS ENUM ('active', 'legacy');

-- CreateEnum
CREATE TYPE "ItemKind" AS ENUM ('weapon', 'tool', 'armor', 'shield', 'key', 'case_container', 'cosmetic', 'decor', 'event_item', 'trophy', 'other');

-- CreateEnum
CREATE TYPE "ModelKind" AS ENUM ('flat', '3d', 'unknown');

-- CreateTable
CREATE TABLE "collection" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" TEXT NOT NULL,
    "name_ru" TEXT,
    "kind" "CollectionKind" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_edition" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "collection_id" UUID NOT NULL,
    "edition_no" INTEGER NOT NULL,
    "status" "EditionStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_edition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edition_item" (
    "edition_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "drop_chance_bp" INTEGER,
    "slot_order" INTEGER NOT NULL,

    CONSTRAINT "edition_item_pkey" PRIMARY KEY ("edition_id","item_id")
);

-- CreateTable
CREATE TABLE "item" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "nexo_id" TEXT,
    "ei_id" TEXT,
    "name_ru" TEXT,
    "kind" "ItemKind" NOT NULL,
    "model_ref" TEXT,
    "model_kind" "ModelKind" NOT NULL DEFAULT 'unknown',
    "animated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_alias" (
    "alias" TEXT NOT NULL,
    "item_id" UUID NOT NULL,

    CONSTRAINT "item_alias_pkey" PRIMARY KEY ("alias")
);

-- CreateIndex
CREATE UNIQUE INDEX "collection_slug_key" ON "collection"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "collection_edition_collection_id_edition_no_key" ON "collection_edition"("collection_id", "edition_no");

-- CreateIndex
CREATE INDEX "edition_item_item_id_idx" ON "edition_item"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "edition_item_edition_id_slot_order_key" ON "edition_item"("edition_id", "slot_order");

-- CreateIndex
CREATE UNIQUE INDEX "item_nexo_id_key" ON "item"("nexo_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_ei_id_key" ON "item"("ei_id");

-- CreateIndex
CREATE INDEX "item_alias_item_id_idx" ON "item_alias"("item_id");

-- AddForeignKey
ALTER TABLE "collection_edition" ADD CONSTRAINT "collection_edition_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edition_item" ADD CONSTRAINT "edition_item_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "collection_edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edition_item" ADD CONSTRAINT "edition_item_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_alias" ADD CONSTRAINT "item_alias_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written for CHECK constraints
ALTER TABLE "collection_edition" ADD CONSTRAINT "chk_edition_no_positive" CHECK ("edition_no" > 0);

ALTER TABLE "edition_item"
  ADD CONSTRAINT "chk_drop_chance_range" CHECK ("drop_chance_bp" BETWEEN 1 AND 100000),
  ADD CONSTRAINT "chk_slot_order_positive" CHECK ("slot_order" > 0);
