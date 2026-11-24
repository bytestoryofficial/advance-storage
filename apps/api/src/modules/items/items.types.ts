import type { ItemKind, ModelKind } from '@advance-storage/db';

export interface IItemListEntry {
  id: string;
  nexoId: string | null;
  nameRu: string | null;
  kind: ItemKind;
  modelKind: ModelKind;
  animated: boolean;
}

export interface IItemsPage {
  items: IItemListEntry[];
  nextCursor: string | null;
}

export interface IItemDrop {
  collectionSlug: string;
  collectionNameRu: string | null;
  editionNo: number;
  slotOrder: number;
  dropChancePercent: number | null;
}

export interface IItemDetails extends IItemListEntry {
  eiId: string | null;
  aliases: string[];
  drops: IItemDrop[];
}

export const LIST_SELECT = {
  id: true,
  nexoId: true,
  nameRu: true,
  kind: true,
  modelKind: true,
  animated: true,
} as const;
