import { Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import fontkit = require('@pdf-lib/fontkit');
import ExcelJS = require('exceljs');
import JSZip = require('jszip');
import sharp = require('sharp');
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { FilesService } from '../files/files.service';
import { PrismaService } from '../prisma/prisma.service';
import { renderFlowPng } from './export-renderer';

type PageFormat = 'A4' | 'A3' | 'A2' | 'A1';
const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;

const PAGE_SIZES: Record<PageFormat, [number, number]> = {
  A4: [841.89, 595.28],
  A3: [1190.55, 841.89],
  A2: [1683.78, 1190.55],
  A1: [2383.94, 1683.78]
};

@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService
  ) {}

  async flowImage(flowId: string) {
    const flow = await this.getFlow(flowId);
    return {
      filename: `${safeName(flow.name)}_${datePart()}.png`,
      contentType: 'image/png',
      buffer: await renderFlowPng(flow as any, this.files)
    };
  }

  async projectPdf(projectId: string, format: PageFormat = 'A3') {
    const project = await this.getProject(projectId);
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const font = await this.embedPdfFont(pdf);
    const cePage = pdf.addPage([595.28, 841.89]);
    let y = 800;
    cePage.drawText(pdfText(`${project.client || 'Client'} / ${project.brand || project.name}`), { x: 40, y, size: 16, font, color: rgb(0.06, 0.13, 0.2) });
    y -= 30;
    cePage.drawText('Commercial Estimate', { x: 40, y, size: 12, font });
    y -= 28;

    const ce = project.ceDocument;
    for (const block of ((ce?.blocks ?? []) as any[])) {
      cePage.drawText(pdfText(block.title), { x: 40, y, size: 11, font, color: rgb(0.06, 0.46, 0.43) });
      y -= 18;
      for (const line of block.lines ?? []) {
        cePage.drawText(pdfText(`${line.service}: ${line.quantity ?? ''} x ${line.rate ?? ''} = ${line.total ?? ''}`), { x: 52, y, size: 9, font });
        y -= 14;
        if (y < 60) y = this.addCePage(pdf, font);
      }
      y -= 8;
    }
    cePage.drawText(`Total without VAT: ${((ce?.totals as any)?.totalWithoutVat ?? 0)}`, { x: 40, y: Math.max(40, y), size: 12, font });

    for (const flow of project.flows) {
      const png = await renderFlowPng(flow as any, this.files, { includeComments: false });
      const image = await pdf.embedPng(png);
      const [width, height] = PAGE_SIZES[format];
      const page = pdf.addPage([width, height]);
      const scale = Math.min((width - 48) / image.width, (height - 64) / image.height);
      page.drawText(pdfText(flow.name), { x: 24, y: height - 28, size: 14, font });
      page.drawImage(image, { x: 24, y: 24, width: image.width * scale, height: image.height * scale });
    }

    return {
      filename: `${safeName(project.client)}_${safeName(project.brand || project.name)}_Смета_${datePart()}.pdf`,
      contentType: 'application/pdf',
      buffer: Buffer.from(await pdf.save())
    };
  }

  async projectXlsx(projectId: string) {
    const project = await this.getProject(projectId);
    const workbook = new ExcelJS.Workbook();
    const ceSheet = workbook.addWorksheet('CE');
    ceSheet.columns = [
      { header: 'Услуга', key: 'service', width: 42 },
      { header: 'Ставка', key: 'rate', width: 14 },
      { header: 'Количество', key: 'quantity', width: 14 },
      { header: 'Всего', key: 'total', width: 18 }
    ];

    let rowIndex = 2;
    for (const block of ((project.ceDocument?.blocks ?? []) as any[])) {
      ceSheet.addRow([block.title]);
      rowIndex++;
      const firstLineRow = rowIndex;
      for (const line of block.lines ?? []) {
        const row = ceSheet.addRow([line.service, line.rate ?? 0, line.quantity ?? 0, { formula: `B${rowIndex}*C${rowIndex}` }]);
        row.getCell(4).numFmt = '#,##0';
        rowIndex++;
      }
      ceSheet.addRow(['Итого блока', '', '', { formula: `SUM(D${firstLineRow}:D${Math.max(firstLineRow, rowIndex - 1)})` }]);
      rowIndex++;
    }

    for (const flow of project.flows) {
      const sheet = workbook.addWorksheet(flow.name.slice(0, 28));
      const imageBuffer = await renderFlowPng(flow as any, this.files);
      const imageId = workbook.addImage({ buffer: imageBuffer as any, extension: 'png' });
      sheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 900, height: 520 } });
      sheet.getCell('A31').value = 'Slide';
      sheet.getCell('B31').value = 'Title';
      sheet.getCell('C31').value = 'Design';
      sheet.getCell('D31').value = 'Coding';
      sheet.getCell('E31').value = 'Pop-ups';
      let row = 32;
      for (const node of flow.nodes) {
        sheet.getRow(row).values = [node.slideNumber, node.title, node.designType, node.codingType, node.popupsCount];
        row++;
      }
      addFlowShapes(sheet, flow.nodes, flow.edges);
    }

    return {
      filename: `${safeName(project.client)}_${safeName(project.brand || project.name)}_Смета_${datePart()}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(await workbook.xlsx.writeBuffer())
    };
  }

  async projectArchive(projectId: string) {
    const project = await this.getProject(projectId);
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ version: 1, exportedAt: new Date().toISOString() }, null, 2));
    zip.file('project.json', JSON.stringify({ ...project, ceDocument: undefined, flows: undefined, files: undefined }, null, 2));
    zip.file('ce.json', JSON.stringify(project.ceDocument, null, 2));
    const flowsFolder = zip.folder('flows')!;
    for (const flow of project.flows) flowsFolder.file(`${flow.id}.json`, JSON.stringify(flow, null, 2));
    const assets = zip.folder('assets')!;
    for (const file of project.files) {
      try {
        const object = await this.files.getObjectBuffer(file.id);
        const packed = await compressArchiveAsset(object.buffer, file.filename, file.mimeType);
        assets.file(`${file.id}-${packed.filename}`, packed.buffer);
      } catch {}
    }
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    if (buffer.length > MAX_ARCHIVE_BYTES) {
      throw new PayloadTooLargeException('Project archive is larger than 50 MB after image compression');
    }
    return {
      filename: `${safeName(project.client)}_${safeName(project.brand || project.name)}_Проект_${datePart()}.flow.zip`,
      contentType: 'application/zip',
      buffer
    };
  }

  async importArchive(userId: string, file: Express.Multer.File) {
    const zip = await JSZip.loadAsync(file.buffer);
    const projectJson = JSON.parse(await zip.file('project.json')!.async('string'));
    const ceJson = JSON.parse(await zip.file('ce.json')!.async('string'));
    const flowFiles = Object.values(zip.files).filter((entry) => entry.name.startsWith('flows/') && entry.name.endsWith('.json'));
    const project = await this.prisma.project.create({
      data: {
        type: projectJson.type,
        name: `${projectJson.name} import`,
        client: projectJson.client ?? '',
        brand: projectJson.brand ?? '',
        currency: projectJson.currency ?? 'KZT',
        ownerId: userId,
        ceDocument: {
          create: {
            requisites: ceJson.requisites,
            blocks: ceJson.blocks,
            ratesSnapshot: ceJson.ratesSnapshot,
            adjustments: ceJson.adjustments,
            totals: ceJson.totals
          }
        }
      }
    });

    const assetIdMap = new Map<string, string>();
    const assetEntries = Object.values(zip.files).filter((entry) => entry.name.startsWith('assets/') && !entry.dir);
    for (const entry of assetEntries) {
      const originalId = entry.name.replace('assets/', '').split('-')[0];
      const filename = entry.name.replace(/^assets\/[^-]+-/, '');
      const buffer = await entry.async('nodebuffer');
      const imported = await this.files.putImportedFile(project.id, userId, filename, mimeFromName(filename), buffer);
      assetIdMap.set(originalId, imported.id);
    }

    for (const entry of flowFiles as any[]) {
      const flow = JSON.parse(await entry.async('string'));
      const nodeIdMap = new Map<string, string>();
      for (const node of flow.nodes ?? []) nodeIdMap.set(node.id, randomUUID());
      await this.prisma.flow.create({
        data: {
          projectId: project.id,
          name: flow.name,
          order: flow.order,
          viewport: flow.viewport ?? {},
          nodes: {
            create: (flow.nodes ?? []).map((node: any) => ({
              id: nodeIdMap.get(node.id),
              slideNumber: node.slideNumber ?? '',
              title: node.title ?? '',
              designType: node.designType ?? '',
              codingType: node.codingType ?? '',
              popupsCount: node.popupsCount ?? 0,
              comments: node.comments ?? '',
              positionX: node.positionX ?? 0,
              positionY: node.positionY ?? 0,
              mainImageFileId: node.mainImageFileId ? assetIdMap.get(node.mainImageFileId) ?? null : null,
              additionalImageFileIds: [],
              compact: node.compact ?? true,
              meta: node.meta ?? {}
            }))
          },
          edges: {
            create: (flow.edges ?? []).map((edge: any) => ({
              id: randomUUID(),
              sourceNodeId: nodeIdMap.get(edge.sourceNodeId) ?? edge.sourceNodeId,
              targetNodeId: nodeIdMap.get(edge.targetNodeId) ?? edge.targetNodeId,
              label: edge.label ?? '',
              color: edge.color ?? '#64748b',
              lineType: edge.lineType ?? 'smoothstep',
              meta: edge.meta ?? {}
            }))
          }
        }
      });
    }

    return this.prisma.project.findUnique({
      where: { id: project.id },
      include: { ceDocument: true, owner: { select: { id: true, displayName: true } } }
    });
  }

  private addCePage(pdf: PDFDocument, font: any) {
    const page = pdf.addPage([595.28, 841.89]);
    page.drawText('Commercial Estimate continued', { x: 40, y: 800, size: 12, font });
    return 770;
  }

  private async embedPdfFont(pdf: PDFDocument) {
    try {
      const fontBytes = await readFile('/usr/share/fonts/dejavu/DejaVuSans.ttf');
      return pdf.embedFont(fontBytes);
    } catch {
      return pdf.embedFont(StandardFonts.Helvetica);
    }
  }

  private async getProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { ceDocument: true, flows: { include: { nodes: true, edges: true }, orderBy: { order: 'asc' } }, files: true }
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async getFlow(flowId: string) {
    const flow = await this.prisma.flow.findUnique({ where: { id: flowId }, include: { nodes: true, edges: true } });
    if (!flow) throw new NotFoundException('Flow not found');
    return flow;
  }
}

function safeName(value?: string | null) {
  return (value || 'Flow').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_');
}

function datePart() {
  return new Date().toISOString().slice(0, 10);
}

function pdfText(value: string) {
  return value;
}

function mimeFromName(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

function addFlowShapes(sheet: ExcelJS.Worksheet, nodes: any[], edges: any[]) {
  const startRow = 62;
  sheet.getCell(`A${startRow}`).value = 'Flow shapes';
  sheet.getCell(`A${startRow}`).font = { bold: true, size: 14 };

  if (nodes.length === 0) return;
  const minX = Math.min(...nodes.map((node) => Number(node.positionX ?? 0)));
  const minY = Math.min(...nodes.map((node) => Number(node.positionY ?? 0)));
  const placed = new Map<string, { row: number; col: number }>();

  nodes.forEach((node) => {
    const col = Math.max(1, Math.round((Number(node.positionX ?? 0) - minX) / 95) + 1);
    const row = Math.max(startRow + 2, startRow + 2 + Math.round((Number(node.positionY ?? 0) - minY) / 42));
    placed.set(node.id, { row, col });
    sheet.mergeCells(row, col, row + 2, col + 2);
    const cell = sheet.getCell(row, col);
    cell.value = `${node.slideNumber || ''} ${node.title || 'Slide'}\n${node.designType || ''}\n${node.codingType || ''}`;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2A6' } };
    cell.border = boxBorder('FF1F5EFF');
    cell.font = { bold: true, color: { argb: 'FF143268' }, size: 10 };
  });

  const edgeRow = startRow + 2 + Math.max(...nodes.map((node) => Math.round((Number(node.positionY ?? 0) - minY) / 42))) + 5;
  sheet.getCell(edgeRow, 1).value = 'Connections';
  sheet.getCell(edgeRow, 1).font = { bold: true };
  edges.forEach((edge, index) => {
    const source = placed.get(edge.sourceNodeId);
    const target = placed.get(edge.targetNodeId);
    sheet.getCell(edgeRow + index + 1, 1).value = source && target
      ? `${edge.sourceNodeId} -> ${edge.targetNodeId}${edge.label ? ` (${edge.label})` : ''}`
      : `${edge.sourceNodeId} -> ${edge.targetNodeId}`;
  });
}

function boxBorder(color: string) {
  return {
    top: { style: 'thin', color: { argb: color } },
    left: { style: 'thin', color: { argb: color } },
    bottom: { style: 'thin', color: { argb: color } },
    right: { style: 'thin', color: { argb: color } }
  } as Partial<ExcelJS.Borders>;
}

async function compressArchiveAsset(buffer: Buffer, filename: string, mimeType: string) {
  if (!mimeType.startsWith('image/') || mimeType === 'image/svg+xml' || buffer.length < 700 * 1024) {
    return { filename, buffer };
  }

  try {
    const compressed = await sharp(buffer)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 76, mozjpeg: true })
      .toBuffer();
    if (compressed.length < buffer.length) {
      return { filename: replaceExtension(filename, 'jpg'), buffer: compressed };
    }
  } catch {}

  return { filename, buffer };
}

function replaceExtension(filename: string, extension: string) {
  return filename.includes('.') ? filename.replace(/\.[^.]+$/, `.${extension}`) : `${filename}.${extension}`;
}
