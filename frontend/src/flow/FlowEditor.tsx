import {
  Background,
  Connection,
  Controls,
  Edge,
  Handle,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState
} from '@xyflow/react';
import { ImagePlus, LayoutGrid, Maximize2, Minimize2, Plus, Save } from 'lucide-react';
import { ClipboardEvent, DragEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api, downloadFile, uploadFile } from '../api';
import { CeDocument, CeFlowDiff, FileAsset, FlowEdgeRecord, FlowNodeRecord, FlowRecord } from '../types';

const DESIGN_TYPES = [
  'new simple design',
  'simple design adaptation',
  'new medium design',
  'medium design adaptation',
  'new complex design',
  'complex design adaptation'
];

const CODING_TYPES = [
  'new simple coding',
  'simple coding adaptation',
  'new medium coding',
  'medium coding adaptation',
  'new complex coding',
  'complex coding adaptation'
];

type SlideData = {
  slideNumber: string;
  title: string;
  designType: string;
  codingType: string;
  popupsCount: number;
  comments: string;
  mainImageFileId?: string | null;
  compact: boolean;
  onChange: (id: string, patch: Partial<SlideData>) => void;
  onUpload: (id: string, file: File) => Promise<void>;
  readOnly: boolean;
};

type SlideNode = Node<SlideData, 'slide'>;

