import sharp = require('sharp');
import { FilesService } from '../files/files.service';

type FlowLike = {
  name: string;
  nodes: Array<{
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
  }>;
  edges: Array<{ sourceNodeId: string; targetNodeId: string; label?: string }>;
};

export async function renderFlowPng(flow: FlowLike, files: FilesService, options: { includeComments?: boolean } = {}) {
  const includeComments = options.includeComments ?? true;
  const bounds = getBounds(flow);
  const imageCache = new Map<string, string>();
  const parts: string[] = [];

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}">`);
  parts.push(`<defs><marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" fill="#64748b"/></marker></defs>`);

  for (const edge of flow.edges) {
    const source = flow.nodes.find((node) => node.id === edge.sourceNodeId);
    const target = flow.nodes.find((node) => node.id === edge.targetNodeId);
    if (!source || !target) continue;
    const x1 = source.positionX - bounds.minX + 330;
    const y1 = source.positionY - bounds.minY + 84;
    const x2 = target.positionX - bounds.minX;
    const y2 = target.positionY - bounds.minY + 84;
    const midX = (x1 + x2) / 2;
    parts.push(`<path d="M${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}" stroke="#64748b" stroke-width="2" fill="none" marker-end="url(#arrow)"/>`);
    if (edge.label) {
      parts.push(`<text x="${midX}" y="${(y1 + y2) / 2 - 6}" font-size="12" fill="#334155">${escapeXml(edge.label)}</text>`);
    }
  }

  for (const node of flow.nodes) {
    const x = node.positionX - bounds.minX;
    const y = node.positionY - bounds.minY;
    parts.push(`<g transform="translate(${x},${y})">`);
    parts.push(`<rect width="330" height="168" rx="8" fill="#ffffff" stroke="#cbd5e1"/>`);
    parts.push(`<rect x="10" y="10" width="132" height="112" rx="6" fill="#eef2f7" stroke="#cbd5e1"/>`);
    if (node.mainImageFileId) {
      let href = imageCache.get(node.mainImageFileId);
      if (!href) {
        try {
          const { file, buffer } = await files.getObjectBuffer(node.mainImageFileId);
          href = `data:${file.mimeType};base64,${buffer.toString('base64')}`;
          imageCache.set(node.mainImageFileId, href);
        } catch {
          href = '';
        }
      }
      if (href) parts.push(`<image x="10" y="10" width="132" height="112" href="${href}" preserveAspectRatio="xMidYMid slice"/>`);
    }
    parts.push(`<text x="152" y="28" font-size="14" font-weight="700" fill="#1f2933">${escapeXml(node.title || `Слайд ${node.slideNumber}`)}</text>`);
    parts.push(`<text x="152" y="52" font-size="11" fill="#475569">№ ${escapeXml(node.slideNumber || '')}</text>`);
    parts.push(`<text x="152" y="74" font-size="11" fill="#0f766e">${escapeXml(node.designType || 'design')}</text>`);
    parts.push(`<text x="152" y="94" font-size="11" fill="#334155">${escapeXml(node.codingType || 'coding')}</text>`);
    parts.push(`<text x="152" y="114" font-size="11" fill="#334155">pop-ups: ${Number(node.popupsCount ?? 0)}</text>`);
    if (includeComments) {
      parts.push(`<text x="10" y="146" font-size="11" fill="#475569">${escapeXml(truncate(node.comments || '', 56))}</text>`);
    }
    parts.push(`</g>`);
  }

  parts.push(`</svg>`);
  return sharp(Buffer.from(parts.join(''))).png().toBuffer();
}

function getBounds(flow: FlowLike) {
  if (flow.nodes.length === 0) return { minX: 0, minY: 0, width: 1200, height: 800 };
  const minX = Math.min(...flow.nodes.map((node) => node.positionX)) - 80;
  const minY = Math.min(...flow.nodes.map((node) => node.positionY)) - 80;
  const maxX = Math.max(...flow.nodes.map((node) => node.positionX + 330)) + 80;
  const maxY = Math.max(...flow.nodes.map((node) => node.positionY + 168)) + 80;
  return { minX, minY, width: Math.max(800, maxX - minX), height: Math.max(600, maxY - minY) };
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char] ?? char);
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}
