import { calculateFlowStatistics } from './flow-statistics';

export const FLOW_TO_CE_RATE_CODES: Record<string, string> = {
  'new simple design': 'new_simple_design',
  'new medium design': 'new_medium_design',
  'new complex design': 'new_complex_design',
  'simple design adaptation': 'simple_design_adaptation',
  'medium design adaptation': 'medium_design_adaptation',
  'complex design adaptation': 'complex_design_adaptation',
  'new simple coding': 'simple_coding',
  'new medium coding': 'medium_coding',
  'new complex coding': 'complex_coding',
  'simple coding adaptation': 'simple_coding_adaptation',
  'medium coding adaptation': 'medium_coding_adaptation',
  'complex coding adaptation': 'complex_coding_adaptation'
};

export function flowQuantities(nodes: Array<{ designType?: string; codingType?: string; popupsCount?: number }>) {
  const stats = calculateFlowStatistics(nodes);
  const quantities: Record<string, number> = {};

  for (const [flowType, count] of Object.entries({ ...stats.design, ...stats.coding })) {
    const rateCode = FLOW_TO_CE_RATE_CODES[flowType];
    if (rateCode) {
      quantities[rateCode] = count;
    }
  }

  return quantities;
}

export function updateCeBlocksFromFlow(blocks: any[], quantities: Record<string, number>) {
  return blocks.map((block) => ({
    ...block,
    lines: block.lines.map((line: any) =>
      line.rateCode && quantities[line.rateCode] !== undefined
        ? { ...line, quantity: quantities[line.rateCode] }
        : line
    )
  }));
}

export function ceFlowDiff(blocks: any[], quantities: Record<string, number>) {
  const result: Array<{ name: string; rateCode: string; ce: number; flow: number }> = [];

  for (const block of blocks) {
    for (const line of block.lines) {
      if (!line.rateCode || quantities[line.rateCode] === undefined) {
        continue;
      }
      const ce = Number(line.quantity ?? 0);
      const flow = quantities[line.rateCode];
      if (ce !== flow) {
        result.push({
          name: line.service,
          rateCode: line.rateCode,
          ce,
          flow
        });
      }
    }
  }

  return result;
}

