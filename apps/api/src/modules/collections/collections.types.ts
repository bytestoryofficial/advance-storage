import type { CollectionKind, EditionStatus } from '@advance-storage/db';

export interface IListCollectionEntry {
  id: string;
  slug: string;
  nameRu: string | null;
  kind: CollectionKind;
  itemCount: number;
}

export interface ICollectionsPage {
  collections: IListCollectionEntry[];
}

export interface ICollectionEdition {
  editionNo: number;
  status: EditionStatus;
  itemCount: number;
}

export interface ICollectionDetails extends IListCollectionEntry {
  editions: ICollectionEdition[];
}

export const COLLECTIONS_SELECT = {
  id: true,
  slug: true,
  nameRu: true,
  kind: true,
} as const;
