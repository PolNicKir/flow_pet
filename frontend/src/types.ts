export type User = {
  id: string;
  login: string;
  displayName: string;
};

export type Project = {
  id: string;
  type: 'PROJECT' | 'TEMPLATE';
  name: string;
  client: string;
  brand: string;
  currency: string;
  ownerId: string;
  updatedAt: string;
  owner?: {
    id: string;
    displayName: string;
  };
  ceDocument?: CeDocument;
};

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

export type CeDocument = {
  id: string;
  projectId: string;
  requisites: Record<string, unknown>;
  blocks: CeBlock[];
  ratesSnapshot: unknown[];
  adjustments: Record<string, unknown>;
  totals: {
    subtotal: number;
    totalWithoutVat: number;
    warnings: string[];
  };
};

export type Rate = {
  id: string;
  code: string;
  name: string;
  amount: number;
  category: string;
  isActive: boolean;
};

export type FileAsset = {
  id: string;
  projectId: string;
  filename: string;
  mimeType: string;
  size: number;
};

export type FlowNodeRecord = {
  id: string;
  slideNumber: string;
  title: string;
  designType: string;
  codingType: string;
  popupsCount: number;
  comments: string;
  positionX: number;
  positionY: number;
  mainImageFileId?: string | null;
  compact: boolean;
  meta?: Record<string, unknown>;
};

export type FlowEdgeRecord = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label: string;
  color: string;
  lineType: string;
};

export type FlowRecord = {
  id: string;
  projectId: string;
  name: string;
  order: number;
  viewport: Record<string, unknown>;
  nodes: FlowNodeRecord[];
  edges: FlowEdgeRecord[];
};

export type ProjectLock = {
  userId: string;
  displayName: string;
  lockedAt: string;
  expiresAt: string;
};

export type VersionRecord = {
  id: string;
  projectId: string;
  userId: string;
  comment: string;
  actionType: string;
  createdAt: string;
  user?: {
    id: string;
    displayName: string;
  };
};

export type CeFlowDiff = {
  name: string;
  rateCode: string;
  ce: number;
  flow: number;
};
