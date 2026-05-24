import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const rates = [
  ['concept', 'Концепция', 100000, 'concept'],
  ['new_simple_design', 'Простой слайд', 15000, 'design'],
  ['new_medium_design', 'Средний слайд', 25000, 'design'],
  ['new_complex_design', 'Сложный слайд', 40000, 'design'],
  ['simple_coding', 'Простая верстка/анимация', 12000, 'coding'],
  ['medium_coding', 'Средняя верстка/анимация', 20000, 'coding'],
  ['complex_coding', 'Сложная верстка/анимация', 35000, 'coding'],
  ['uploading', 'Загрузка слайда', 5000, 'uploading']
] as const;

async function main() {
  for (const [code, name, amount, category] of rates) {
    await prisma.rate.upsert({
      where: { code },
      update: { name, amount, category, isActive: true },
      create: { code, name, amount, category }
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });

