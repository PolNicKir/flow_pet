export const DESIGN_TYPES = [
  'new simple design',
  'simple design adaptation',
  'new medium design',
  'medium design adaptation',
  'new complex design',
  'complex design adaptation'
];

export const CODING_TYPES = [
  'new simple coding',
  'simple coding adaptation',
  'new medium coding',
  'medium coding adaptation',
  'new complex coding',
  'complex coding adaptation'
];

export function calculateFlowStatistics(nodes: Array<{ designType?: string; codingType?: string; popupsCount?: number }>) {
  const design = Object.fromEntries(DESIGN_TYPES.map((type) => [type, 0])) as Record<string, number>;
  const coding = Object.fromEntries(CODING_TYPES.map((type) => [type, 0])) as Record<string, number>;
  let popups = 0;

  for (const node of nodes) {
    if (node.designType && design[node.designType] !== undefined) {
      design[node.designType] += 1;
    }
    if (node.codingType && coding[node.codingType] !== undefined) {
      coding[node.codingType] += 1;
    }
    popups += Number(node.popupsCount ?? 0);
  }

  return {
    totalSlides: nodes.length,
    design,
    coding,
    popups
  };
}