export function FlowEditor({
  projectId,
  readOnly,
  onCeUpdated
}: {
  projectId: string;
  readOnly: boolean;
  onCeUpdated: (ce: CeDocument) => void;
}) {
  const [flows, setFlows] = useState<FlowRecord[]>([]);
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [flowName, setFlowName] = useState('Flow 1');
  const [nodes, setNodes, onNodesChange] = useNodesState<SlideNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [diff, setDiff] = useState<CeFlowDiff[]>([]);

  const updateNode = useCallback(
    (id: string, patch: Partial<SlideData>) => {
      if (readOnly) return;
      setNodes((current) =>
        current.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...patch } } : node))
      );
      setDirty(true);
      setSaveStatus('Есть несохраненные изменения');
    },
    [readOnly, setNodes]
  );

  const uploadNodeImage = useCallback(
    async (id: string, file: File) => {
      const uploaded = await uploadFile<FileAsset>(`/projects/${projectId}/files`, file);
      updateNode(id, { mainImageFileId: uploaded.id });
    },
    [projectId, updateNode]
  );

  const nodeTypes = useMemo(
    () => ({
      slide: (props: NodeProps<SlideNode>) => <SlideCard {...props} />
    }),
    []
  );

  async function loadFlows() {
    const result = await api<FlowRecord[]>(`/projects/${projectId}/flows`);
    setFlows(result);
    if (result.length > 0) {
      selectFlow(result[0], updateNode, uploadNodeImage);
    }
  }

  async function loadDiff(flowId = activeFlowId) {
    if (!flowId) return;
    setDiff(await api<CeFlowDiff[]>(`/flows/${flowId}/ce-diff`));
  }

  useEffect(() => {
    void loadFlows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    setNodes((current) => current.map((node) => ({ ...node, data: { ...node.data, readOnly } })));
  }, [readOnly, setNodes]);

  function selectFlow(flow: FlowRecord, onChange: SlideData['onChange'], onUpload: SlideData['onUpload']) {
    setActiveFlowId(flow.id);
    setFlowName(flow.name);
    setNodes(flow.nodes.map((node) => toReactNode(node, onChange, onUpload, readOnly)));
    setEdges(flow.edges.map(toReactEdge));
    setDirty(false);
    void loadDiff(flow.id);
  }

  async function createFlow() {
    if (readOnly) return;
    const flow = await api<FlowRecord>(`/projects/${projectId}/flows`, {
      method: 'POST',
      body: JSON.stringify({ name: `Flow ${flows.length + 1}` })
    });
    setFlows([...flows, flow]);
    selectFlow(flow, updateNode, uploadNodeImage);
  }

  function addSlide() {
    const id = crypto.randomUUID();
    const count = nodes.length + 1;
    setNodes((current) => [
      ...current,
      {
        id,
        type: 'slide',
        position: { x: 80 + (count % 3) * 340, y: 80 + Math.floor(count / 3) * 220 },
        data: {
          slideNumber: String(count),
          title: '',
          designType: '',
          codingType: '',
          popupsCount: 0,
          comments: '',
          mainImageFileId: null,
          compact: true,
          onChange: updateNode,
          onUpload: uploadNodeImage,
          readOnly
        }
      }
    ]);
    setDirty(true);
    setSaveStatus('Есть несохраненные изменения');
  }

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      setEdges((current) => addEdge({ ...connection, type: 'smoothstep' }, current));
      setDirty(true);
      setSaveStatus('Есть несохраненные изменения');
    },
    [readOnly, setEdges]
  );

  function autoLayout() {
    if (readOnly) return;
    setNodes((current) =>
      current.map((node, index) => ({
        ...node,
        position: {
          x: 80 + (index % 3) * 360,
          y: 80 + Math.floor(index / 3) * 230
        }
      }))
    );
    setDirty(true);
    setSaveStatus('Есть несохраненные изменения');
  }

  function buildFlowPayload(comment: string, autosave = false) {
    return {
      name: flowName,
      viewport: {},
      nodes: nodes.map((node) => ({
        id: node.id,
        slideNumber: node.data.slideNumber,
        title: node.data.title,
        designType: node.data.designType,
        codingType: node.data.codingType,
        popupsCount: node.data.popupsCount,
        comments: node.data.comments,
        positionX: node.position.x,
        positionY: node.position.y,
        mainImageFileId: node.data.mainImageFileId,
        compact: node.data.compact
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        label: edge.label ?? '',
        color: '#64748b',
        lineType: edge.type ?? 'smoothstep'
      })),
      comment,
      autosave
    };
  }

  async function saveFlow() {
    if (!activeFlowId || readOnly) return;
    const comment = promptRequired('Комментарий к версии flow');
    if (!comment) return;
    setSaving(true);
    try {
      const saved = await api<FlowRecord>(`/flows/${activeFlowId}`, {
        method: 'PUT',
        body: JSON.stringify(buildFlowPayload(comment))
      });
      setFlows((current) => current.map((flow) => (flow.id === saved.id ? saved : flow)));
      selectFlow(saved, updateNode, uploadNodeImage);
      setDirty(false);
      setSaveStatus('Сохранено');
      await loadDiff(saved.id);
    } finally {
      setSaving(false);
    }
  }

  async function syncToCe() {
    if (!activeFlowId || readOnly) return;
    if (!window.confirm('Перенести количества текущего flow в стандартные строки CE?')) return;
    const comment = promptRequired('Комментарий к версии Flow → CE');
    if (!comment) return;
    const updated = await api<CeDocument>(`/flows/${activeFlowId}/sync-to-ce`, {
      method: 'POST',
      body: JSON.stringify({ comment })
    });
    onCeUpdated(updated);
    await loadDiff(activeFlowId);
  }

  async function autosaveFlow() {
    if (!activeFlowId || readOnly || !dirty) return;
    const saved = await api<FlowRecord>(`/flows/${activeFlowId}`, {
      method: 'PUT',
      body: JSON.stringify(buildFlowPayload('Автосохранено', true))
    });
    setFlows((current) => current.map((flow) => (flow.id === saved.id ? saved : flow)));
    setDirty(false);
    setSaveStatus(`Автосохранено ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`);
    await loadDiff(saved.id);
  }

  useEffect(() => {
    if (!activeFlowId || readOnly || !dirty) return;
    const timer = window.setInterval(() => {
      void autosaveFlow().catch(() => setSaveStatus('Автосохранение не удалось'));
    }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFlowId, readOnly, dirty, nodes, edges, flowName]);

  async function exportImage() {
    if (!activeFlowId) return;
    await downloadFile(`/flows/${activeFlowId}/export/image`);
  }

  const statistics = useMemo(() => calculateStatistics(nodes), [nodes]);

  return (
    <div className="flow-workspace">
      <aside className="flow-sidebar panel">
        <div className="flow-list-head">
          <h3>Flow</h3>
          <button className="primary icon-button" onClick={createFlow} disabled={readOnly}>
            <Plus size={16} /> Flow
          </button>
        </div>
        <div className="flow-tabs">
          {flows.map((flow) => (
            <button
              key={flow.id}
              className={flow.id === activeFlowId ? 'active' : ''}
              onClick={() => selectFlow(flow, updateNode, uploadNodeImage)}
            >
              {flow.name}
            </button>
          ))}
        </div>
        {activeFlowId && (
          <form className="flow-settings" onSubmit={(event: FormEvent) => event.preventDefault()}>
            <label>
              Название flow
              <input value={flowName} onChange={(event) => { setFlowName(event.target.value); setDirty(true); setSaveStatus('Есть несохраненные изменения'); }} />
            </label>
            <button className="ghost icon-button" type="button" onClick={addSlide} disabled={readOnly}>
              <Plus size={16} /> Слайд
            </button>
            <button className="ghost icon-button" type="button" onClick={autoLayout} disabled={readOnly}>
              <LayoutGrid size={16} /> Автолэйаут
            </button>
            <button className="primary icon-button" type="button" onClick={saveFlow} disabled={saving || readOnly}>
              <Save size={16} /> {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button className="ghost" type="button" onClick={syncToCe} disabled={readOnly || !activeFlowId}>
              Создать/обновить CE из flow
            </button>
            <button className="ghost" type="button" onClick={exportImage} disabled={!activeFlowId}>
              PNG flow
            </button>
            <div className={dirty ? 'dirty-badge' : 'saved-badge'}>{dirty ? 'Есть несохранённые изменения' : 'Сохранено'}</div>
            {saveStatus && <div className={dirty ? 'dirty-badge' : 'saved-badge'}>{saveStatus}</div>}
          </form>
        )}
        <div className="flow-stats">
          <strong>Статистика</strong>
          <span>Слайды: {statistics.totalSlides}</span>
          <span>Поп-апы: {statistics.popups}</span>
          {Object.entries(statistics.design).filter(([, count]) => count > 0).map(([key, count]) => (
            <span key={key}>{key}: {count}</span>
          ))}
          {Object.entries(statistics.coding).filter(([, count]) => count > 0).map(([key, count]) => (
            <span key={key}>{key}: {count}</span>
          ))}
        </div>
        {diff.length > 0 && (
          <div className="flow-diff warning">
            <strong>Расхождения CE и flow</strong>
            {diff.map((item) => (
              <span key={item.rateCode}>{item.name}: CE {item.ce}, Flow {item.flow}</span>
            ))}
          </div>
        )}
      </aside>
      <section className="flow-canvas panel">
        {activeFlowId ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={(changes) => { if (!readOnly) { onNodesChange(changes); setDirty(true); setSaveStatus('Есть несохраненные изменения'); } }}
            onEdgesChange={(changes) => { if (!readOnly) { onEdgesChange(changes); setDirty(true); setSaveStatus('Есть несохраненные изменения'); } }}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onlyRenderVisibleElements
            fitView
          >
            <Background />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        ) : (
          <div className="empty-state">Создайте первый flow</div>
        )}
      </section>
    </div>
  );
}

