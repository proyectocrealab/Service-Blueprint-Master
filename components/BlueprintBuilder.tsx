import React, { useState } from 'react';
import { BlueprintColumn, LayerType, Scenario, GradingResult } from '../types';
import { LAYER_INFO, TUTORIAL_STEPS } from '../constants';
import { Plus, Trash2, Zap, AlertTriangle, ArrowRight, CheckCircle2, RotateCcw, Save, X, Download, Upload, ClipboardList, GripHorizontal, Move } from 'lucide-react';
import TutorialOverlay from './TutorialOverlay';

interface BlueprintBuilderProps {
  blueprint: BlueprintColumn[];
  setBlueprint: React.Dispatch<React.SetStateAction<BlueprintColumn[]>>;
  onComplete: () => void;
  onSave: (name: string) => void;
  scenario: Scenario;
  isTutorial?: boolean;
  onTutorialComplete?: () => void;
  onBack?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  currentSaveId?: string;
  previousGradingResult?: GradingResult | null;
}

type DragType = 'column' | 'cell';

interface DraggedItem {
  type: DragType;
  colIndex: number;
  layer?: LayerType;
}

const BlueprintBuilder: React.FC<BlueprintBuilderProps> = ({ 
    blueprint, 
    setBlueprint, 
    onComplete, 
    onSave, 
    scenario,
    isTutorial = false,
    onTutorialComplete,
    onExport,
    onImport,
    previousGradingResult
}) => {
  const [tutorialStep, setTutorialStep] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
  const [isOverTrash, setIsOverTrash] = useState(false);

  // Analysis Modal State
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisModalData, setAnalysisModalData] = useState<{columnId: string, type: 'painPoints' | 'opportunities'} | null>(null);
  const [analysisInput, setAnalysisInput] = useState('');

  const layers: LayerType[] = ['physical', 'customer', 'frontstage', 'backstage', 'support'];

  const updateCell = (columnId: string, layer: keyof BlueprintColumn, value: string) => {
    setBlueprint(prev => prev.map(col => 
      col.id === columnId ? { ...col, [layer]: value } : col
    ));
  };

  const updatePhaseName = (columnId: string, name: string) => {
    setBlueprint(prev => prev.map(col =>
        col.id === columnId ? { ...col, phase: name } : col
    ));
  };

  const addColumn = () => {
    setBlueprint(prev => {
        const newId = `col-${Date.now()}`;
        const newColumn: BlueprintColumn = {
            id: newId,
            phase: `Phase ${prev.length + 1}`,
            physical: '',
            customer: '',
            frontstage: '',
            backstage: '',
            support: '',
            painPoints: [],
            opportunities: []
        };
        return [...prev, newColumn];
    });
  };

  const handleDragStart = (type: DragType, colIndex: number, layer?: LayerType) => {
    if (isTutorial) return;
    setDraggedItem({ type, colIndex, layer });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetColIndex: number, targetLayer?: LayerType) => {
    if (!draggedItem) return;

    if (draggedItem.type === 'column' && !targetLayer) {
        // Rearranging columns
        if (draggedItem.colIndex === targetColIndex) {
            setDraggedItem(null);
            return;
        }
        const newBlueprint = [...blueprint];
        const itemToMove = newBlueprint[draggedItem.colIndex];
        newBlueprint.splice(draggedItem.colIndex, 1);
        newBlueprint.splice(targetColIndex, 0, itemToMove);
        setBlueprint(newBlueprint);
    } else if (draggedItem.type === 'cell' && targetLayer && draggedItem.layer) {
        // Swapping cell contents
        const newBlueprint = [...blueprint];
        const sourceCol = { ...newBlueprint[draggedItem.colIndex] };
        const targetCol = { ...newBlueprint[targetColIndex] };
        
        const sourceContent = sourceCol[draggedItem.layer] as string;
        const targetContent = targetCol[targetLayer] as string;

        sourceCol[draggedItem.layer] = targetContent;
        targetCol[targetLayer] = sourceContent;

        newBlueprint[draggedItem.colIndex] = sourceCol;
        newBlueprint[targetColIndex] = targetCol;
        
        setBlueprint(newBlueprint);
    }

    setDraggedItem(null);
  };

  const handleTrashDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOverTrash(false);
    if (!draggedItem) return;

    if (draggedItem.type === 'column') {
        const newBlueprint = [...blueprint];
        const target = { ...newBlueprint[draggedItem.colIndex] };
        
        // Clear all content
        target.phase = `Phase ${newBlueprint.length}`;
        target.physical = '';
        target.customer = '';
        target.frontstage = '';
        target.backstage = '';
        target.support = '';
        target.painPoints = [];
        target.opportunities = [];
        
        // Remove from current position and move to the end
        newBlueprint.splice(draggedItem.colIndex, 1);
        newBlueprint.push(target);
        setBlueprint(newBlueprint);
    } else if (draggedItem.type === 'cell' && draggedItem.layer) {
        setBlueprint(prev => prev.map((col, i) => {
            if (i === draggedItem.colIndex) {
                return { ...col, [draggedItem.layer!]: '' };
            }
            return col;
        }));
    }
    setDraggedItem(null);
  };

  const openAnalysisModal = (columnId: string, type: 'painPoints' | 'opportunities') => {
    setAnalysisModalData({ columnId, type });
    setAnalysisInput('');
    setShowAnalysisModal(true);
  };

  const handleSaveAnalysis = () => {
    if (analysisInput.trim() && analysisModalData) {
        setBlueprint(prev => prev.map(col => {
            if (col.id === analysisModalData.columnId) {
                return {
                    ...col,
                    [analysisModalData.type]: [...col[analysisModalData.type], analysisInput.trim()]
                };
            }
            return col;
        }));
        setShowAnalysisModal(false);
        setAnalysisInput('');
        setAnalysisModalData(null);
    }
  };

  const handleRemoveAnalysis = (columnId: string, type: 'painPoints' | 'opportunities', index: number) => {
    setBlueprint(prev => prev.map(col => {
      if (col.id === columnId) {
        const newItems = [...col[type]];
        newItems.splice(index, 1);
        return { ...col, [type]: newItems };
      }
      return col;
    }));
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to clear the entire blueprint?")) {
      const initialBlueprint: BlueprintColumn[] = scenario.initialPhases.map((phase, index) => ({
        id: `col-${index}`,
        phase,
        physical: '',
        customer: '',
        frontstage: '',
        backstage: '',
        support: '',
        painPoints: [],
        opportunities: []
      }));
      setBlueprint(initialBlueprint);
    }
  };

  const handleSaveClick = () => {
    const defaultName = `${scenario.title} - ${new Date().toLocaleString()}`;
    const name = prompt("Name your blueprint save:", defaultName);
    if (name) {
      onSave(name);
    }
  };

  const activeTutorialLayer = isTutorial ? TUTORIAL_STEPS[tutorialStep].targetLayer : null;
  
  const getHighlightClass = (layerId: string) => {
      if (!isTutorial) return '';
      if (activeTutorialLayer === layerId) return 'z-50 ring-4 ring-indigo-500 ring-offset-4 relative shadow-2xl bg-white';
      return 'opacity-20 pointer-events-none filter blur-[1px]';
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 relative">
      {/* Tutorial Overlay */}
      {isTutorial && (
        <>
            <div className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-500 pointer-events-none" />
            <TutorialOverlay 
                currentStep={tutorialStep} 
                onNext={() => setTutorialStep(prev => Math.min(prev + 1, TUTORIAL_STEPS.length - 1))}
                onClose={() => onTutorialComplete && onTutorialComplete()}
            />
        </>
      )}

      {/* Floating Trashcan */}
      {!isTutorial && (
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsOverTrash(true); }}
          onDragLeave={() => setIsOverTrash(false)}
          onDrop={handleTrashDrop}
          className={`fixed bottom-24 right-8 z-[100] w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all duration-300 shadow-xl ${
            isOverTrash 
              ? 'bg-red-500 border-red-600 scale-125 text-white' 
              : 'bg-white border-blue-400 text-blue-500 hover:scale-110'
          } ${draggedItem ? 'animate-pulse' : 'scale-100 opacity-60 hover:opacity-100'}`}
        >
          <div className="relative">
            <Trash2 size={40} className={isOverTrash ? 'animate-bounce' : ''} />
            {isOverTrash && (
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded whitespace-nowrap">
                {draggedItem?.type === 'column' ? 'Clear & Move Column' : 'Delete Content'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className={`bg-white border-b px-8 py-4 flex justify-between items-center shadow-sm sticky top-0 z-30 ${isTutorial && activeTutorialLayer !== 'header' ? 'z-30' : 'z-50'}`}>
        <div className="flex items-center gap-5">
          <div>
            <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                {scenario.title}
                </h2>
                {previousGradingResult && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 font-black uppercase tracking-widest">Remediation</span>}
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">Service Blueprint Mission</p>
          </div>
          {previousGradingResult && (
            <button 
                onClick={() => setShowFeedback(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 hover:scale-105 transition-transform"
            >
                <ClipboardList size={16} /> Tasks ({previousGradingResult.weaknesses.length})
            </button>
          )}
        </div>
        
        {!isTutorial && (
            <div className="flex items-center gap-8">
                <div className="flex gap-4">
                    <button onClick={handleReset} className="text-gray-400 hover:text-indigo-600 transition-colors" title="Clear Blueprint"><RotateCcw size={22} /></button>
                    {onImport && <button onClick={onImport} className="text-gray-400 hover:text-indigo-600 transition-colors" title="Import"><Upload size={22} /></button>}
                    {onExport && <button onClick={onExport} className="text-gray-400 hover:text-indigo-600 transition-colors" title="Export"><Download size={22} /></button>}
                    <button onClick={handleSaveClick} className="text-gray-400 hover:text-indigo-600 transition-colors" title="Save Progress"><Save size={22} /></button>
                </div>

                <button 
                    onClick={onComplete}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-black shadow-xl shadow-indigo-100 transition-all flex items-center gap-3 active:scale-95 text-lg"
                >
                    {previousGradingResult ? 'Re-Submit' : 'Submit Mission'} <ArrowRight size={22} />
                </button>
            </div>
        )}
      </div>
      
      <div className={`flex-1 overflow-auto bg-slate-50 p-10 blueprint-scroll ${isTutorial ? 'overflow-hidden' : ''}`}>
         <div className="min-w-max flex justify-center">
            <div className="flex gap-8">
                <div className="w-64 flex flex-col gap-8 pt-2 sticky left-0 z-20">
                    <div className="bg-slate-900 h-[84px] p-5 rounded-3xl shadow-xl border border-slate-800 flex items-center justify-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Blueprint Layers</span>
                    </div>

                    {layers.map(layer => (
                        <div key={layer} className={`h-40 p-6 rounded-3xl shadow-md border-l-8 flex flex-col justify-center ${LAYER_INFO[layer].color} transition-all border-slate-200/50 ${getHighlightClass('')}`}>
                            <h3 className="font-black text-sm uppercase tracking-widest">{LAYER_INFO[layer].label}</h3>
                            <p className="text-[11px] mt-3 opacity-80 leading-relaxed font-medium">{LAYER_INFO[layer].description}</p>
                        </div>
                    ))}
                    <div className={`min-h-[160px] p-6 rounded-3xl bg-indigo-50 border-l-8 border-indigo-500 shadow-md flex flex-col justify-center ${getHighlightClass('')}`}>
                        <h3 className="font-black text-sm uppercase tracking-[0.2em] text-indigo-900">Analysis</h3>
                        <div className="mt-5 flex flex-col gap-3">
                            <span className="text-[11px] font-bold text-red-600 flex items-center gap-2 uppercase tracking-widest"><AlertTriangle size={12}/> Pain Points</span>
                            <span className="text-[11px] font-bold text-green-600 flex items-center gap-2 uppercase tracking-widest"><Zap size={12}/> Opportunities</span>
                        </div>
                    </div>
                </div>

                {blueprint.map((column, colIndex) => {
                    const colFilled = layers.filter(l => (column[l] as string).trim()).length;
                    const colPercent = (colFilled / layers.length) * 100;
                    const isDraggingCol = draggedItem?.type === 'column' && draggedItem.colIndex === colIndex;

                    return (
                        <div 
                          key={column.id} 
                          className={`w-80 flex flex-col gap-8 pt-2 transition-all duration-300 ${isDraggingCol ? 'opacity-40 scale-95' : 'opacity-100'}`}
                        >
                            <div 
                              draggable={!isTutorial}
                              onDragStart={() => handleDragStart('column', colIndex)}
                              onDragOver={handleDragOver}
                              onDrop={() => handleDrop(colIndex)}
                              className={`flex flex-col h-[84px] bg-slate-900 p-4 rounded-3xl shadow-xl border border-slate-800 relative group/phase cursor-grab active:cursor-grabbing ${getHighlightClass('phase')} ${isDraggingCol ? 'ring-4 ring-indigo-500' : ''}`}
                            >
                                <div className="absolute -left-3 -top-3 w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-black text-base border-4 border-slate-50 shadow-lg z-10">{colIndex + 1}</div>
                                <div className="absolute right-4 top-4 opacity-0 group-hover/phase:opacity-100 transition-opacity text-slate-500 pointer-events-none">
                                  <GripHorizontal size={18} />
                                </div>
                                <div className="flex items-center gap-2 w-full pr-6 pt-1">
                                    <input 
                                        type="text" 
                                        value={column.phase} 
                                        onChange={(e) => updatePhaseName(column.id, e.target.value)} 
                                        className="w-full bg-transparent border-none focus:ring-0 text-white font-black text-center text-base truncate" 
                                        placeholder="Phase Name" 
                                        readOnly={isTutorial} 
                                        draggable="false"
                                        onMouseDown={(e) => e.stopPropagation()}
                                    />
                                </div>
                                <div className="mt-auto w-full flex flex-col gap-1 px-1">
                                    <div className="flex justify-between items-center text-[9px] text-slate-500 font-black uppercase tracking-widest">
                                        <span>Completion</span>
                                        <span className={colPercent === 100 ? 'text-green-400' : 'text-indigo-400'}>{Math.round(colPercent)}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                                        <div 
                                            className={`h-full transition-all duration-700 ease-out ${colPercent === 100 ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.4)]' : 'bg-indigo-600'}`} 
                                            style={{ width: `${colPercent}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {layers.map(layer => (
                                <div 
                                    key={`${column.id}-${layer}`} 
                                    className={`h-40 relative group ${getHighlightClass(layer)}`}
                                    onDragOver={handleDragOver}
                                    onDrop={() => handleDrop(colIndex, layer)}
                                >
                                    <div 
                                        className={`w-full h-full p-6 text-sm font-medium rounded-3xl border-2 resize-none shadow-sm transition-all focus-within:ring-8 focus-within:ring-indigo-50 bg-white text-gray-900 border-slate-100 group-hover:border-indigo-200 relative ${
                                            draggedItem?.type === 'cell' && draggedItem.colIndex === colIndex && draggedItem.layer === layer 
                                                ? 'opacity-40' 
                                                : ''
                                        }`}
                                    >
                                        <textarea
                                            className="w-full h-full bg-transparent border-none focus:ring-0 outline-none placeholder:text-slate-300"
                                            placeholder={`${LAYER_INFO[layer].label}...`}
                                            value={column[layer] as string}
                                            onChange={(e) => updateCell(column.id, layer, e.target.value)}
                                            readOnly={isTutorial && activeTutorialLayer !== layer}
                                        />
                                        
                                        {!isTutorial && (
                                            <div 
                                                draggable
                                                onDragStart={(e) => {
                                                    e.stopPropagation();
                                                    handleDragStart('cell', colIndex, layer);
                                                }}
                                                className="absolute top-4 right-4 cursor-grab active:cursor-grabbing p-1.5 rounded-lg bg-slate-50 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-indigo-600 hover:bg-indigo-50"
                                                title="Drag to swap or delete"
                                            >
                                                <Move size={16} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Analysis Section */}
                            <div className={`min-h-[160px] bg-white rounded-3xl border-2 border-slate-100 p-5 shadow-sm flex flex-col gap-4 ${getHighlightClass('analysis')}`}>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[11px] font-black text-red-600 flex items-center gap-2 uppercase tracking-widest"><AlertTriangle size={14}/> Pain Points</span>
                                        <button onClick={() => openAnalysisModal(column.id, 'painPoints')} className="w-6 h-6 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"><Plus size={16}/></button>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {column.painPoints.map((pp, i) => (
                                            <div key={i} className="text-[11px] font-medium bg-red-50 text-red-800 p-2.5 rounded-xl border border-red-100 flex justify-between items-start group/item shadow-sm">
                                                <span>{pp}</span>
                                                <button onClick={() => handleRemoveAnalysis(column.id, 'painPoints', i)} className="opacity-0 group-hover/item:opacity-100 text-red-400 p-0.5 hover:text-red-600 transition-all"><Trash2 size={14}/></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <hr className="border-slate-100 border-dashed"/>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[11px] font-black text-green-600 flex items-center gap-2 uppercase tracking-widest"><Zap size={14}/> Opportunities</span>
                                        <button onClick={() => openAnalysisModal(column.id, 'opportunities')} className="w-6 h-6 flex items-center justify-center rounded-lg bg-green-50 text-green-500 hover:bg-green-100 transition-colors"><Plus size={16}/></button>
                                    </div>
                                     <div className="flex flex-col gap-3">
                                        {column.opportunities.map((opp, i) => (
                                            <div key={i} className="text-[11px] font-medium bg-green-50 text-green-800 p-2.5 rounded-xl border border-green-100 flex justify-between items-start group/item shadow-sm">
                                                <span>{opp}</span>
                                                <button onClick={() => handleRemoveAnalysis(column.id, 'opportunities', i)} className="opacity-0 group-hover/item:opacity-100 text-red-400 p-0.5 hover:text-red-600 transition-all"><Trash2 size={14}/></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {!isTutorial && (
                    <button onClick={addColumn} className="h-14 w-14 flex items-center justify-center bg-white text-indigo-600 rounded-full border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 transition-all mt-6 shrink-0 shadow-sm active:scale-95 group"><Plus size={28} className="group-hover:rotate-90 transition-transform" /></button>
                )}
            </div>
         </div>
      </div>
    </div>
  );
};

export default BlueprintBuilder;