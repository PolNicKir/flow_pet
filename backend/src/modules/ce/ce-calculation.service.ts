import { Injectable } from '@nestjs/common';
import { CeBlock } from './default-ce';

@Injectable()
export class CeCalculationService {
  calculate(input: { requisites: Record<string, unknown>; blocks: CeBlock[]; ratesSnapshot?: unknown[]; adjustments?: Record<string, unknown> }) {
    const blocks = input.blocks.map((block) => {
      const lines = block.lines.map((line) => {
        const hasValue = line.rate !== null && line.quantity !== null;
        const total = hasValue ? Number(line.rate) * Number(line.quantity) : null;
        return { ...line, total };
      });
      const subtotal = lines.reduce((sum, line) => sum + (line.total ?? 0), 0);
      const adjusted = subtotal * Number(block.urgencyCoefficient || 1) * Number(block.complexityCoefficient || 1);
      const total = Math.max(0, adjusted + Number(block.markup || 0) - Number(block.discount || 0));

      return {
        ...block,
        lines,
        subtotal,
        total
      };
    });

    const totalWithoutVat = blocks.reduce((sum, block) => sum + block.total, 0);
    const warnings = totalWithoutVat === 0 ? ['Общий итог CE равен нулю'] : [];

    return {
      requisites: {
        ...input.requisites,
        serviceCost: totalWithoutVat
      },
      blocks,
      ratesSnapshot: input.ratesSnapshot ?? [],
      adjustments: input.adjustments ?? {},
      totals: {
        subtotal: totalWithoutVat,
        totalWithoutVat,
        warnings
      }
    };
  }
}