function SlideCard({ id, data }: NodeProps<SlideNode>) {
  async function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const item = Array.from(event.clipboardData.items).find((entry) => entry.type.startsWith('image/'));
    const file = item?.getAsFile();
    if (file) {
      event.preventDefault();
      if (data.readOnly) return;
      await data.onUpload(id, file);
    }
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = Array.from(event.dataTransfer.files).find((entry) => entry.type.startsWith('image/'));
    if (file) {
      if (data.readOnly) return;
      await data.onUpload(id, file);
    }
  }

  return (
    <div className={data.compact ? 'slide-card compact' : 'slide-card expanded'} onPaste={handlePaste} tabIndex={0}>
      <Handle type="target" position={Position.Left} />
      <div
        className="slide-image"
        onDrop={handleDrop}
        onDragOver={(event) => event.preventDefault()}
      >
        {data.mainImageFileId ? (
          <img src={`/api/files/${data.mainImageFileId}`} alt="" loading="lazy" decoding="async" />
        ) : (
          <label className="image-placeholder">
            <ImagePlus size={18} />
            <span>Ctrl+V или файл</span>
            <input
              type="file"
              accept="image/*"
              disabled={data.readOnly}
              onChange={(event) => event.target.files?.[0] && !data.readOnly && data.onUpload(id, event.target.files[0])}
            />
          </label>
        )}
      </div>
      <div className="slide-body">
        <div className="slide-topline">
          <input
            value={data.title}
            placeholder="Название слайда"
            disabled={data.readOnly}
            onChange={(event) => data.onChange(id, { title: event.target.value })}
          />
          <button className="tiny-icon" disabled={data.readOnly} onClick={() => data.onChange(id, { compact: !data.compact })}>
            {data.compact ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
        </div>
        <div className="slide-controls">
          <input
            value={data.slideNumber}
            placeholder="№"
            disabled={data.readOnly}
            onChange={(event) => data.onChange(id, { slideNumber: event.target.value })}
          />
          <select value={data.designType} disabled={data.readOnly} onChange={(event) => data.onChange(id, { designType: event.target.value })}>
            <option value="">design</option>
            {DESIGN_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
          <select value={data.codingType} disabled={data.readOnly} onChange={(event) => data.onChange(id, { codingType: event.target.value })}>
            <option value="">coding</option>
            {CODING_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
          <input
            type="number"
            min={0}
            value={data.popupsCount}
            title="Поп-апы"
            disabled={data.readOnly}
            onChange={(event) => data.onChange(id, { popupsCount: Number(event.target.value) })}
          />
        </div>
        <textarea
          value={data.comments}
          placeholder="Комментарий"
          disabled={data.readOnly}
          onChange={(event) => data.onChange(id, { comments: event.target.value })}
        />
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function toReactNode(node: FlowNodeRecord, onChange: SlideData['onChange'], onUpload: SlideData['onUpload'], readOnly = false): SlideNode {
  return {
    id: node.id,
    type: 'slide',
    position: { x: node.positionX, y: node.positionY },
    data: {
      slideNumber: node.slideNumber,
      title: node.title,
      designType: node.designType,
      codingType: node.codingType,
      popupsCount: node.popupsCount,
      comments: node.comments,
      mainImageFileId: node.mainImageFileId,
      compact: node.compact,
      onChange,
      onUpload,
      readOnly
    }
  };
}

function promptRequired(title: string) {
  const value = window.prompt(title);
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) {
    window.alert('Комментарий обязателен.');
    return null;
  }
  return trimmed;
}

function toReactEdge(edge: FlowEdgeRecord): Edge {
  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    label: edge.label,
    type: edge.lineType || 'smoothstep'
  };
}

function calculateStatistics(nodes: SlideNode[]) {
  const design = Object.fromEntries(DESIGN_TYPES.map((type) => [type, 0])) as Record<string, number>;
  const coding = Object.fromEntries(CODING_TYPES.map((type) => [type, 0])) as Record<string, number>;
  let popups = 0;

  for (const node of nodes) {
    if (node.data.designType && design[node.data.designType] !== undefined) {
      design[node.data.designType] += 1;
    }
    if (node.data.codingType && coding[node.data.codingType] !== undefined) {
      coding[node.data.codingType] += 1;
    }
    popups += Number(node.data.popupsCount ?? 0);
  }

  return { totalSlides: nodes.length, design, coding, popups };
}
