import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow, addEdge, applyNodeChanges, applyEdgeChanges, Background, Controls,
  ReactFlowProvider, useReactFlow, Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { toPng } from 'html-to-image';
import CustomNode from './CustomNode';
import { db } from './firebase';
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc } from "firebase/firestore";

const nodeTypes = { modernCard: CustomNode };
const STORAGE_KEY = 'vhd-modern-node-data';
const SETTINGS_KEY = 'vhd-modern-node-settings';
const ADMIN_PW_KEY = 'vhd-admin-pw';

const APP_VERSION = "1.3.1";
const UPDATE_LOGS = [
  { version: '1.3.1', date: '27/03/2026', notes: ['Đồng bộ cụm nút công cụ (Thêm Node, Cài đặt) xuống góc phải dưới cho cả Desktop và Mobile', 'Kiểm tra và tối ưu toàn diện các chức năng'] },
  { version: '1.3.0', date: '27/03/2026', notes: ['Tối ưu UI, thêm nút Cài đặt App nổi bật', 'Hỗ trợ đè lâu (Long-press) để xoá Node trên Mobile', 'Khôi phục tính năng Đổi mật khẩu Admin'] },
  { version: '1.2.1', date: '27/03/2026', notes: ['Khôi phục chức năng Đổi màu Dot/Nền và cắt dây Middle Node', 'Thêm Animation pop-up mượt mà', 'Hỗ trợ Click Outside để đóng Modal'] },
  { version: '1.2.0', date: '27/03/2026', notes: ['Tích hợp Cloud Database (Firebase)', 'Tính năng Quản trị Alias Link', 'Bảo mật mã nguồn với .env'] }
];

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });
  nodes.forEach((node) => { dagreGraph.setNode(node.id, { width: 350, height: 150 }); });
  edges.forEach((edge) => { dagreGraph.setEdge(edge.source, edge.target); });
  dagre.layout(dagreGraph);
  return {
    nodes: nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      return { ...node, position: { x: nodeWithPosition.x - 175, y: nodeWithPosition.y - 75 } };
    }), edges
  };
};

const pathAlias = window.location.pathname.replace('/', '');
const isPublicView = pathAlias.length > 0; 

