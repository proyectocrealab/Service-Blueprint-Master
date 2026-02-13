import React, { useState } from 'react';
import { BlueprintColumn, LayerType, Scenario } from '../types';
import { LAYER_INFO, TUTORIAL_STEPS } from '../constants';
import { Plus, Trash2, Zap, AlertTriangle, ArrowRight, CheckCircle2, RotateCcw, Save, Pencil, X, Home, Download, Upload } from 'lucide-react';
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
}

const BlueprintBuilder: React.FC<BlueprintBuilderProps> = ({ 
    blueprint, 
    setBlueprint, 
    onComplete, 
    onSave, 
    scenario,
    isTutorial = false,
    onTutorialComplete,
    onBack,
    onExport,
    onImport,
    currentSaveId
}) => {
  const [tutorialStep, setTutorialStep] = useState(0);

  // Analysis Modal State
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisModalData, setAnalysisModalData] = useState<{columnId: string, type: 'painPoints' | 'opportunities'} | null>(null);
  const [analysisInput, setAnalysisInput] = useState('');

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
    const newId = `col-${Date.now()}`;
    const newColumn: BlueprintColumn = {
        id: newId,
        phase: `Phase ${blueprint.length + 1}`,
        physical: '',
        customer: '',
        frontstage: '',
        backstage: '',
        support: '',
        painPoints: [],
        opportunities: []
    };
    setBlueprint([...blueprint, newColumn]);
  };

  const deleteColumn = (columnId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (blueprint.length <= 1) {
        alert("You must have at least one phase.");
        return;
    }

    setTimeout(() => {
        if (window.confirm("Are you sure you want to delete this phase? This action cannot be undone.")) {
            setBlueprint(prev => prev.filter(c => c.id !== columnId));
        }
    }, 10);
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
    if (window.confirm("Are you sure you want to clear the entire blueprint? All your work on this mission will be lost.")) {
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
    // If we have an existing save ID, hint that we are updating, but still allow rename
    const name = prompt("Name your blueprint save:", defaultName);
    if (name) {
      onSave(name);
    }
  };

  const layers: LayerType[] = ['physical', 'customer', 'frontstage', 'backstage', 'support'];

  const totalCells = blueprint.length * 5;
  const filledCells = blueprint.reduce((acc, col) => {
    let count = 0;
    if (col.physical.trim()) count++;
    if (col.customer.trim()) count++;
    if (col.frontstage.trim()) count++;
    if (col.backstage.trim()) count++;
    if (col.support.trim()) count++;
    return acc + count;
  }, 0);
  const progress = Math.round((filledCells / totalCells) * 100);

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

      {/* Analysis Input Modal */}
      {showAnalysisModal && analysisModalData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative animate-in zoom-in-95 duration-200">
                <button onClick={() => setShowAnalysisModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <X size={24} />
                </button>
                
                <div className="mb-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${analysisModalData.type === 'painPoints' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        {analysisModalData.type === 'painPoints' ? <AlertTriangle size={24} /> : <Zap size={24} />}
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">
                        Add {analysisModalData.type === 'painPoints' ? 'Pain Point' : 'Opportunity'}
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                        {analysisModalData.type === 'painPoints' 
                            ? "Describe a problem or friction point for the customer here." 
                            : "Describe an idea to improve the service experience here."}
                    </p>
                </div>

                <textarea 
                    className={`w-full p-3 border rounded-xl focus:ring-2 outline-none h-24 resize-none ${
                        analysisModalData.type === 'painPoints' 
                        ? 'border-red-200 focus:ring-red-500 focus:border-red-500' 
                        : 'border-green-200 focus:ring-green-500 focus:border-green-500'
                    }`}
                    placeholder="Type your observation..."
                    value={analysisInput}
                    onChange={(e) => setAnalysisInput(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSaveAnalysis();
                        }
                    }}
                />

                <button 
                    onClick={handleSaveAnalysis}
                    disabled={!analysisInput.trim()}
                    className={`w-full mt-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-white ${
                        analysisModalData.type === 'painPoints'
                        ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'
                        : 'bg-green-600 hover:bg-green-700 disabled:bg-green-300'
                    }`}
                >
                    Add Observation <ArrowRight size={18} />
                </button>
             </div>
        </div>
      )}

      {/* Top Bar */}
      <div className={`bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-30 ${isTutorial && activeTutorialLayer !== 'header' ? 'z-30' : 'z-50'}`}>
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            {scenario.title}
            {currentSaveId && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200 font-normal">Saved</span>}
          </h2>
          <p className="text-sm text-gray-500">Service Blueprint Mission</p>
        </div>
        
        {!isTutorial && (
            <div className="flex items-center gap-6">
            <div className="flex flex-col items-end min-w-[200px] hidden xl:flex">
                <div className="flex justify-between w-full mb-1">
                <span className="text-xs font-semibold uppercase text-gray-400">Mission Progress</span>
                <span className="text-xs text-indigo-600 font-bold">{progress}%</span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500 ease-out rounded-full"
                    style={{ width: `${progress}%` }}
                ></div>
                </div>
            </div>
            
            <div className="h-8 w-px bg-gray-200 mx-2 hidden lg:block"></div>

            <div className="flex gap-2">
                <button 
                    onClick={handleReset}
                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg transition-all flex items-center gap-2 group"
                    title="Clear Blueprint"
                >
                    <RotateCcw size={18} />
                </button>

                {onImport && (
                  <button 
                      onClick={onImport}
                      className="text-gray-400 hover:text-blue-500 hover:bg-blue-50 px-3 py-2 rounded-lg transition-all flex items-center gap-2 group"
                      title="Import / Append Data"
                  >
                      <Upload size={18} />
                  </button>
                )}

                {onExport && (
                  <button 
                      onClick={onExport}
                      className="text-gray-400 hover:text-blue-500 hover:bg-blue-50 px-3 py-2 rounded-lg transition-all flex items-center gap-2 group"
                      title="Export Backup (JSON)"
                  >
                      <Download size={18} />
                  </button>
                )}

                <button 
                    onClick={handleSaveClick}
                    className="text-gray-400 hover:text-blue-500 hover:bg-blue-50 px-3 py-2 rounded-lg transition-all flex items-center gap-2 group"
                    title="Save Progress"
                >
                    <Save size={18} />
                    <span className="text-sm font-medium hidden lg:inline">Save</span>
                </button>
                
                {onBack && (
                  <button 
                      onClick={onBack}
                      className="text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-all flex items-center gap-2 group"
                      title="Back to Dashboard"
                  >
                      <Home size={18} />
                      <span className="text-sm font-medium hidden lg:inline">Dashboard</span>
                  </button>
                )}
            </div>

            <button 
                onClick={onComplete}
                disabled={progress < 10} // Minimum effort required
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2 transform active:scale-95"
            >
                Submit <span className="hidden lg:inline">for Grading</span> <ArrowRight size={18} />
            </button>
            </div>
        )}
      </div>
      
      {/* Scrollable Workspace */}
      <div className={`flex-1 overflow-auto bg-slate-100/50 p-8 blueprint-scroll ${isTutorial ? 'overflow-hidden' : ''}`}>
         <div className="min-w-max flex justify-center"> {/* Centered for tutorial view usually */}
            <div className="flex gap-6">
                
                {/* Fixed Left Column: Headers */}
                <div className="w-56 pt-14 flex flex-col gap-6 sticky left-0 z-20">
                    {layers.map(layer => (
                        <div key={layer} className={`h-40 p-4 rounded-xl shadow-sm border-l-4 flex flex-col justify-center ${LAYER_INFO[layer].color} transition-transform ${getHighlightClass('')} ${isTutorial ? 'opacity-90' : 'hover:scale-[1.02]'}`}>
                            <h3 className="font-bold text-sm uppercase tracking-wider">{LAYER_INFO[layer].label}</h3>
                            <p className="text-xs mt-2 opacity-70 leading-relaxed">{LAYER_INFO[layer].description}</p>
                        </div>
                    ))}
                     {/* Analysis Header */}
                    <div className={`h-auto min-h-[160px] p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-white border-l-4 border-indigo-500 shadow-sm flex flex-col justify-center ${getHighlightClass('')} ${isTutorial ? 'opacity-90' : ''}`}>
                        <h3 className="font-bold text-sm uppercase tracking-wider text-indigo-900">Analysis</h3>
                        <p className="text-xs mt-2 text-indigo-700 leading-relaxed">Identify <span className="font-bold text-red-500">Pain Points</span> & <span className="font-bold text-green-600">Opportunities</span></p>
                    </div>
                </div>

                {/* Scrollable Columns: Phases */}
                {blueprint.map((column, colIndex) => (
                    <div key={column.id} className="w-72 flex flex-col gap-6 pt-2">
                        {/* Phase Header - Redesigned for Visibility */}
                        <div className={`flex items-center gap-2 bg-slate-800 p-2 rounded-xl shadow-md border border-slate-700 relative group/header ${getHighlightClass('phase')}`}>
                            <div className="absolute -left-3 -top-3 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm border-4 border-slate-50 shadow-sm z-10">
                                {colIndex + 1}
                            </div>
                            
                            <div className="flex-1 pl-3">
                                <input 
                                    type="text" 
                                    value={column.phase}
                                    onChange={(e) => updatePhaseName(column.id, e.target.value)}
                                    className="w-full bg-transparent border-none focus:ring-0 text-white font-bold text-center placeholder-slate-500 hover:bg-slate-700/50 rounded px-2 py-1 transition-colors"
                                    placeholder="Phase Name"
                                    title="Click to rename phase"
                                    readOnly={isTutorial}
                                />
                            </div>
                            
                            {!isTutorial && (
                                <button 
                                    onClick={(e) => deleteColumn(column.id, e)}
                                    className="p-2 text-slate-400 hover:text-white hover:bg-red-600 rounded-lg transition-all cursor-pointer z-20"
                                    title="Delete Phase"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>

                        {/* Cells */}
                        {layers.map(layer => (
                            <div key={`${column.id}-${layer}`} className={`h-40 relative group perspective-1000 ${getHighlightClass(layer)}`}>
                                <textarea
                                    className={`w-full h-full p-4 text-sm rounded-xl border-2 resize-none shadow-sm transition-all duration-200 focus:ring-4 focus:ring-indigo-100 focus:outline-none
                                        ${column[layer] 
                                          ? 'bg-white border-gray-200 text-gray-800' 
                                          : 'bg-white/50 border-dashed border-gray-300 hover:bg-white hover:border-indigo-300 text-gray-500'
                                        }
                                    `}
                                    placeholder={`${LAYER_INFO[layer].label}...`}
                                    value={column[layer] as string}
                                    onChange={(e) => updateCell(column.id, layer, e.target.value)}
                                    readOnly={isTutorial && activeTutorialLayer !== layer}
                                />
                                {column[layer] && (
                                  <div className="absolute top-2 right-2 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    <CheckCircle2 size={16} />
                                  </div>
                                )}
                            </div>
                        ))}

                        {/* Analysis Cell */}
                        <div className={`min-h-[160px] bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col gap-3 hover:shadow-md transition-shadow ${getHighlightClass('analysis')}`}>
                            {/* Pain Points */}
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-red-600 flex items-center gap-1.5 uppercase tracking-wide"><AlertTriangle size={12}/> Pain Points</span>
                                    <button 
                                      onClick={() => openAnalysisModal(column.id, 'painPoints')} 
                                      className="w-5 h-5 flex items-center justify-center rounded bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 transition-colors"
                                    >
                                      <Plus size={14}/>
                                    </button>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {column.painPoints.map((pp, i) => (
                                        <div key={i} className="text-xs bg-red-50 text-red-800 p-2 rounded-lg border border-red-100 flex justify-between items-start group/item animate-fadeIn">
                                            <span className="leading-tight">{pp}</span>
                                            <button onClick={() => handleRemoveAnalysis(column.id, 'painPoints', i)} className="opacity-0 group-hover/item:opacity-100 text-red-400 hover:text-red-700 ml-1 mt-0.5"><Trash2 size={12}/></button>
                                        </div>
                                    ))}
                                    {column.painPoints.length === 0 && <div className="text-xs text-gray-300 italic py-1">No pain points identified</div>}
                                </div>
                            </div>

                            <hr className="border-gray-100 border-dashed"/>

                            {/* Opportunities */}
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-green-600 flex items-center gap-1.5 uppercase tracking-wide"><Zap size={12}/> Opportunities</span>
                                    <button 
                                      onClick={() => openAnalysisModal(column.id, 'opportunities')} 
                                      className="w-5 h-5 flex items-center justify-center rounded bg-green-50 text-green-500 hover:bg-green-100 hover:text-green-700 transition-colors"
                                    >
                                      <Plus size={14}/>
                                    </button>
                                </div>
                                 <div className="flex flex-col gap-2">
                                    {column.opportunities.map((opp, i) => (
                                        <div key={i} className="text-xs bg-green-50 text-green-800 p-2 rounded-lg border border-green-100 flex justify-between items-start group/item animate-fadeIn">
                                            <span className="leading-tight">{opp}</span>
                                            <button onClick={() => handleRemoveAnalysis(column.id, 'opportunities', i)} className="opacity-0 group-hover/item:opacity-100 text-green-400 hover:text-green-700 ml-1 mt-0.5"><Trash2 size={12}/></button>
                                        </div>
                                    ))}
                                     {column.opportunities.length === 0 && <div className="text-xs text-gray-300 italic py-1">No opportunities identified</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Add Phase Column Button */}
                {!isTutorial && (
                    <div className="w-24 pt-2 flex flex-col items-center">
                        <button 
                            onClick={addColumn}
                            className="h-10 w-full flex items-center justify-center bg-gray-200 text-gray-500 hover:bg-indigo-100 hover:text-indigo-600 rounded-full border-2 border-dashed border-gray-300 hover:border-indigo-400 transition-all group mb-6"
                            title="Add New Phase"
                        >
                            <Plus size={20} />
                        </button>
                        <div className="flex-1 w-0.5 bg-gray-200 border-l border-dashed border-gray-300 h-full mx-auto"></div>
                    </div>
                )}

                {/* Spacer for right padding */}
                <div className="w-12"></div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default BlueprintBuilder;