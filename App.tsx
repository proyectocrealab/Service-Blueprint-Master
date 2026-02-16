
import React, { useState, useEffect, useRef } from 'react';
import { AppStage, BlueprintColumn, GradingResult, Scenario, SavedBlueprint, LayerType } from './types';
import { SCENARIOS, EXAMPLE_BLUEPRINT, TUTORIAL_SCENARIO, LAYER_INFO } from './constants';
import { gradeBlueprint } from './services/geminiService';
import { getSavedBlueprints, saveBlueprint, deleteBlueprint } from './services/storageService';
import BlueprintBuilder from './components/BlueprintBuilder';
import MentorChat from './components/MentorChat';
import { ArrowRight, RefreshCw, CheckCircle, Map, Play, Clock, Trash2, Save, Download, Key, Check, AlertCircle, Loader2, X, ExternalLink, Lock, GraduationCap, User, PenTool, Home, Zap, Pencil, ShieldCheck, ShieldAlert, Shield, Sparkles } from 'lucide-react';
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

const App: React.FC = () => {
  const [stage, setStage] = useState<AppStage>(AppStage.ONBOARDING);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [blueprint, setBlueprint] = useState<BlueprintColumn[]>([]);
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [savedGames, setSavedGames] = useState<SavedBlueprint[]>([]);
  const [currentSaveId, setCurrentSaveId] = useState<string | undefined>(undefined);
  
  // User Identity State
  const [studentName, setStudentName] = useState('');
  const [teamNumber, setTeamNumber] = useState('');

  // Define layers for iteration in tables and exports (Fixes undefined layers error)
  const layers: (keyof BlueprintColumn)[] = ['physical', 'customer', 'frontstage', 'backstage', 'support'];
  
  // Custom Scenario Modal State
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customContext, setCustomContext] = useState('');
  
  // Tutorial State
  const [isTutorialMode, setIsTutorialMode] = useState(false);

  // File Input Ref for Import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hidden Ref for PDF Generation
  const printRef = useRef<HTMLDivElement>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stage === AppStage.SCENARIO_SELECTION) {
      setSavedGames(getSavedBlueprints());
    }
  }, [stage]);

  const handleStartTraining = () => {
    if (!studentName.trim() || !teamNumber.trim()) {
        alert("Please enter your Student Name and Team Number to verify your identity.");
        return;
    }
    // Proceed directly as API key is handled by the environment as per guidelines.
    setStage(AppStage.SCENARIO_SELECTION);
  };

  const startScenario = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    setIsTutorialMode(false);
    setCurrentSaveId(undefined); 
    setGradingResult(null); 
    
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
    setStage(AppStage.BLUEPRINT_BUILDER);
  };

  const startCustomScenario = () => {
    setShowCustomModal(true);
  };

  const handleCreateCustom = () => {
    if (!customTitle.trim() || !customContext.trim()) return;
    const customScenario: Scenario = {
      id: `custom-${Date.now()}`,
      title: customTitle,
      description: 'A custom designed service blueprint scenario.',
      difficulty: 'Advanced',
      initialPhases: ['Arrival', 'Service Interaction', 'Departure'],
      context: customContext
    };
    setShowCustomModal(false);
    setCustomTitle('');
    setCustomContext('');
    startScenario(customScenario);
  };

  const startTutorial = () => {
    const scenario = TUTORIAL_SCENARIO;
    setSelectedScenario(scenario);
    setIsTutorialMode(true);
    setCurrentSaveId(undefined);
    setGradingResult(null);
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
    setStage(AppStage.BLUEPRINT_BUILDER);
  };

  const handleLoadExample = () => {
    const exampleScenario = SCENARIOS.find(s => s.id === 'coffee-shop');
    if (exampleScenario) {
        setSelectedScenario(exampleScenario);
        setBlueprint(EXAMPLE_BLUEPRINT);
        setCurrentSaveId(undefined);
        setGradingResult(null);
        setStage(AppStage.BLUEPRINT_BUILDER);
    }
  };

  const resumeGame = (save: SavedBlueprint) => {
    const scenario = SCENARIOS.find(s => s.id === save.scenarioId) || {
        id: save.scenarioId,
        title: save.name,
        description: 'Custom Saved Scenario',
        difficulty: 'Intermediate',
        initialPhases: [],
        context: 'Loaded from save'
    };
    setSelectedScenario(scenario);
    setBlueprint(save.blueprint);
    setCurrentSaveId(save.id);
    setGradingResult(null);
    setStage(AppStage.BLUEPRINT_BUILDER);
  };

  const handleDeleteSave = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Delete this saved blueprint?")) {
      deleteBlueprint(id);
      setSavedGames(getSavedBlueprints());
    }
  };

  const handleSaveGame = (name: string) => {
    if (selectedScenario) {
      const savedGame = saveBlueprint(name, selectedScenario.id, blueprint, currentSaveId);
      setCurrentSaveId(savedGame.id);
      alert("Blueprint saved successfully!");
    }
  };

  const triggerImport = () => {
    if (fileInputRef.current) {
        fileInputRef.current.click();
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files.length > 0) {
        fileReader.readAsText(e.target.files[0], "UTF-8");
        fileReader.onload = (event) => {
            try {
                if (event.target?.result) {
                    const parsedData = JSON.parse(event.target.result as string);
                    if (!parsedData.scenario || !parsedData.blueprint) {
                        throw new Error("Invalid file format");
                    }
                    if (stage === AppStage.SCENARIO_SELECTION) {
                        setSelectedScenario(parsedData.scenario);
                        setBlueprint(parsedData.blueprint);
                        setCurrentSaveId(undefined);
                        setGradingResult(null);
                        setStage(AppStage.BLUEPRINT_BUILDER);
                    } else if (stage === AppStage.BLUEPRINT_BUILDER) {
                        setSelectedScenario(parsedData.scenario);
                        setBlueprint(parsedData.blueprint);
                        setCurrentSaveId(undefined);
                    }
                }
            } catch (err) {
                console.error(err);
                alert("Failed to load file.");
            }
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
    }
  };

  const handleGoHome = () => {
    resetApp();
  };

  const handleSubmission = async () => {
    if (!selectedScenario) return;
    setStage(AppStage.SUBMISSION);
    setIsGrading(true);
    const result = await gradeBlueprint(blueprint, selectedScenario, gradingResult || undefined);
    setGradingResult(result);
    setIsGrading(false);
    setStage(AppStage.RESULTS);
  };

  const isColumnBlank = (col: BlueprintColumn) => {
    return !col.physical.trim() && 
           !col.customer.trim() && 
           !col.frontstage.trim() && 
           !col.backstage.trim() && 
           !col.support.trim() && 
           col.painPoints.length === 0 && 
           col.opportunities.length === 0;
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    
    const element = printRef.current;
    element.style.display = 'block';
    element.style.position = 'absolute';
    element.style.left = '-10000px';
    element.style.top = '0';
    element.style.width = '1200px'; 

    try {
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      
      const contentWidth = pageWidth - (margin * 2);
      const ratio = contentWidth / canvas.width;
      const contentHeight = canvas.height * ratio;
      
      let heightLeft = contentHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
      heightLeft -= (pageHeight - (margin * 2));

      while (heightLeft > 0) {
        position = heightLeft - contentHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
        heightLeft -= (pageHeight - (margin * 2));
      }

      pdf.save(`BlueprintEvidence_${studentName.replace(/\s+/g, '_')}_Team${teamNumber}.pdf`);
    } catch (err) {
      console.error("PDF Export failed:", err);
      alert("Error generating PDF. Please try again.");
    } finally {
      element.style.display = 'none';
    }
  };

  const handleImproveWork = () => {
    setStage(AppStage.BLUEPRINT_BUILDER);
  };

  const resetApp = () => {
    setStage(AppStage.SCENARIO_SELECTION);
    setSelectedScenario(null);
    setBlueprint([]);
    setGradingResult(null);
    setIsTutorialMode(false);
    setCurrentSaveId(undefined);
  };

  const chunkBlueprint = (arr: BlueprintColumn[], maxSize: number = 4) => {
    // Filter out columns that are blank placeholders at the end
    const filteredArr = arr.filter(col => !isColumnBlank(col));
    const result = [];
    for (let i = 0; i < filteredArr.length; i += maxSize) {
      result.push(filteredArr.slice(i, i + maxSize));
    }
    return result;
  };

  const renderOnboarding = () => (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center p-6 relative">
      <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-2xl text-center relative z-10">
        <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Map size={40} />
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Service Blueprint Master</h1>
        <p className="text-xl text-gray-600 mb-8 leading-relaxed">
          Welcome, future Service Designer. Map customer journeys, identify invisible processes, and spot opportunities for innovation.
        </p>
        <div className="bg-gray-50 p-6 rounded-2xl mb-8 text-left border border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <User size={14}/> Cadet Identification
            </h3>
            <div className="space-y-4">
                <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Student Name"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900"
                />
                <input
                    type="text"
                    value={teamNumber}
                    onChange={(e) => setTeamNumber(e.target.value)}
                    placeholder="Team Number / Squad ID"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900"
                />
            </div>
        </div>
        <div className="flex flex-col items-center gap-4">
            <button 
              onClick={handleStartTraining}
              className="w-full text-lg font-bold px-10 py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Start Your Training <ArrowRight />
            </button>
        </div>
      </div>
    </div>
  );

  const renderScenarioSelection = () => (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">Select a Mission</h2>
                <p className="text-gray-500">Choose a scenario to demonstrate your service design skills.</p>
            </div>
            <div className="flex items-center gap-3">
                <button onClick={startTutorial} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-transform hover:scale-105"><GraduationCap size={20} /> Start Bootcamp</button>
            </div>
        </div>

        <div className="mb-8 flex flex-col md:flex-row gap-6">
            <div onClick={startCustomScenario} className="flex-1 bg-slate-800 rounded-3xl p-10 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-200 group relative overflow-hidden border border-slate-700">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-bl-full transform translate-x-8 -translate-y-8 group-hover:scale-150 transition-transform"></div>
                <PenTool className="text-indigo-400 mb-6 group-hover:rotate-12 transition-transform" size={40} />
                <h3 className="text-3xl font-black text-white mb-3">Design Your Own</h3>
                <p className="text-slate-400 mb-8 text-sm max-w-xs leading-relaxed">Define your own custom service environment and constraints.</p>
                <button className="text-white bg-indigo-600 hover:bg-indigo-700 px-8 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-900/40">Initialize Custom Sim</button>
            </div>

            <div onClick={handleLoadExample} className="flex-1 bg-gradient-to-br from-indigo-700 to-purple-800 rounded-3xl p-10 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-200 group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-full transform translate-x-8 -translate-y-8 group-hover:scale-150 transition-transform"></div>
                <Sparkles className="text-amber-400 mb-6 group-hover:scale-125 transition-transform" size={40} />
                <h3 className="text-3xl font-black text-white mb-3">Push Your Skills</h3>
                <p className="text-indigo-100/70 mb-8 text-sm max-w-xs leading-relaxed">Study an expert-level example of a busy coffee shop rush.</p>
                <button className="text-indigo-900 bg-white hover:bg-indigo-50 px-8 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-900/20">Analyze Expert Work</button>
            </div>
        </div>

        <div className="mb-12">
            <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2"><Save size={20} className="text-indigo-600"/> Mission Library</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedGames.length > 0 ? savedGames.map(save => (
                    <div key={save.id} onClick={() => resumeGame(save)} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-gray-800 truncate pr-2">{save.name}</h3>
                            <button onClick={(e) => handleDeleteSave(save.id, e)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                        </div>
                        <p className="text-sm text-indigo-600 font-medium mb-3">{SCENARIOS.find(s => s.id === save.scenarioId)?.title || 'Custom Mission'}</p>
                    </div>
                )) : (
                    <div className="col-span-full py-8 text-center text-gray-400 bg-gray-100/50 rounded-2xl border-2 border-dashed border-gray-200">
                        No saved missions found. Start a new one below!
                    </div>
                )}
            </div>
        </div>

        <div className="mt-12">
            <h2 className="text-xl font-bold text-gray-800 mb-8 flex items-center gap-3"><Play size={20} className="text-indigo-600"/> Mission Challenges</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12">
                {SCENARIOS.map((scenario) => (
                    <div key={scenario.id} className="bg-white rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 overflow-hidden transition-all group p-8 flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${
                                scenario.difficulty === 'Beginner' ? 'bg-green-100 text-green-700' :
                                scenario.difficulty === 'Intermediate' ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700'
                            }`}>
                                {scenario.difficulty}
                            </span>
                            <Clock size={16} className="text-gray-300" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-3">{scenario.title}</h3>
                        <p className="text-gray-500 text-sm mb-8 flex-1 leading-relaxed">{scenario.description}</p>
                        <button onClick={() => startScenario(scenario)} className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-600 transition-all active:scale-95 group-hover:shadow-lg group-hover:shadow-indigo-100">
                            Start Mission <Play size={16} className="fill-current" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="font-sans text-gray-900 selection:bg-indigo-100">
      <input type="file" ref={fileInputRef} onChange={handleImportFile} className="hidden" accept=".json" />
      
      {stage === AppStage.ONBOARDING && renderOnboarding()}
      {stage === AppStage.SCENARIO_SELECTION && renderScenarioSelection()}
      {stage === AppStage.BLUEPRINT_BUILDER && selectedScenario && (
        <>
          <BlueprintBuilder 
            blueprint={blueprint} 
            setBlueprint={setBlueprint} 
            onComplete={handleSubmission}
            onSave={handleSaveGame}
            scenario={selectedScenario}
            isTutorial={isTutorialMode}
            onTutorialComplete={resetApp}
            onBack={handleGoHome}
            onExport={handleDownloadPDF}
            onImport={triggerImport}
            currentSaveId={currentSaveId}
            previousGradingResult={gradingResult}
          />
          {!isTutorialMode && <MentorChat blueprint={blueprint} scenario={selectedScenario} />}
        </>
      )}
      {stage === AppStage.SUBMISSION && (
         <div className="min-h-screen bg-indigo-900 flex flex-col items-center justify-center p-6 text-white text-center">
            <div className="relative mb-8">
                <Loader2 className="animate-spin text-indigo-400" size={64} />
                <GraduationCap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white" size={24} />
            </div>
            <h2 className="text-3xl font-bold mb-4">{gradingResult ? "Checking Improvements..." : "Analyzing Your Blueprint..."}</h2>
            <p className="text-indigo-200 max-w-sm">The Professor is reviewing your logic, checking for gaps, and evaluating your service layers.</p>
        </div>
      )}
      {stage === AppStage.RESULTS && gradingResult && (
        <div className="min-h-screen bg-gray-50 py-8 px-4 flex justify-center relative">
            <div ref={resultsRef} className="max-w-5xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-gray-100">
                <div className="bg-white border-b border-gray-100 px-8 py-8 flex flex-col sm:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-5">
                        <button 
                            onClick={handleGoHome} 
                            className="p-3 bg-gray-50 text-gray-400 hover:text-indigo-600 transition-all rounded-2xl hover:bg-white hover:shadow-md active:scale-95" 
                            title="Back to Mission Selection"
                        >
                            <Home size={24} />
                        </button>
                        <div>
                            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{selectedScenario?.title}</h1>
                            <p className="text-indigo-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">Performance Report</p>
                        </div>
                    </div>
                    <div className="text-center sm:text-right bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100 min-w-[200px]">
                        <div className="font-extrabold text-indigo-900 text-lg">{studentName}</div>
                        <div className="text-gray-500 text-sm font-semibold">Team {teamNumber}</div>
                        <p className="text-[10px] text-gray-400 mt-2 uppercase font-black tracking-widest">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                </div>
                
                <div className="p-8 lg:p-12 bg-white">
                    <div className="flex flex-col md:flex-row items-center gap-10 mb-12">
                        <div className={`w-36 h-36 rounded-full border-[12px] flex flex-col items-center justify-center shadow-inner ${
                            gradingResult.score >= 90 ? 'border-green-500 text-green-600 bg-green-50/30' : 
                            gradingResult.score >= 80 ? 'border-indigo-500 text-indigo-600 bg-indigo-50/30' :
                            'border-amber-500 text-amber-600 bg-amber-50/30'
                        }`}>
                            <span className="text-5xl font-black leading-none">{gradingResult.letterGrade}</span>
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <h2 className="text-4xl font-black text-gray-900 mb-2">Score: {gradingResult.score} XP</h2>
                            <p className="text-gray-600 text-lg leading-relaxed max-w-2xl italic">"{gradingResult.feedbackSummary}"</p>
                        </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-8 mb-10">
                        <div className="bg-green-50/40 p-8 rounded-3xl border border-green-100 shadow-sm transition-all hover:shadow-md">
                            <h3 className="font-extrabold text-green-700 mb-5 flex items-center gap-3 text-lg"><CheckCircle size={22}/> Mission Successes</h3>
                            <ul className="space-y-4">
                                {gradingResult.strengths.map((item, i) => (
                                    <li key={i} className="flex gap-4 text-sm text-gray-700 leading-relaxed">
                                        <div className="w-5 h-5 rounded-full bg-green-200 flex items-center justify-center shrink-0 mt-0.5"><Check size={12} className="text-green-700" /></div>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="bg-red-50/40 p-8 rounded-3xl border border-red-100 shadow-sm transition-all hover:shadow-md">
                            <h3 className="font-extrabold text-red-700 mb-5 flex items-center gap-3 text-lg"><AlertCircle size={22}/> Strategic Gaps</h3>
                             <ul className="space-y-4">
                                {gradingResult.weaknesses.length > 0 ? gradingResult.weaknesses.map((item, i) => (
                                    <li key={i} className="flex gap-4 text-sm text-gray-700 leading-relaxed">
                                        <div className="w-5 h-5 rounded-full bg-red-200 flex items-center justify-center shrink-0 mt-0.5"><X size={12} className="text-red-700" /></div>
                                        {item}
                                    </li>
                                )) : (
                                    <li className="text-green-700 font-black text-center py-6 flex flex-col items-center gap-4">
                                        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-green-600 animate-bounce">
                                            <GraduationCap size={36} />
                                        </div>
                                        <div>
                                            <p className="text-lg">Outstanding Performance!</p>
                                        </div>
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>

                    {/* Compact Visualization for Report */}
                    <div className="mt-12 overflow-x-auto border border-gray-200 rounded-2xl shadow-sm blueprint-scroll">
                        <table className="w-full text-left border-collapse bg-white text-xs">
                            <thead>
                                <tr className="bg-slate-50 border-b">
                                    <th className="p-4 font-bold text-gray-500 border-r w-40 sticky left-0 bg-slate-50 z-10 uppercase tracking-widest text-[9px]">Layers</th>
                                    {blueprint.filter(c => !isColumnBlank(c)).map((col, i) => (
                                        <th key={col.id} className="p-4 font-black text-indigo-700 border-r min-w-[180px]">
                                            <span className="text-[10px] text-gray-400 block font-bold mb-1">PHASE {i + 1}</span>
                                            {col.phase}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {layers.map(layer => (
                                    <tr key={layer} className="border-b hover:bg-slate-50/30 transition-colors">
                                        <td className="p-4 font-bold text-gray-600 bg-slate-50/50 border-r sticky left-0 z-10">
                                            {LAYER_INFO[layer as LayerType].label}
                                        </td>
                                        {blueprint.filter(c => !isColumnBlank(c)).map(col => (
                                            <td key={col.id} className="p-4 border-r align-top text-gray-800 font-medium">
                                                {col[layer] || <span className="text-gray-300">—</span>}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                 <div className="p-8 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-4 justify-center items-center" data-html2canvas-ignore>
                    <button onClick={handleImproveWork} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95"><Pencil size={20} /> Refine Blueprint</button>
                    <button onClick={handleDownloadPDF} className="bg-white border-2 border-gray-200 hover:border-slate-800 text-slate-700 px-6 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all active:scale-95"><Download size={20} /> Export Evidence</button>
                    <button onClick={resetApp} className="bg-white border-2 border-gray-200 hover:border-indigo-600 text-indigo-600 px-6 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all active:scale-95"><RefreshCw size={20} /> New Mission</button>
                </div>
            </div>

            {/* Hidden Ref for PDF Generation */}
            <div ref={printRef} style={{ display: 'none' }}>
                <div className="p-16 bg-white text-black">
                    <h1 className="text-4xl font-black mb-4">Service Blueprint Performance Report</h1>
                    <div className="mb-8 border-b-2 pb-4">
                        <p><strong>Student:</strong> {studentName}</p>
                        <p><strong>Team:</strong> {teamNumber}</p>
                        <p><strong>Scenario:</strong> {selectedScenario?.title}</p>
                        <p><strong>Grade:</strong> {gradingResult.letterGrade} ({gradingResult.score} XP)</p>
                    </div>
                    <div className="mb-12">
                        <h2 className="text-2xl font-bold mb-2">Professor's Feedback</h2>
                        <p className="italic mb-4">"{gradingResult.feedbackSummary}"</p>
                    </div>
                    
                    {chunkBlueprint(blueprint, 4).map((chunk, idx) => (
                        <div key={idx} className="mb-12">
                            <h3 className="text-xl font-bold mb-4">Visualization Part {idx + 1}</h3>
                            <table className="w-full border-collapse border border-gray-300 text-sm">
                                <thead>
                                    <tr>
                                        <th className="border border-gray-300 p-2 bg-gray-100">Layer</th>
                                        {chunk.map(col => <th key={col.id} className="border border-gray-300 p-2 bg-gray-100">{col.phase}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {layers.map(layer => (
                                        <tr key={layer}>
                                            <td className="border border-gray-300 p-2 font-bold">{LAYER_INFO[layer as LayerType].label}</td>
                                            {chunk.map(col => <td key={col.id} className="border border-gray-300 p-2">{col[layer]}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-10 relative animate-in zoom-in-95 duration-200">
                 <button onClick={() => setShowCustomModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 transition-all rounded-lg p-1">
                    <X size={24} />
                 </button>
                 <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                    <PenTool size={32} />
                 </div>
                 <h2 className="text-3xl font-black text-gray-900 mb-6">Create Custom Mission</h2>
                 <div className="space-y-6">
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block">Mission Title</label>
                        <input type="text" className="w-full p-4 border-2 border-gray-100 rounded-2xl bg-white text-gray-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-semibold" placeholder="e.g. Smart Home Installation" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block">Context & Constraints</label>
                        <textarea className="w-full p-4 border-2 border-gray-100 rounded-2xl h-40 bg-white text-gray-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all resize-none font-medium text-sm leading-relaxed" placeholder="Describe the service environment..." value={customContext} onChange={(e) => setCustomContext(e.target.value)} />
                    </div>
                    <button onClick={handleCreateCustom} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100">
                        Initialize Mission
                    </button>
                 </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
