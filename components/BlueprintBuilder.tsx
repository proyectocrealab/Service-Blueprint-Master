import React, { useState, useEffect } from 'react';
import { BlueprintColumn, LayerType, Scenario, GradingResult } from '../types';
import { LAYER_INFO, TUTORIAL_STEPS } from '../constants';
import { Plus, Trash2, Zap, AlertTriangle, RotateCcw, X, ClipboardList, Move, Info, Pencil, Cloud, CloudUpload, CloudOff, Save, User } from 'lucide-react';
import TutorialOverlay from './TutorialOverlay';

interface BlueprintBuilderProps {
  blueprint: BlueprintColumn[];
  setBlueprint: React.Dispatch<React.SetStateAction<BlueprintColumn[]>>;
  onComplete: () => void;
  scenario: Scenario;
  isTutorial?: boolean;
  onTutorialComplete?: () => void;
  onBackToControl?: (e?: React.MouseEvent) => void;
  onExport?: () => void;
  previousGradingResult?: GradingResult | null;
  onUpdateScenario?: (updated: Scenario) => void;
  onSave?: () => void;
  autoSaveStatus?: 'idle' | 'saving' | 'success' | 'error';
  lastAutoSaveTime?: Date | null;
  studentName?: string;
  onUpdateStudentName?: (name: string) => void;
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
    scenario,
    isTutorial = false,
    onTutorialComplete,
    onBackToControl,
    onExport,
    previousGradingResult,
    onUpdateScenario,
    onSave,
    autoSaveStatus = 'idle',
    lastAutoSaveTime,
    studentName = '',
    onUpdateStudentName
}) => {
  const [tutorialStep, setTutorialStep] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ col: number; layer: LayerType } | null>(null);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [showScenarioBrief, setShowScenarioBrief] = useState(false);

  // Editable Scenario States
  const [editScenarioTitle, setEditScenarioTitle] = useState(scenario.title);
  const [editScenarioContext, setEditScenarioContext] = useState(scenario.context);
  const [editStudentName, setEditStudentName] = useState(studentName);

  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisModalData, setAnalysisModalData] = useState<{columnId: string, type: 'painPoints' | 'opportunities'} | null>(null);
  const [analysisInput, setAnalysisInput] = useState('');

  const layers: LayerType[] = ['physical', 'customer', 'frontstage', 'backstage', 'support'];

  // Sync state if scenario prop changes
  useEffect(() => {
    setEditScenarioTitle(scenario.title);
    setEditScenarioContext(scenario.context);
  }, [scenario.id, scenario.title, scenario.context]);

  useEffect(() => {
    setEditStudentName(studentName);
  }, [studentName]);

  const updateCell = (columnId: string, layer: keyof BlueprintColumn, value: string) => {
    setBlueprint(prev => prev.map(col => col.id === columnId ? { ...col, [layer]: value } : col));
  };

  const updatePhaseName = (columnId: string, name: string) => {
    setBlueprint(prev => prev.map(col => col.id === columnId ? { ...col, phase: name } : col));
  };

  const handleUpdateBrief = () => {
    if (onUpdateScenario) {
      onUpdateScenario({
        ...scenario,
        title: editScenarioTitle,
        context: editScenarioContext
      });
    }
    if (onUpdateStudentName) {
      onUpdateStudentName(editStudentName);
    }
    setShowScenarioBrief(false);
  };

  const addColumn = () => {
    setBlueprint(prev => {
        const newId = `col-${Date.now()}`;
        return [...prev, { id: newId, phase: `Phase ${prev.length + 1}`, physical: '', customer: '', frontstage: '', backstage: '', support: '', painPoints: [], opportunities: [] }];
    });
  };

  const handleDragStart = (type: DragType, colIndex: number, layer?: LayerType) => {
    if (isTutorial) return;
    setDraggedItem({ type, colIndex, layer });
  };

  const handleDrop = (targetColIndex: number, targetLayer?: LayerType) => {
    if (!draggedItem) return;
    
    if (draggedItem.type === 'column' && !targetLayer) {
        if (draggedItem.colIndex === targetColIndex) { setDraggedItem(null); return; }
        const newBlueprint = [...blueprint];
        const [moved] = newBlueprint.splice(draggedItem.colIndex, 1);
        newBlueprint.splice(targetColIndex, 0, moved);
        setBlueprint(newBlueprint);
    } else if (draggedItem.type === 'cell' && targetLayer && draggedItem.layer) {
        const newBlueprint = [...blueprint];
        
        if (draggedItem.colIndex === targetColIndex) {
            // Same column swap: Need to update the single object reference correctly
            const col = { ...newBlueprint[draggedItem.colIndex] };
            const temp = col[draggedItem.layer] as string;
            col[draggedItem.layer] = col[targetLayer] as string;
            col[targetLayer] = temp;
            newBlueprint[draggedItem.colIndex] = col;
        } else {
            // Different column swap
            const src = { ...newBlueprint[draggedItem.colIndex] };
            const dest = { ...newBlueprint[targetColIndex] };
            const temp = src[draggedItem.layer] as string;
            src[draggedItem.layer] = dest[targetLayer] as string;
            dest[targetLayer] = temp;
            newBlueprint[draggedItem.colIndex] = src;
            newBlueprint[targetColIndex] = dest;
        }
        
        setBlueprint(newBlueprint);
    }
    setDraggedItem(null);
    setDragOverCell(null);
  };

  const handleTrashDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOverTrash(false);
    if (!draggedItem) return;
    if (draggedItem.type === 'column') {
        const newBlueprint = [...blueprint];
        newBlueprint.splice(draggedItem.colIndex, 1);
        setBlueprint(newBlueprint);
    } else if (draggedItem.type === 'cell' && draggedItem.layer) {
        setBlueprint(prev => prev.map((col, i) => i === draggedItem.colIndex ? { ...col, [draggedItem.layer!]: '' } : col));
    }
    setDraggedItem(null);
    setDragOverCell(null);
  };

  const openAnalysisModal = (columnId: string, type: 'painPoints' | 'opportunities') => {
    setAnalysisModalData({ columnId, type });
    setAnalysisInput('');
    setShowAnalysisModal(true);
  };

  const handleSaveAnalysis = () => {
    if (analysisInput.trim() && analysisModalData) {
        setBlueprint(prev => prev.map(col => col.id === analysisModalData.columnId ? { ...col, [analysisModalData.type]: [...col[analysisModalData.type], analysisInput.trim()] } : col));
        setShowAnalysisModal(false);
        setAnalysisInput('');
    }
  };

  const handleReset = () => {
    if (window.confirm("Clear all content in this blueprint? Phase titles will remain.")) {
      setBlueprint(prev => prev.map(col => ({
        ...col,
        physical: '',
        customer: '',
        frontstage: '',
        backstage: '',
        support: '',
        painPoints: [],
        opportunities: []
      })));
    }
  };

  const activeTutorialLayer = isTutorial ? TUTORIAL_STEPS[tutorialStep].targetLayer : null;
  const getHighlightClass = (layerId: string) => {
      if (!isTutorial) return '';
      if (activeTutorialLayer === layerId) return 'z-50 ring-4 ring-indigo-500 ring-offset-4 relative shadow-2xl bg-white';
      return 'opacity-20 pointer-events-none filter blur-[1px]';
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative min-h-0">
      {isTutorial && (
        <>
            <div className="fixed inset-0 bg-black/40 z-40 pointer-events-none" />
            <TutorialOverlay 
                currentStep={tutorialStep} 
                onNext={() => setTutorialStep(prev => Math.min(prev + 1, TUTORIAL_STEPS.length - 1))}
                onClose={() => onTutorialComplete && onTutorialComplete()}
            />
        </>
      )}

      {/* Trash Can functionality preserved exactly as requested */}
      {!isTutorial && (
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsOverTrash(true); }}
          onDragLeave={() => setIsOverTrash(false)}
          onDrop={handleTrashDrop}
          className={`fixed bottom-24 right-8 z-[90] w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all duration-300 shadow-xl ${
            isOverTrash ? 'bg-red-500 border-red-600 scale-125 text-white' : 'bg-white border-indigo-400 text-indigo-500 hover:scale-110'
          } ${draggedItem ? 'animate-pulse' : 'scale-100 opacity-60 hover:opacity-100'}`}
        >
          <Trash2 size={40} />
        </div>
      )}

      {/* Sub-Header: Mission Tools */}
      <div className="bg-[#f8f9fb] border-b border-slate-200 px-8 py-3 flex justify-between items-center shadow-sm sticky top-0 z-40 shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={() => setShowScenarioBrief(!showScenarioBrief)} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold text-[10px] uppercase tracking-[0.2em] transition-colors cursor-pointer group">
            <div className="bg-slate-200 p-1.5 rounded-lg group-hover:bg-indigo-100 transition-colors">
              <Info size={14} className="group-hover:text-indigo-600" />
            </div>
            Brief
          </button>

          {!isTutorial && onSave && (
            <button onClick={onSave} className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 font-bold text-[10px] uppercase tracking-[0.2em] transition-colors cursor-pointer group">
              <div className="bg-slate-200 p-1.5 rounded-lg group-hover:bg-emerald-100 transition-colors">
                <Save size={14} className="group-hover:text-emerald-600" />
              </div>
              Archive
            </button>
          )}

          {!isTutorial && (
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl border border-slate-100 bg-white shadow-sm">
                {autoSaveStatus === 'saving' ? (
                  <CloudUpload size={14} className="text-indigo-500 animate-bounce" />
                ) : autoSaveStatus === 'error' ? (
                  <CloudOff size={14} className="text-red-500" />
                ) : (
                  <Cloud size={14} className="text-emerald-500" />
                )}
                <div className="flex flex-col">
                  <span className={`text-[8px] font-black uppercase tracking-widest ${autoSaveStatus === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
                    {autoSaveStatus === 'saving' ? 'Syncing...' : autoSaveStatus === 'error' ? 'Sync Failed' : 'Synced'}
                  </span>
                  {lastAutoSaveTime && (
                    <span className="text-[7px] font-bold text-slate-300 leading-none">
                      {lastAutoSaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
            </div>
          )}

          {previousGradingResult && (
            <button onClick={() => setShowFeedback(true)} className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-amber-200 shadow-sm animate-pulse cursor-pointer">
                <ClipboardList size={14} /> Remediation Tasks ({previousGradingResult.weaknesses.length})
            </button>
          )}
        </div>
        
        {!isTutorial && (
            <div className="flex items-center gap-2">
                <button onClick={handleReset} className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] cursor-pointer" title="Clear All Cells">
                  <RotateCcw size={14} /> Clear
                </button>
            </div>
        )}
      </div>
      
      <div className="flex-1 overflow-auto bg-slate-50 p-10 blueprint-scroll animate-in fade-in duration-700">
         <div className="min-w-max flex justify-center">
            <div className="flex gap-8">
                <div className="w-64 flex flex-col gap-8 pt-2 sticky left-0 z-20 pointer-events-none">
                    <div className="bg-slate-900 h-[84px] p-5 rounded-3xl shadow-xl border border-slate-800 flex items-center justify-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MAP LAYERS</span>
                    </div>
                    {layers.map(layer => (
                        <div key={layer} className={`h-40 p-6 rounded-3xl shadow-md border-l-8 flex flex-col justify-center transition-all hover:scale-[1.02] ${LAYER_INFO[layer].color} border-slate-200/50`}>
                            <h3 className="font-black text-sm uppercase tracking-widest">{LAYER_INFO[layer].label}</h3>
                            <p className="text-[10px] mt-2 opacity-80 leading-tight">{LAYER_INFO[layer].description}</p>
                        </div>
                    ))}
                </div>

                {blueprint.map((column, colIndex) => (
                    <div key={column.id} className="w-80 flex flex-col gap-8 pt-2 transition-all">
                        <div 
                          draggable={!isTutorial}
                          onDragStart={() => handleDragStart('column', colIndex)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDrop(colIndex)}
                          className={`flex flex-col h-[84px] bg-[#0c1421] p-4 rounded-3xl shadow-xl border border-white/5 relative cursor-grab active:cursor-grabbing transition-transform hover:scale-[1.02] ${getHighlightClass('phase')} ${draggedItem?.type === 'column' && draggedItem.colIndex === colIndex ? 'opacity-40 border-indigo-500 scale-95' : ''}`}
                        >
                            <div className="absolute -left-2 -top-2 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-black text-xs border-2 border-white shadow-lg z-10">{colIndex + 1}</div>
                            <input type="text" value={column.phase} onChange={(e) => updatePhaseName(column.id, e.target.value)} className="w-full bg-transparent border-none focus:ring-0 text-white font-black text-center text-base" placeholder="Phase" onMouseDown={(e) => e.stopPropagation()} />
                            <div className="mt-auto w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${(layers.filter(l => column[l]).length / layers.length) * 100}%` }}></div>
                            </div>
                        </div>

                        {layers.map(layer => {
                            const isDraggingThis = draggedItem?.type === 'cell' && draggedItem.colIndex === colIndex && draggedItem.layer === layer;
                            const isDragOverTarget = dragOverCell?.col === colIndex && dragOverCell?.layer === layer;
                            
                            return (
                                <div 
                                    key={`${column.id}-${layer}`} 
                                    className={`h-40 relative group ${getHighlightClass(layer)} ${isDraggingThis ? 'opacity-30 grayscale' : ''} ${isDragOverTarget ? 'scale-105 z-10' : ''}`} 
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        if (draggedItem?.type === 'cell') setDragOverCell({ col: colIndex, layer });
                                    }} 
                                    onDragLeave={() => setDragOverCell(null)}
                                    onDrop={() => handleDrop(colIndex, layer)}
                                >
                                    <div className={`w-full h-full p-6 text-sm rounded-3xl border-2 shadow-sm transition-all focus-within:ring-4 focus-within:ring-indigo-100 group-hover:border-indigo-400 group-hover:bg-white ${LAYER_INFO[layer].color.split(' ').slice(0, 2).join(' ')} border-opacity-30 ${isDragOverTarget ? 'border-indigo-600 bg-indigo-50 ring-4 ring-indigo-200' : ''}`}>
                                        <textarea 
                                          className="w-full h-full bg-transparent border-none focus:ring-0 outline-none resize-none placeholder:text-slate-400 font-medium text-slate-800" 
                                          placeholder={`${LAYER_INFO[layer].label}...`} 
                                          value={column[layer] as string} 
                                          onChange={(e) => updateCell(column.id, layer, e.target.value)} 
                                        />
                                        <div 
                                            draggable={!isTutorial} 
                                            onDragStart={(e) => { 
                                                e.stopPropagation(); 
                                                handleDragStart('cell', colIndex, layer); 
                                            }} 
                                            className="absolute top-4 right-4 cursor-grab p-1 bg-white/50 text-slate-400 opacity-0 group-hover:opacity-100 rounded hover:text-indigo-500 shadow-sm transition-opacity"
                                        >
                                            <Move size={14} />
                                        </div>
                                    </div>
                                    {isDragOverTarget && draggedItem?.type === 'cell' && (
                                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-40">
                                            <div className="bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">Swap</div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        <div className={`min-h-[160px] bg-white rounded-3xl border-2 border-slate-100 p-4 shadow-sm flex flex-col gap-4 transition-all hover:shadow-md ${getHighlightClass('analysis')}`}>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-red-600 uppercase flex items-center gap-1"><AlertTriangle size={12}/> Pain</span>
                                <button onClick={() => openAnalysisModal(column.id, 'painPoints')} className="w-6 h-6 flex items-center justify-center rounded bg-red-50 text-red-500 hover:bg-red-100 transition-colors cursor-pointer">+</button>
                            </div>
                            <div className="flex flex-col gap-1">
                                {column.painPoints.map((pp, i) => <div key={i} className="text-[10px] bg-red-50 text-red-800 p-2 rounded-lg border border-red-100 flex justify-between group/item animate-in fade-in slide-in-from-left-1"><span>{pp}</span><button onClick={() => setBlueprint(prev => prev.map(c => c.id === column.id ? { ...c, painPoints: c.painPoints.filter((_, idx) => idx !== i) } : c))} className="opacity-0 group-hover/item:opacity-100 text-red-400 cursor-pointer">×</button></div>)}
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-green-600 uppercase flex items-center gap-1"><Zap size={12}/> Opportunity</span>
                                <button onClick={() => openAnalysisModal(column.id, 'opportunities')} className="w-6 h-6 flex items-center justify-center rounded bg-green-50 text-green-500 hover:bg-green-100 transition-colors cursor-pointer">+</button>
                            </div>
                            <div className="flex flex-col gap-1">
                                {column.opportunities.map((opp, i) => <div key={i} className="text-[10px] bg-green-50 text-green-800 p-2 rounded-lg border border-green-100 flex justify-between group/item animate-in fade-in slide-in-from-left-1"><span>{opp}</span><button onClick={() => setBlueprint(prev => prev.map(c => c.id === column.id ? { ...c, opportunities: c.opportunities.filter((_, idx) => idx !== i) } : c))} className="opacity-0 group-hover/item:opacity-100 text-red-400 cursor-pointer">×</button></div>)}
                            </div>
                        </div>
                    </div>
                ))}
                {!isTutorial && <button onClick={addColumn} className="h-14 w-14 flex items-center justify-center bg-white text-indigo-600 rounded-full border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 transition-all mt-6 shrink-0 active:scale-95 shadow-sm cursor-pointer"><Plus size={28} /></button>}
            </div>
         </div>
      </div>
      
      {showAnalysisModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95">
                <h3 className={`text-xl font-black mb-4 ${analysisModalData?.type === 'painPoints' ? 'text-red-600' : 'text-green-600'}`}>Log {analysisModalData?.type === 'painPoints' ? 'Pain Point' : 'Opportunity'}</h3>
                <textarea autoFocus className="w-full p-4 rounded-xl bg-slate-50 border-2 focus:border-indigo-500 outline-none h-32 text-sm font-medium" placeholder="Describe the friction or potential improvement..." value={analysisInput} onChange={(e) => setAnalysisInput(e.target.value)} />
                <div className="flex gap-4 mt-6">
                    <button onClick={() => setShowAnalysisModal(false)} className="flex-1 py-3 text-slate-400 font-bold hover:text-slate-600 transition-colors cursor-pointer">Cancel</button>
                    <button onClick={handleSaveAnalysis} className={`flex-1 py-3 rounded-xl font-black text-white shadow-lg transition-transform active:scale-95 cursor-pointer ${analysisModalData?.type === 'painPoints' ? 'bg-red-600' : 'bg-green-600'}`}>Save Log</button>
                </div>
            </div>
        </div>
      )}

      {showScenarioBrief && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-10 relative animate-in zoom-in-95">
                <button onClick={() => setShowScenarioBrief(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 transition-colors cursor-pointer z-10"><X size={32}/></button>
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shadow-inner"><Info size={28}/></div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Mission Briefing</h2>
                </div>
                <div className="space-y-6">
                   <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-inner">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Lead Designer</h4>
                        <Pencil size={12} className="text-slate-300" />
                      </div>
                      <div className="flex items-center gap-3">
                        <User size={16} className="text-slate-400" />
                        <input 
                          type="text" 
                          value={editStudentName} 
                          onChange={(e) => setEditStudentName(e.target.value)}
                          className="w-full bg-transparent border-none focus:ring-0 text-xl font-black text-slate-900 leading-none p-0"
                          placeholder="Agent Identity"
                        />
                      </div>
                   </div>

                   <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-inner">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Operation Codename</h4>
                        <Pencil size={12} className="text-slate-300" />
                      </div>
                      <input 
                        type="text" 
                        value={editScenarioTitle} 
                        onChange={(e) => setEditScenarioTitle(e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 text-xl font-black text-slate-900 leading-none p-0"
                        placeholder="Untitled Operation"
                      />
                   </div>

                   <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-inner">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Intelligence Brief</h4>
                        <Pencil size={12} className="text-slate-300" />
                      </div>
                      <textarea 
                        value={editScenarioContext} 
                        onChange={(e) => setEditScenarioContext(e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 text-slate-600 leading-relaxed font-medium min-h-[120px] resize-none p-0 outline-none"
                        placeholder="Define the intelligence parameters..."
                      />
                   </div>
                </div>
                <button onClick={handleUpdateBrief} className="w-full mt-10 bg-[#0c1421] text-white py-5 rounded-2xl font-black shadow-xl hover:bg-indigo-600 transition-all active:scale-95 cursor-pointer uppercase tracking-widest text-sm">
                  Update & Resume Operation
                </button>
            </div>
        </div>
      )}

      {showFeedback && previousGradingResult && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-indigo-900/40 backdrop-blur-md">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl p-10 relative animate-in zoom-in-95">
                <button onClick={() => setShowFeedback(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 transition-colors cursor-pointer"><X size={32}/></button>
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shadow-inner"><ClipboardList size={28}/></div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Remediation Tasks</h2>
                </div>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">The Professor noted these areas for improvement. Resolve them to increase your XP score.</p>
                <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                    {previousGradingResult.weaknesses.map((w, i) => (
                        <div key={i} className="bg-red-50 p-5 rounded-2xl border border-red-100 flex gap-4 shadow-sm animate-in fade-in slide-in-from-top-1">
                          <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                          <p className="text-red-900 text-sm font-bold leading-relaxed">{w}</p>
                        </div>
                    ))}
                </div>
                <button onClick={() => setShowFeedback(false)} className="w-full mt-8 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-colors cursor-pointer">Acknowledge</button>
            </div>
        </div>
      )}
    </div>
  );
};

export default BlueprintBuilder;