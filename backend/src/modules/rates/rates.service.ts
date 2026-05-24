import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRateDto, UpdateRateDto } from './dto';

@Injectable()
export class RatesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.prisma.rate.createMany({
      data: [
        { code: 'concept', name: 'Концепция', amount: 100000, category: 'concept' },
        { code: 'new_simple_design', name: 'Простой слайд', amount: 15000, category: 'design' },
        { code: 'new_medium_design', name: 'Средний слайд', amount: 25000, category: 'design' },
        { code: 'new_complex_design', name: 'Сложный слайд', amount: 40000, category: 'design' },
        { code: 'simple_design_adaptation', name: 'Адаптация дизайна простого слайда', amount: 10000, category: 'adaptation' },
        { code: 'medium_design_adaptation', name: 'Адаптация дизайна среднего слайда', amount: 18000, category: 'adaptation' },
        { code: 'complex_design_adaptation', name: 'Адаптация дизайна сложного слайда', amount: 30000, category: 'adaptation' },
        { code: 'simple_coding', name: 'Простая верстка/анимация', amount: 12000, category: 'coding' },
        { code: 'medium_coding', name: 'Средняя верстка/анимация', amount: 20000, category: 'coding' },
        { code: 'complex_coding', name: 'Сложная верстка/анимация', amount: 35000, category: 'coding' },
        { code: 'simple_coding_adaptation', name: 'Адаптация верстки простого слайда', amount: 8000, category: 'adaptation' },
        { code: 'medium_coding_adaptation', name: 'Адаптация верстки среднего слайда', amount: 15000, category: 'adaptation' },
        { code: 'complex_coding_adaptation', name: 'Адаптация верстки сложного слайда', amount: 25000, category: 'adaptation' },
        { code: 'uploading', name: 'Загрузка слайда', amount: 5000, category: 'uploading' }
      ],
      skipDuplicates: true
    });
  }

  list() {
    return this.prisma.rate.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    });
  }

  create(userId: string, dto: CreateRateDto) {
    return this.prisma.rate.create({
      data: {
        ...dto,
        createdBy: userId
      }
    });
  }

  update(id: string, dto: UpdateRateDto) {
    return this.prisma.rate.update({
      where: { id },
      data: dto
    });
  }
}
