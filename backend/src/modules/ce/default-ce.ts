export type CeLine = {
  id: string;
  service: string;
  rateCode?: string;
  rate: number | null;
  quantity: number | null;
  total: number | null;
};

export type CeBlock = {
  id: string;
  title: string;
  lines: CeLine[];
  urgencyCoefficient: number;
  complexityCoefficient: number;
  discount: number;
  markup: number;
  subtotal: number;
  total: number;
};

export function defaultCeDocument(projectName: string) {
  return {
    requisites: {
      date: new Date().toISOString().slice(0, 10),
      client: '',
      brand: projectName,
      manager: '',
      period: '',
      serviceCost: 0
    },
    blocks: [
      {
        id: 'concept',
        title: 'Этап 1. Проектирование и концепция',
        urgencyCoefficient: 1,
        complexityCoefficient: 1,
        discount: 0,
        markup: 0,
        subtotal: 0,
        total: 0,
        lines: [
          { id: 'concept-main', service: 'Концепция', rateCode: 'concept', rate: 100000, quantity: null, total: null }
        ]
      },
      {
        id: 'design',
        title: 'Этап 2. Проектирование и дизайн слайда',
        urgencyCoefficient: 1,
        complexityCoefficient: 1,
        discount: 0,
        markup: 0,
        subtotal: 0,
        total: 0,
        lines: [
          { id: 'new-simple-design', service: 'Простой слайд', rateCode: 'new_simple_design', rate: 15000, quantity: null, total: null },
          { id: 'new-medium-design', service: 'Средний слайд', rateCode: 'new_medium_design', rate: 25000, quantity: null, total: null },
          { id: 'new-complex-design', service: 'Сложный слайд', rateCode: 'new_complex_design', rate: 40000, quantity: null, total: null }
        ]
      },
      {
        id: 'adaptation',
        title: 'Этап 3. Адаптация',
        urgencyCoefficient: 1,
        complexityCoefficient: 1,
        discount: 0,
        markup: 0,
        subtotal: 0,
        total: 0,
        lines: [
          { id: 'simple-design-adaptation', service: 'Адаптация дизайна простого слайда', rateCode: 'simple_design_adaptation', rate: 10000, quantity: null, total: null },
          { id: 'medium-design-adaptation', service: 'Адаптация дизайна среднего слайда', rateCode: 'medium_design_adaptation', rate: 18000, quantity: null, total: null },
          { id: 'complex-design-adaptation', service: 'Адаптация дизайна сложного слайда', rateCode: 'complex_design_adaptation', rate: 30000, quantity: null, total: null },
          { id: 'simple-coding-adaptation', service: 'Адаптация верстки простого слайда', rateCode: 'simple_coding_adaptation', rate: 8000, quantity: null, total: null },
          { id: 'medium-coding-adaptation', service: 'Адаптация верстки среднего слайда', rateCode: 'medium_coding_adaptation', rate: 15000, quantity: null, total: null },
          { id: 'complex-coding-adaptation', service: 'Адаптация верстки сложного слайда', rateCode: 'complex_coding_adaptation', rate: 25000, quantity: null, total: null }
        ]
      },
      {
        id: 'coding',
        title: 'Этап 4. Верстка и анимация',
        urgencyCoefficient: 1,
        complexityCoefficient: 1,
        discount: 0,
        markup: 0,
        subtotal: 0,
        total: 0,
        lines: [
          { id: 'simple-coding', service: 'Простая верстка/анимация', rateCode: 'simple_coding', rate: 12000, quantity: null, total: null },
          { id: 'medium-coding', service: 'Средняя верстка/анимация', rateCode: 'medium_coding', rate: 20000, quantity: null, total: null },
          { id: 'complex-coding', service: 'Сложная верстка/анимация', rateCode: 'complex_coding', rate: 35000, quantity: null, total: null }
        ]
      }
    ] satisfies CeBlock[],
    ratesSnapshot: [],
    adjustments: {},
    totals: {
      subtotal: 0,
      totalWithoutVat: 0,
      warnings: ['Общий итог CE равен нулю']
    }
  };
}
