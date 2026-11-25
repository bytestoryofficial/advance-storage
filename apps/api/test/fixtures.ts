import { prisma } from '@advance-storage/db';

// ============================================ TYPES ============================================

export interface ICatalogFixture {
  swordId: string;
  axeId: string;
  helmetId: string;
}

// ============================================ FIXTURES ============================================

export const seedCatalog = async (): Promise<ICatalogFixture> => {
  const sword = await prisma.item.create({
    data: {
      nexoId: 'sword',
      nameRu: 'Меч',
      kind: 'weapon',
      aliases: { create: [{ alias: 'blade_cmd' }] },
    },
  });
  const axe = await prisma.item.create({ data: { nexoId: 'axe', nameRu: 'Топор', kind: 'tool' } });
  const helmet = await prisma.item.create({
    data: { nexoId: 'helmet', nameRu: 'Шлем', kind: 'armor' },
  });

  await prisma.collection.create({
    data: {
      slug: 'winter-case',
      nameRu: 'Зимний кейс',
      kind: 'case',
      editions: {
        create: {
          editionNo: 1,
          items: {
            create: [
              { itemId: sword.id, slotOrder: 1, dropChanceBp: 250 },
              { itemId: helmet.id, slotOrder: 2 },
            ],
          },
        },
      },
    },
  });

  await prisma.collection.create({
    data: {
      slug: 'summer-set',
      nameRu: 'Летний набор',
      kind: 'set',
      editions: { create: { editionNo: 1, items: { create: [{ itemId: axe.id, slotOrder: 1 }] } } },
    },
  });

  return { swordId: sword.id, axeId: axe.id, helmetId: helmet.id };
};
