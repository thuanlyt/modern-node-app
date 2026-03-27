import React, { memo, useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';

const CustomNode = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [title, setTitle] = useState(data.title);
  const [content, setContent] = useState(data.content);

  useEffect(() => { setTitle(data.title); setContent(data.content); }, [data]);

  const updateNodeData = (newTitle, newContent) => {
    setNodes((nds) => nds.map((node) => node.id === id ? { ...node, data: { ...node.data, title: newTitle, content: newContent } } : node));
  };

  const handleTitleBlur = () => { setIsEditingTitle(false); updateNodeData(title, content); };
  const handleContentBlur = () => { setIsEditingContent(false); updateNodeData(title, content); };

  const isInput = data.nodeType === 'input';
  const isOutput = data.nodeType === 'output';
  const isBgClass = data.bgColor?.startsWith('bg-');
  const customBgStyle = !isBgClass && data.bgColor ? { backgroundColor: data.bgColor } : {};
  const bgClassName = isBgClass ? data.bgColor : 'bg-slate-800/90';
  const isColorClass = data.color?.startsWith('bg-');
  const customColorStyle = !isColorClass && data.color ? { backgroundColor: data.color } : {};
  const colorClassName = isColorClass ? data.color : 'bg-slate-400';

  return (
    <div
      style={{ ...customBgStyle, maxWidth: 'var(--node-max-width, 350px)' }}
      // Thêm class "group" vào thẻ bọc ngoài cùng để bắt sự kiện hover
      className={`group relative px-5 py-4 ${bgClassName} backdrop-blur-md shadow-2xl rounded-2xl border-2 transition-all duration-200 min-w-[200px] ${
        selected ? 'border-indigo-400 shadow-indigo-500/30' : 'border-slate-700 hover:border-slate-500'
      }`}
    >
      {/* 4 Cổng kết nối thêm class: opacity-0 group-hover:opacity-100 */}
      {!isInput && (
        <>
          <Handle type="target" position={Position.Top} id="top" className="opacity-0 group-hover:opacity-100 !w-4 !h-4 !bg-indigo-400 !border-2 !border-slate-900 transition-all duration-200" />
          <Handle type="target" position={Position.Left} id="left" className="opacity-0 group-hover:opacity-100 !w-4 !h-4 !bg-indigo-400 !border-2 !border-slate-900 transition-all duration-200" />
        </>
      )}

      <div className="flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-700/50 pb-2 mb-2">
          {isEditingTitle ? (
            <input autoFocus className="text-sm font-bold bg-slate-900/50 text-white outline-none border border-indigo-500 rounded px-1 w-full mr-2" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={handleTitleBlur} onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()} />
          ) : (
            <h3 onDoubleClick={() => setIsEditingTitle(true)} className="text-sm font-bold text-slate-100 uppercase tracking-wider cursor-text break-words pr-2">
              {title}
            </h3>
          )}
          {/* Ẩn hiện Dot màu thông qua CSS Variable */}
          <div style={{ ...customColorStyle, display: 'var(--show-color-dot, block)' }} className={`w-3 h-3 rounded-full flex-shrink-0 shadow-sm border border-slate-600 ${colorClassName}`}></div>
        </div>
        
        {isEditingContent ? (
          <textarea autoFocus className="text-sm bg-slate-900/50 text-white outline-none border border-indigo-500 rounded px-2 py-1 w-full min-h-[80px] resize-y" value={content} onChange={(e) => setContent(e.target.value)} onBlur={handleContentBlur} placeholder="Nhập nội dung..." />
        ) : (
          <div onDoubleClick={() => setIsEditingContent(true)} className="text-slate-300 text-sm leading-relaxed cursor-text min-h-[20px] whitespace-pre-wrap break-words">
            {content}
          </div>
        )}
      </div>

      {!isOutput && (
        <>
          <Handle type="source" position={Position.Bottom} id="bottom" className="opacity-0 group-hover:opacity-100 !w-4 !h-4 !bg-rose-400 !border-2 !border-slate-900 transition-all duration-200" />
          <Handle type="source" position={Position.Right} id="right" className="opacity-0 group-hover:opacity-100 !w-4 !h-4 !bg-rose-400 !border-2 !border-slate-900 transition-all duration-200" />
        </>
      )}
    </div>
  );
};

export default memo(CustomNode);