function Flow() {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const reactFlowWrapper = useRef(null);
  
  const [nodes, setNodesState] = useState([]);
  const [edges, setEdgesState] = useState([]);
  const [isAppReady, setIsAppReady] = useState(false);
  
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? JSON.parse(saved) : { lineType: 'smoothstep', nodeMaxWidth: 350, showColorDot: true };
  });

  const [menu, setMenu] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  
  // State quản lý Menu dấu + (Cho cả Mobile & Desktop)
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [aliasInput, setAliasInput] = useState('');
  const [newPwInput, setNewPwInput] = useState('');
  const [publicLinksData, setPublicLinksData] = useState({});
  const [isCloudLoading, setIsCloudLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (isPublicView) {
        try {
          const docRef = doc(db, "publicLinks", pathAlias);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setNodesState(docSnap.data().nodes || []);
            setEdgesState(docSnap.data().edges || []);
            setTimeout(() => fitView({ padding: 0.2 }), 100);
          } else { alert("Link không tồn tại!"); window.location.href = '/'; }
        } catch (error) { alert("Lỗi kết nối Máy chủ."); }
      } else {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setNodesState(parsed.nodes || []);
          setEdgesState(parsed.edges || []);
        } else {
          setNodesState([{ id: 'node-1', type: 'modernCard', position: { x: 250, y: 100 }, data: { title: '🚀 ROOT', content: 'Modern Node - VHD', color: '#facc15', nodeType: 'default', bgColor: '#1e293b' } }]);
        }
      }
      setIsAppReady(true);
    };
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (!isPublicView && isAppReady) localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges })); }, [nodes, edges, isAppReady]);
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setEdgesState((eds) => eds.map(e => ({ ...e, type: settings.lineType }))); }, [settings.lineType]);

  useEffect(() => {
    const handleBeforeInstall = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) { alert("Thiết bị đã cài App hoặc trình duyệt không hỗ trợ."); return; }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const handleForceReload = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => { registrations.forEach((registration) => registration.unregister()); });
    }
    window.location.reload(true);
  };

  const onNodesChange = useCallback((changes) => { if(!isPublicView) setNodesState((nds) => applyNodeChanges(changes, nds)); }, []);
  const onEdgesChange = useCallback((changes) => { if(!isPublicView) setEdgesState((eds) => applyEdgeChanges(changes, eds)); }, []);
  const onConnect = useCallback((connection) => { if(!isPublicView) setEdgesState((eds) => addEdge({ ...connection, type: settings.lineType, animated: true, style: { stroke: '#fb7185', strokeWidth: 3 } }, eds)); }, [settings.lineType]);

  const onPaneClick = useCallback(() => { setMenu(null); setIsAddMenuOpen(false); }, []);
  const onPaneContextMenu = useCallback((e) => { e.preventDefault(); if(!isPublicView) setMenu({ id: 'canvas', top: e.clientY, left: e.clientX, type: 'canvas' }); }, []);
  const onNodeContextMenu = useCallback((e, node) => { e.preventDefault(); if(!isPublicView) setMenu({ id: node.id, top: e.clientY, left: e.clientX, type: 'node', nodeData: node.data }); }, []);
  const onEdgeContextMenu = useCallback((e, edge) => { e.preventDefault(); if(!isPublicView) setMenu({ id: edge.id, top: e.clientY, left: e.clientX, type: 'edge' }); }, []);

  const handleAddNode = (nodeType = 'default') => { 
    let position;
    if (menu) {
      position = screenToFlowPosition({ x: menu.left, y: menu.top }); 
    } else {
      const pane = document.querySelector('.react-flow__pane');
      if (pane) {
        const center = pane.getBoundingClientRect();
        position = screenToFlowPosition({ x: center.width / 2, y: center.height / 2 });
      } else {
        position = { x: 0, y: 0 };
      }
    }
    setNodesState((nds) => nds.concat({ id: `node-${Date.now()}`, type: 'modernCard', position, data: { title: '💡 NODE MỚI', content: 'Nhập nội dung...', color: '#818cf8', nodeType, bgColor: '#1e293b' } })); 
    setMenu(null); 
    setIsAddMenuOpen(false);
  };
  
  const handleDeleteNode = () => { setNodesState((nds) => nds.filter((n) => n.id !== menu.id)); setEdgesState((eds) => eds.filter((e) => e.source !== menu.id && e.target !== menu.id)); setMenu(null); };
  const handleDeleteEdge = () => { setEdgesState((eds) => eds.filter((e) => e.id !== menu.id)); setMenu(null); };

  const handleAddMiddleNode = () => {
    if (!menu) return;
    const edge = edges.find(e => e.id === menu.id);
    if (!edge) return;
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return;
    const midX = (sourceNode.position.x + targetNode.position.x) / 2;
    const midY = (sourceNode.position.y + targetNode.position.y) / 2;
    const newNodeId = `node-${Date.now()}`;
    const newNode = { id: newNodeId, type: 'modernCard', position: { x: midX, y: midY }, data: { title: '🔗 MIDDLE NODE', content: 'Node ở giữa', color: '#c084fc', nodeType: 'default', bgColor: '#1e293b' } };
    const newEdge1 = { id: `e-${edge.source}-${newNodeId}`, source: edge.source, sourceHandle: edge.sourceHandle, target: newNodeId, targetHandle: 'top', type: settings.lineType, animated: true, style: { stroke: '#fb7185', strokeWidth: 3 } };
    const newEdge2 = { id: `e-${newNodeId}-${edge.target}`, source: newNodeId, sourceHandle: 'bottom', target: edge.target, targetHandle: edge.targetHandle, type: settings.lineType, animated: true, style: { stroke: '#fb7185', strokeWidth: 3 } };
    setNodesState(nds => nds.concat(newNode));
    setEdgesState(eds => eds.filter(e => e.id !== edge.id).concat([newEdge1, newEdge2]));
    setMenu(null);
  };

  const updateNodeSpecificData = (key, value, closeMenu = true) => { setNodesState((nds) => nds.map((n) => n.id === menu.id ? { ...n, data: { ...n.data, [key]: value } } : n)); if (closeMenu) setMenu(null); };

  const onLayout = useCallback((direction) => { const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, direction); setNodesState([...layoutedNodes]); setEdgesState([...layoutedEdges]); setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 50); setIsSettingsOpen(false); }, [nodes, edges, fitView]);
  const downloadImage = () => { toPng(document.querySelector('.react-flow__viewport'), { backgroundColor: '#020617' }).then((dataUrl) => { const a = document.createElement('a'); a.href = dataUrl; a.download = 'vhd_mindmap.png'; a.click(); }); setIsSettingsOpen(false); };
  const handleExportJSON = () => { const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ nodes, edges })); const a = document.createElement('a'); a.href = dataStr; a.download = "vhd_nodes.json"; a.click(); setIsSettingsOpen(false); };
  const handleImportJSON = (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (event) => { try { const parsed = JSON.parse(event.target.result); if (parsed.nodes && parsed.edges) { setNodesState(parsed.nodes); setEdgesState(parsed.edges); fitView(); } } catch (err) { alert("File không hợp lệ!"); } }; reader.readAsText(file); setIsSettingsOpen(false); };

  const handleAdminLogin = async () => {
    const currentPw = localStorage.getItem(ADMIN_PW_KEY) || '1234!@#$';
    if (pwInput === currentPw) {
      setIsAdminAuthOpen(false); setIsCloudLoading(true); setIsAdminPanelOpen(true);
      try {
        const querySnapshot = await getDocs(collection(db, "publicLinks"));
        let cloudLinks = {};
        querySnapshot.forEach((doc) => { cloudLinks[doc.id] = doc.data(); });
        setPublicLinksData(cloudLinks);
      } catch(err) { alert('Lỗi lấy dữ liệu đám mây!'); }
      setIsCloudLoading(false); setPwInput('');
    } else { alert('Mật khẩu sai!'); }
  };
  const handleChangeAdminPw = () => { if (!newPwInput.trim()) return; localStorage.setItem(ADMIN_PW_KEY, newPwInput.trim()); alert('Đổi mật khẩu thành công!'); setNewPwInput(''); };
  const handleSavePublicLink = async () => {
    if (!aliasInput.trim()) { alert('Vui lòng nhập Link Alias!'); return; }
    const formattedAlias = aliasInput.trim().toLowerCase();
    setIsCloudLoading(true);
    try {
      await setDoc(doc(db, "publicLinks", formattedAlias), { nodes, edges, updatedAt: new Date().toISOString() });
      setPublicLinksData({ ...publicLinksData, [formattedAlias]: { nodes, edges } });
      alert(`Đã lưu thành công!\nLink: ${window.location.origin}/${formattedAlias}`);
    } catch(err) { alert("Lỗi cấu hình Firebase!"); }
    setIsCloudLoading(false);
  };
  const handleDeletePublicLink = async (alias) => {
    if(window.confirm(`Xóa link /${alias}?`)) {
      setIsCloudLoading(true);
      try { await deleteDoc(doc(db, "publicLinks", alias)); const newData = { ...publicLinksData }; delete newData[alias]; setPublicLinksData(newData); } catch(err) { alert("Lỗi khi xóa!"); }
      setIsCloudLoading(false);
    }
  };
  const handleLoadLinkToCanvas = (alias) => { setNodesState(publicLinksData[alias].nodes || []); setEdgesState(publicLinksData[alias].edges || []); setAliasInput(alias); setIsAdminPanelOpen(false); setTimeout(() => fitView({ padding: 0.2 }), 50); };

  if (!isAppReady) return <div className="w-screen h-screen bg-slate-950 flex items-center justify-center text-white font-bold">Đang tải...</div>;

  return (
    <div className="w-screen h-screen bg-slate-950 relative" ref={reactFlowWrapper} style={{ '--node-max-width': `${settings.nodeMaxWidth || 350}px`, '--show-color-dot': settings.showColorDot ? 'block' : 'none' }}>
      <style>{`
        @keyframes modalPop { 0% { opacity: 0; transform: scale(0.95) translateY(10px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-modal-pop { animation: modalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
      `}</style>

      <ReactFlow
        nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
        onPaneClick={onPaneClick} onPaneContextMenu={onPaneContextMenu} onNodeContextMenu={onNodeContextMenu} onEdgeContextMenu={onEdgeContextMenu}
        nodeTypes={nodeTypes} colorMode="dark" fitView defaultEdgeOptions={{ type: settings.lineType }}
        minZoom={0.01} maxZoom={100} nodesDraggable={!isPublicView} nodesConnectable={!isPublicView} elementsSelectable={!isPublicView}
      >
        <Background color="#334155" gap={24} size={2} />
        <Controls className="bg-slate-800 border-none shadow-lg rounded-lg fill-slate-200 hidden md:flex" />
        
        {/* CỤM NÚT CÔNG CỤ NỔI Ở GÓC DƯỚI BÊN PHẢI (CHUNG CHO CẢ DESKTOP VÀ MOBILE) */}
        <div className="absolute z-50 right-4 bottom-8 flex flex-col gap-3 items-end">
          
          {/* Nút Về Trang Chủ (Chỉ hiện khi View-Only) */}
          {isPublicView && (
            <button onClick={() => window.location.href = '/'} className="px-5 h-12 bg-rose-600 rounded-full text-white font-bold text-sm shadow-2xl transition-transform hover:scale-105 shadow-rose-500/30">
              🏠 Về Trang Chủ
            </button>
          )}
          
          {/* Nút Cài đặt App PWA (Sẽ luôn hiện nếu chưa cài) */}
          {deferredPrompt && (
            <button onClick={handleInstallApp} className="px-5 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full text-white font-bold text-sm shadow-2xl shadow-emerald-500/30 flex items-center gap-2 animate-bounce">
              📲 Cài Đặt App
            </button>
          )}

          {/* Cụm Nút thêm Node (Dấu +) nằm TRÊN nút Cài đặt */}
          {!isPublicView && (
            <div className="relative flex flex-col items-end">
              {isAddMenuOpen && (
                <div className="absolute bottom-full right-0 mb-3 flex flex-col gap-2 animate-modal-pop items-end">
                  <button onClick={() => handleAddNode('output')} className="px-4 py-2 bg-rose-900/90 text-rose-300 rounded-xl whitespace-nowrap text-sm font-bold shadow-lg border border-rose-500/30 hover:bg-rose-800 transition-colors">⭡ Node Output</button>
                  <button onClick={() => handleAddNode('input')} className="px-4 py-2 bg-emerald-900/90 text-emerald-300 rounded-xl whitespace-nowrap text-sm font-bold shadow-lg border border-emerald-500/30 hover:bg-emerald-800 transition-colors">⭣ Node Input</button>
                  <button onClick={() => handleAddNode('default')} className="px-4 py-2 bg-slate-800 text-slate-200 rounded-xl whitespace-nowrap text-sm font-bold shadow-lg border border-slate-600 hover:bg-slate-700 transition-colors">📦 Node Mặc Định</button>
                </div>
              )}
              <button onClick={() => setIsAddMenuOpen(!isAddMenuOpen)} className={`w-12 h-12 rounded-full shadow-2xl border border-slate-600 flex items-center justify-center transition-all ${isAddMenuOpen ? 'bg-indigo-600 text-white rotate-45' : 'bg-slate-800/90 text-indigo-400 backdrop-blur-md hover:bg-slate-700'}`}>
                <span className="text-2xl font-bold leading-none mb-1">+</span>
              </button>
            </div>
          )}

          {/* Nút Setting (Cài đặt chung) nằm dưới cùng */}
          <button onClick={() => setIsSettingsOpen(true)} className="w-12 h-12 bg-slate-800/90 backdrop-blur-md rounded-full shadow-2xl border border-slate-600 flex items-center justify-center hover:bg-slate-700 transition-colors group">
            <span className="text-2xl group-hover:rotate-90 transition-transform duration-300">⚙️</span>
          </button>
        </div>

        {/* Thông báo chế độ Khách Xem */}
        {isPublicView && <Panel position="top-left" className="m-4 pointer-events-none"><div className="px-4 py-2 bg-indigo-600/20 border border-indigo-500/50 rounded-xl text-indigo-300 font-bold text-sm shadow-lg">👁️ Khách Xem</div></Panel>}
        
        {/* Chữ ký */}
        <div className="absolute bottom-0 right-0 px-[4px] py-[2px] text-[10px] text-slate-500 bg-slate-800/50 rounded-tl pointer-events-none select-none z-40">
          ThuanLYT - VHD | v{APP_VERSION}
        </div>
      </ReactFlow>

      {/* MODAL SETTINGS TỔNG HỢP */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-opacity" onClick={() => setIsSettingsOpen(false)}>
          <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar relative animate-modal-pop" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setIsSettingsOpen(false)} className="absolute top-4 right-4 text-slate-400 font-bold bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center transition-colors">✕</button>
            <h2 className="text-xl font-bold text-white mb-4">Cài đặt (Settings)</h2>

            <div className="flex flex-col gap-4">
              <label className="flex items-center justify-between bg-slate-800 p-3 rounded-xl border border-slate-700 cursor-pointer hover:bg-slate-700/50 transition-colors">
                <span className="text-sm font-semibold text-slate-300">Hiển thị Chấm tròn (Dot)</span>
                <input type="checkbox" checked={settings.showColorDot} onChange={(e) => setSettings({...settings, showColorDot: e.target.checked})} className="w-5 h-5 accent-indigo-500 cursor-pointer" />
              </label>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-300">Kiểu Đường Nối (Line Type)</label>
                <select value={settings.lineType} onChange={(e) => setSettings({...settings, lineType: e.target.value})} className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl outline-none p-3 focus:border-indigo-500 transition-colors">
                  <option value="default">Cong Mềm (Bezier)</option>
                  <option value="smoothstep">Vuông Bo Góc (Smoothstep)</option>
                  <option value="step">Vuông Góc (Step)</option>
                  <option value="straight">Đường Thẳng (Straight)</option>
                </select>
              </div>

              <div className="flex flex-col gap-2 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                <div className="flex justify-between items-center text-sm font-semibold text-slate-300">
                  <span>Giới hạn chiều rộng thẻ Node</span>
                  <span className="text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded font-bold">{settings.nodeMaxWidth} px</span>
                </div>
                <input type="range" min="200" max="800" step="25" value={settings.nodeMaxWidth} onChange={(e) => setSettings({...settings, nodeMaxWidth: Number(e.target.value)})} className="w-full accent-indigo-500 mt-1 cursor-pointer" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => onLayout('TB')} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm text-white border border-slate-700 transition-colors">⭣ Tự Xếp Dọc</button>
                <button onClick={() => onLayout('LR')} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm text-white border border-slate-700 transition-colors">⭢ Tự Xếp Ngang</button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleExportJSON} className="p-3 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded-xl text-sm font-medium border border-emerald-500/30 transition-colors">📥 Lưu JSON</button>
                <label className="p-3 bg-sky-600/20 hover:bg-sky-600/40 text-sky-400 rounded-xl text-sm font-medium border border-sky-500/30 cursor-pointer text-center transition-colors">
                  📤 Tải JSON <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                </label>
              </div>

              <button onClick={downloadImage} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm text-white font-bold shadow-lg shadow-indigo-500/20 transition-all">📸 Xuất Ảnh Sơ Đồ</button>

              <div className="h-px w-full bg-slate-800 my-1"></div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setIsSettingsOpen(false); setIsLogOpen(true); }} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm text-amber-400 font-medium border border-slate-700 transition-colors">📝 Nhật ký Cập nhật</button>
                <button onClick={handleForceReload} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm text-sky-400 font-medium border border-slate-700 transition-colors">🔄 Tải lại Ứng dụng</button>
              </div>

              {/* Link GitHub mới */}
              <button onClick={() => window.open('https://github.com/thuanlyt/modern-node-app', '_blank')} className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm text-slate-300 font-bold flex items-center justify-center gap-2 border border-slate-700 transition-colors">
                🐙 Xem Mã Nguồn (GitHub)
              </button>

              {!isPublicView && (
                <button onClick={() => { setIsSettingsOpen(false); setIsAdminAuthOpen(true); }} className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl text-sm text-white font-bold shadow-lg shadow-emerald-500/20 mt-2 transition-all">
                  ☁️ Quản trị Cloud (Admin)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL UPDATE LOG */}
      {isLogOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4 transition-opacity" onClick={() => setIsLogOpen(false)}>
          <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto custom-scrollbar relative animate-modal-pop" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setIsLogOpen(false)} className="absolute top-4 right-4 text-slate-400 font-bold bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center transition-colors">✕</button>
            <h2 className="text-xl font-bold text-white mb-6">📝 Nhật ký Cập nhật</h2>
            <div className="flex flex-col gap-6">
              {UPDATE_LOGS.map((log, idx) => (
                <div key={idx} className="border-l-2 border-indigo-500 pl-4 relative">
                  <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-slate-900 border-2 border-indigo-500"></div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-bold text-indigo-400 text-lg">v{log.version}</span>
                    <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-md">{log.date}</span>
                  </div>
                  <ul className="text-sm text-slate-300 list-disc pl-4 flex flex-col gap-1.5">
                    {log.notes.map((note, i) => <li key={i}>{note}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADMIN - LOGIN */}
      {isAdminAuthOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 transition-opacity" onClick={() => setIsAdminAuthOpen(false)}>
          <div className="bg-slate-900 border border-emerald-500/30 shadow-2xl rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4 animate-modal-pop" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white text-center">☁️ Truy cập Máy Chủ</h2>
            <input type="password" value={pwInput} onChange={(e) => setPwInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()} placeholder="Mật khẩu Admin" className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-xl outline-none text-center tracking-widest focus:border-emerald-500 transition-colors" />
            <div className="flex gap-3">
              <button onClick={() => setIsAdminAuthOpen(false)} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors">Hủy</button>
              <button onClick={handleAdminLogin} disabled={isCloudLoading} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors">{isCloudLoading ? '...' : 'Vào'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADMIN - BẢNG ĐIỀU KHIỂN CLOUD */}
      {isAdminPanelOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 transition-opacity" onClick={() => setIsAdminPanelOpen(false)}>
          <div className="bg-slate-900 border border-emerald-500/50 shadow-2xl rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar relative animate-modal-pop" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setIsAdminPanelOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center transition-colors">✕</button>
            <h2 className="text-xl font-bold text-emerald-400 mb-5">☁️ Quản Trị Link Firebase</h2>
            
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <label className="text-sm font-semibold text-slate-200">Lưu đè / Tạo mới Link (Alias)</label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-xs hidden sm:block">/{window.location.host}/</span>
                  <input type="text" value={aliasInput} onChange={(e) => setAliasInput(e.target.value)} placeholder="vhd-ai" className="flex-1 bg-slate-900 text-white p-2 rounded-lg border border-slate-600 outline-none focus:border-emerald-500 transition-colors" />
                  <button onClick={handleSavePublicLink} disabled={isCloudLoading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors">🚀 Lưu</button>
                </div>
              </div>

              <div className="flex flex-col gap-2 p-4 bg-slate-800/50 rounded-xl border border-slate-700 max-h-[250px] overflow-y-auto custom-scrollbar">
                <label className="text-sm font-semibold text-slate-200 sticky top-0 bg-slate-800/90 py-1 backdrop-blur-sm z-10">Danh sách Link trên Máy chủ</label>
                {Object.keys(publicLinksData).map(alias => (
                  <div key={alias} className="flex flex-col sm:flex-row justify-between sm:items-center bg-slate-900 p-3 rounded-lg border border-slate-700 gap-2 hover:border-slate-500 transition-colors">
                    <span className="text-indigo-400 font-bold text-lg">/{alias}</span>
                    <div className="flex gap-2">
                      <button onClick={() => window.open(`/${alias}`, '_blank')} className="flex-1 sm:flex-none px-3 py-1.5 bg-sky-600/20 text-sky-400 hover:bg-sky-600/40 rounded-md text-sm font-medium transition-colors">Xem</button>
                      <button onClick={() => handleLoadLinkToCanvas(alias)} className="flex-1 sm:flex-none px-3 py-1.5 bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 rounded-md text-sm font-medium transition-colors">Sửa</button>
                      <button onClick={() => handleDeletePublicLink(alias)} className="flex-1 sm:flex-none px-3 py-1.5 bg-rose-600/20 text-rose-400 hover:bg-rose-600/40 rounded-md text-sm font-medium transition-colors">Xoá</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ĐỔI MẬT KHẨU */}
              <div className="flex flex-col gap-2 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <label className="text-sm font-semibold text-slate-200">Đổi Mật Khẩu Admin</label>
                <div className="flex gap-2">
                  <input type="password" value={newPwInput} onChange={(e) => setNewPwInput(e.target.value)} placeholder="Mật khẩu mới..." className="flex-1 bg-slate-900 text-white p-2 rounded-lg border border-slate-600 outline-none focus:border-indigo-500 transition-colors" />
                  <button onClick={handleChangeAdminPw} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors">Đổi</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTEXT MENU CANVAS, NODE & EDGE (CHUỘT PHẢI) */}
      {menu && !isPublicView && (
        <div style={{ top: menu.top, left: menu.left }} className="absolute z-50 bg-slate-800 border border-slate-600 shadow-2xl rounded-xl p-2 min-w-[220px] animate-modal-pop">
          
          {menu.type === 'canvas' && (
            <div className="flex flex-col gap-1">
              <div className="text-xs text-slate-400 mb-1 font-bold px-2">THÊM NODE MỚI</div>
              <button onClick={() => handleAddNode('default')} className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-700 rounded-lg transition-colors">📦 Thêm Node Mặc Định</button>
              <button onClick={() => handleAddNode('input')} className="w-full text-left px-3 py-2 text-emerald-400 hover:bg-slate-700 rounded-lg transition-colors">⭣ Thêm Node Input</button>
              <button onClick={() => handleAddNode('output')} className="w-full text-left px-3 py-2 text-rose-400 hover:bg-slate-700 rounded-lg transition-colors">⭡ Thêm Node Output</button>
            </div>
          )}

          {menu.type === 'node' && (
            <div className="flex flex-col gap-1">
              <div className="text-xs text-slate-400 mb-1 font-bold px-2 mt-1">CHẤM MÀU (DOT)</div>
              <label className="flex items-center gap-3 w-full px-3 py-1.5 hover:bg-slate-700 rounded-lg cursor-pointer transition-colors">
                <div className="w-5 h-5 rounded-full overflow-hidden relative border-2 border-slate-400 flex-shrink-0">
                  <input type="color" className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer bg-transparent border-0 p-0" 
                    value={menu.nodeData?.color?.startsWith('#') ? menu.nodeData.color : '#94a3b8'}
                    onChange={(e) => updateNodeSpecificData('color', e.target.value, false)} 
                  />
                </div>
                <span className="text-slate-300">Đổi màu chấm</span>
              </label>
              
              <div className="h-[1px] bg-slate-600 my-1"></div>
              <div className="text-xs text-slate-400 mb-1 font-bold px-2">MÀU NỀN</div>
              <label className="flex items-center gap-3 w-full px-3 py-1.5 hover:bg-slate-700 rounded-lg cursor-pointer transition-colors">
                <div className="w-5 h-5 rounded-full overflow-hidden relative border-2 border-slate-400 flex-shrink-0">
                  <input type="color" className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer bg-transparent border-0 p-0" 
                    value={menu.nodeData?.bgColor?.startsWith('#') ? menu.nodeData.bgColor : '#1e293b'}
                    onChange={(e) => updateNodeSpecificData('bgColor', e.target.value, false)} 
                  />
                </div>
                <span className="text-slate-300">Đổi màu nền</span>
              </label>

              <div className="h-[1px] bg-slate-600 my-1"></div>
              <button onClick={handleDeleteNode} className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-500/20 rounded-lg flex items-center gap-2 transition-colors">
                <span className="text-lg">🗑</span> Xóa Node
              </button>
            </div>
          )}

          {menu.type === 'edge' && (
            <div className="flex flex-col gap-1">
              <div className="text-xs text-slate-400 mb-1 font-bold px-2">TUỲ CHỈNH DÂY NỐI</div>
              <button onClick={handleAddMiddleNode} className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded-lg text-purple-400 font-medium flex items-center gap-2 transition-colors">
                ✨ Thêm Node Vào Giữa
              </button>
              <div className="h-[1px] bg-slate-600 my-1"></div>
              <button onClick={handleDeleteEdge} className="w-full text-left px-3 py-2 hover:bg-red-500/20 text-red-400 rounded-lg flex items-center gap-2 transition-colors">
                <span className="text-lg">✂️</span> Cắt đứt dây này
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() { return <ReactFlowProvider><Flow /></ReactFlowProvider>; }