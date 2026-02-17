import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppStage, BlueprintColumn, GradingResult, Scenario } from './types';
import { SCENARIOS, EXAMPLE_BLUEPRINT, TUTORIAL_SCENARIO, LAYER_INFO } from './constants';
import { gradeBlueprint } from './services/geminiService';
import BlueprintBuilder from './components/BlueprintBuilder';
import { ArrowRight, CheckCircle, Play, Clock, Loader2, X, PenTool, Sparkles, PlayCircle, Pencil, LayoutGrid, User, BookOpen, Download, Check, AlertCircle, Link, ShieldCheck, Zap, Database, Activity, Eye, Info, Home, ChevronRight } from 'lucide-react';
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

// @google/genai Guidelines: Define AIStudio interface to resolve conflict with pre-existing global declarations
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [stage, setStage] = useState<AppStage>(AppStage.SCENARIO_SELECTION);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [blueprint, setBlueprint] = useState<BlueprintColumn[]>([]);
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  const [studentName, setStudentName] = useState(localStorage.getItem('student_name') || '');

  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customContext, setCustomContext] = useState('');
  const [isTutorialMode, setIsTutorialMode] = useState(false);

  const builderRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Check connection status on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setIsConnected(hasKey);
      }
    };
    checkConnection();
  }, []);

  useEffect(() => {
    localStorage.setItem('student_name', studentName);
  }, [studentName]);

  const handleAuthorize = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setIsConnected(true);
    }
  };

  const resetApp = useCallback(() => {
    setStage(AppStage.SCENARIO_SELECTION);
    setSelectedScenario(null);
    setBlueprint([]);
    setGradingResult(null);
    setIsTutorialMode(false);
    // Reliable navigation back to selection screen requires a reset of scroll position
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleGoHome = useCallback((e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e && 'preventDefault' in e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Safety check for active building
    const isBuilderActive = stage === AppStage.BLUEPRINT_BUILDER && !isTutorialMode;
    if (isBuilderActive) {
      if (window.confirm("Abort Mission? Any unsaved progress on your blueprint will be lost.")) {
        resetApp();
      }
    } else {
      resetApp();
    }
  }, [stage, isTutorialMode, resetApp]);

  // Global Keyboard Shortcut for Home (Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stage !== AppStage.SCENARIO_SELECTION) {
        handleGoHome();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stage, handleGoHome]);

  const startScenario = (scenario: Scenario) => {
    if (!isConnected) {
      handleAuthorize();
      return;
    }
    setSelectedScenario(scenario);
    setIsTutorialMode(false);
    setGradingResult(null); 
    const initialBlueprint: BlueprintColumn[] = scenario.initialPhases.map((phase, index) => ({
      id: `col-${index}`,
      phase,
      physical: '', customer: '', frontstage: '', backstage: '', support: '',
      painPoints: [], opportunities: []
    }));
    setBlueprint(initialBlueprint);
    setStage(AppStage.BLUEPRINT_BUILDER);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleCreateCustom = () => {
    if (!customTitle.trim()) { alert("Please enter a Codename."); return; }
    if (!customContext.trim()) { alert("Please provide context."); return; }
    const customScenario: Scenario = {
      id: `custom-${Date.now()}`,
      title: customTitle,
      description: 'Custom Designed Scenario',
      difficulty: 'Advanced',
      initialPhases: ['Initial Phase'],
      context: customContext
    };
    setShowCustomModal(false);
    setCustomTitle('');
    setCustomContext('');
    startScenario(customScenario);
  };

  const startTutorial = () => {
    if (!studentName.trim()) { alert("Please enter your Student Name in the header first."); return; }
    setSelectedScenario(TUTORIAL_SCENARIO);
    setIsTutorialMode(true);
    setGradingResult(null);
    setBlueprint(TUTORIAL_SCENARIO.initialPhases.map((phase, index) => ({
      id: `col-${index}`,
      phase,
      physical: '', customer: '', frontstage: '', backstage: '', support: '',
      painPoints: [], opportunities: []
    })));
    setStage(AppStage.BLUEPRINT_BUILDER);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleLoadExample = () => {
    const exampleScenario = SCENARIOS.find(s => s.id === 'coffee-shop');
    if (exampleScenario) {
      setSelectedScenario(exampleScenario);
      setBlueprint(JSON.parse(JSON.stringify(EXAMPLE_BLUEPRINT)));
      setGradingResult(null);
      setIsTutorialMode(false);
      setStage(AppStage.BLUEPRINT_BUILDER);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const handleSubmission = async () => {
    if (!selectedScenario) return;
    setStage(AppStage.SUBMISSION);
    setIsGrading(true);
    try {
      const result = await gradeBlueprint(blueprint, selectedScenario, gradingResult || undefined);
      setGradingResult(result);
      setIsGrading(false);
      setStage(AppStage.RESULTS);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setIsGrading(false);
      setStage(AppStage.BLUEPRINT_BUILDER);
      
      if (e?.message === "QUOTA_EXHAUSTED" || e?.message?.includes('429')) {
          alert("Rate Limit Exceeded (429). The free tier API key has a limited number of requests per minute. Please wait 60 seconds and try again, or use a project with billing enabled.");
      } else if (e?.message?.includes("Requested entity was not found")) {
          setIsConnected(false);
          alert("API Key expired or invalid. Please re-authorize via the 'Link Project' button.");
      } else {
          alert("Submission failed. This could be due to network issues or API limits. Please try again in a moment.");
      }
    }
  };

  const handleImproveWork = () => {
    setStage(AppStage.BLUEPRINT_BUILDER);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDownloadPDF = async () => {
    const element = stage === AppStage.RESULTS ? resultsRef.current : builderRef.current;
    if (!element) {
        alert("Nothing to export. Please complete the blueprint or view results first.");
        return;
    }
    
    try {
      const canvas = await html2canvas(element, { 
        scale: 1.5, 
        useCORS: true, 
        backgroundColor: '#ffffff',
        logging: false,
        scrollY: -window.scrollY, 
        width: element.scrollWidth,
        height: element.scrollHeight
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const margin = 10;
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = (canvas.height * contentWidth) / canvas.width;
      
      let heightLeft = contentHeight;
      let position = margin;
      
      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
      heightLeft -= (pageHeight - margin * 2);
      
      while (heightLeft >= 0) {
        position = heightLeft - contentHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${studentName || 'Student'}_Service_Brief.pdf`);
    } catch (err) { 
      console.error("Export Error:", err);
      alert("Failed to generate PDF. Check browser console for details."); 
    }
  };

  return (
    <div className="font-sans text-slate-900 selection:bg-indigo-100 min-h-screen bg-slate-50 flex flex-col">
      {/* Global Command Bar: Persistent Navigation */}
      {stage !== AppStage.SCENARIO_SELECTION && stage !== AppStage.SUBMISSION && (
        <nav className="sticky top-0 z-[100] bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-2xl px-6 py-4 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500 shrink-0">
           <div className="flex items-center gap-4">
              <button 
                type="button"
                onClick={handleGoHome}
                className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 shadow-lg group cursor-pointer"
              >
                <LayoutGrid size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                <span className="hidden sm:inline uppercase tracking-widest text-[10px]">Mission Control</span>
              </button>
              <div className="h-6 w-px bg-slate-700 mx-2 hidden sm:block"></div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold uppercase text-[9px] tracking-widest hidden lg:block">ACTIVE OPERATION</span>
                <ChevronRight size={14} className="text-slate-600 hidden lg:block" />
                <h2 className="text-white font-black text-lg truncate max-w-[150px] md:max-w-none tracking-tight">{selectedScenario?.title}</h2>
              </div>
           </div>

           <div className="flex items-center gap-4">
              {stage === AppStage.BLUEPRINT_BUILDER && (
                <button 
                  type="button"
                  onClick={handleSubmission}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-500 transition-all flex items-center gap-2 active:scale-95"
                >
                  Analyze <ArrowRight size={16} />
                </button>
              )}
              {stage === AppStage.RESULTS && (
                <button 
                  type="button"
                  onClick={handleDownloadPDF}
                  className="bg-slate-800 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center gap-2"
                >
                  <Download size={16} /> Export
                </button>
              )}
           </div>
        </nav>
      )}

      <main className="flex-1 flex flex-col overflow-x-hidden">
        {stage === AppStage.SCENARIO_SELECTION && (
          <div className="p-8 pb-24 animate-in fade-in duration-500">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-16 border-b-4 border-slate-200 pb-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                      <LayoutGrid size={28} />
                    </div>
                    <div>
                      <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">Mission Control</h1>
                      <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Service Blueprint Toolkit</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm">
                      <User className="text-slate-300" size={16} />
                      <input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Student Name" className="bg-transparent font-bold text-xs w-32 outline-none" />
                    </div>
                    
                    <button 
                      onClick={handleAuthorize}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-bold text-[11px] tracking-wide uppercase shadow-sm transition-all active:scale-95 ${
                        isConnected 
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-600' 
                        : 'bg-amber-50 border-amber-100 text-amber-600 animate-pulse'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                      {isConnected ? 'Uplink Established' : 'Authorize AI Uplink'}
                    </button>

                    <button onClick={startTutorial} className="bg-indigo-600 text-white px-7 py-3 rounded-xl font-black flex items-center gap-2 shadow-xl hover:scale-105 active:scale-95 text-[11px] uppercase tracking-widest transition-transform">
                      <BookOpen size={16} /> Bootcamp
                    </button>
                  </div>
              </div>

              {!isConnected && (
                <div className="mb-16 bg-gradient-to-r from-amber-500 to-orange-600 rounded-[3rem] p-12 text-white flex flex-col md:flex-row items-center gap-10 shadow-2xl">
                   <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                      <Zap size={48} className="text-amber-100" />
                   </div>
                   <div className="flex-1">
                      <h2 className="text-3xl font-black mb-3">AI Connection Required</h2>
                      <p className="text-amber-50 opacity-90 text-lg max-w-2xl">To use AI grading, each student must provide their own Gemini API key or link a Google Cloud Project.</p>
                   </div>
                   <div className="flex flex-col gap-3 shrink-0">
                      <button onClick={handleAuthorize} className="bg-white text-orange-600 px-10 py-4 rounded-2xl font-black text-lg flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-lg">
                         <Link size={20} /> Link Project
                      </button>
                      <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-white/80 text-[10px] font-bold text-center uppercase tracking-widest hover:text-white transition-colors">
                        About Project Keys & Billing
                      </a>
                   </div>
                </div>
              )}

              <div className="mb-16 flex flex-col md:flex-row gap-10">
                  <div className="flex-1 bg-slate-900 rounded-[3rem] p-16 relative overflow-hidden group shadow-2xl border border-slate-800 transition-all hover:border-indigo-500/50">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-bl-full pointer-events-none"></div>
                      <PenTool className="text-indigo-400 mb-10" size={64} />
                      <h3 className="text-5xl font-black text-white mb-6 tracking-tighter">Custom Simulation</h3>
                      <p className="text-slate-400 mb-16 text-xl leading-relaxed">Define your own service environment and persona.</p>
                      <button onClick={() => setShowCustomModal(true)} className="bg-indigo-600 text-white px-12 py-5 rounded-[2rem] font-black shadow-2xl hover:scale-110 active:scale-95 text-xl transition-transform">Initialize Protocol</button>
                  </div>

                  <div className="flex-1 bg-indigo-700 rounded-[3rem] p-16 relative overflow-hidden group shadow-2xl border border-indigo-600 transition-all hover:border-white/20">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-bl-full pointer-events-none"></div>
                      <Sparkles className="text-amber-400 mb-10" size={64} />
                      <h3 className="text-5xl font-black text-white mb-6 tracking-tighter">Expert Showcase</h3>
                      <p className="text-indigo-100 mb-16 text-xl leading-relaxed">Analyze a masterfully crafted coffee rush blueprint.</p>
                      <button onClick={handleLoadExample} className="bg-white text-indigo-700 px-12 py-5 rounded-[2rem] font-black shadow-2xl hover:bg-slate-50 hover:scale-110 active:scale-95 text-xl transition-transform text-center">Analyze Mastery</button>
                  </div>
              </div>

              <div>
                  <h2 className="text-3xl font-black text-slate-800 mb-10 flex items-center gap-4"><PlayCircle size={36} className="text-indigo-600"/> Simulation Briefs</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                      {SCENARIOS.map((scenario) => (
                          <div key={scenario.id} className="bg-white rounded-[3rem] shadow-sm hover:shadow-xl border-4 border-slate-100 p-12 flex flex-col relative overflow-hidden group transition-all">
                              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 pointer-events-none -z-10 group-hover:bg-indigo-50"></div>
                              <div className="flex justify-between items-start mb-8">
                                  <span className="px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600">{scenario.difficulty}</span>
                                  <Clock size={24} className="text-slate-200" />
                              </div>
                              <h3 className="text-4xl font-black text-slate-900 mb-6 group-hover:text-indigo-600 transition-colors leading-none">{scenario.title}</h3>
                              <p className="text-slate-500 text-lg mb-12 flex-1 leading-relaxed">{scenario.description}</p>
                              <button 
                                onClick={() => startScenario(scenario)} 
                                className={`w-full py-5 rounded-[2rem] font-black flex items-center justify-center gap-4 transition-all active:scale-95 shadow-2xl text-xl ${
                                  !isConnected && scenario.difficulty !== 'Beginner' 
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                  : 'bg-slate-900 text-white hover:bg-indigo-600'
                                }`}
                              >
                                Deploy Mission <Play size={24} className="fill-current" />
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
            </div>
          </div>
        )}

        {stage === AppStage.BLUEPRINT_BUILDER && selectedScenario && (
          <div ref={builderRef} className="flex-1 flex flex-col min-h-0">
            <BlueprintBuilder 
              blueprint={blueprint} setBlueprint={setBlueprint} 
              onComplete={handleSubmission} 
              scenario={selectedScenario} isTutorial={isTutorialMode}
              onTutorialComplete={resetApp} onBackToControl={handleGoHome}
              onExport={handleDownloadPDF} 
              previousGradingResult={gradingResult}
            />
          </div>
        )}

        {stage === AppStage.SUBMISSION && (
           <div className="flex-1 bg-indigo-900 flex flex-col items-center justify-center p-6 text-white text-center min-h-[500px]">
              <Loader2 className="animate-spin text-indigo-400 mb-8" size={64} />
              <h2 className="text-4xl font-black mb-4 tracking-tight">Professor Reviewing Work...</h2>
              <p className="text-indigo-200 max-w-sm text-lg leading-relaxed">Analyzing logic and systemic dependencies to provide objective feedback.</p>
              <p className="text-indigo-400 mt-4 text-[10px] uppercase font-bold tracking-[0.2em] animate-pulse">Establishing Neural Uplink</p>
          </div>
        )}

        {stage === AppStage.RESULTS && gradingResult && (
          <div className="flex-1 bg-slate-50 py-16 px-4 flex justify-center animate-in fade-in zoom-in-95 duration-500">
              <div ref={resultsRef} className="max-w-6xl w-full bg-white rounded-[4rem] shadow-2xl flex flex-col border border-slate-100 mb-16 overflow-hidden">
                  <div className="p-16 lg:p-24 bg-white flex-1 overflow-visible">
                      <div className="flex flex-col md:flex-row items-center gap-16 mb-20">
                          <div className={`w-56 h-56 rounded-full border-[20px] flex flex-col items-center justify-center shadow-xl shrink-0 ${gradingResult.score >= 80 ? 'border-green-500 text-green-600 bg-green-50' : 'border-amber-500 text-amber-600 bg-amber-50'}`}>
                              <span className="text-8xl font-black">{gradingResult.letterGrade}</span>
                          </div>
                          <div className="flex-1 text-center md:text-left">
                              <h2 className="text-6xl font-black text-slate-900 mb-6 tracking-tighter">Performance: {gradingResult.score} XP</h2>
                              <p className="text-slate-500 text-2xl italic leading-relaxed">"{gradingResult.feedbackSummary}"</p>
                          </div>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-12 mb-20">
                          <div className="bg-green-50 p-12 rounded-[3.5rem] border-4 border-green-100 shadow-sm">
                              <h3 className="font-black text-green-700 mb-8 flex items-center gap-5 text-3xl"><CheckCircle size={40}/> Strategic Wins</h3>
                              <ul className="space-y-6">
                                  {gradingResult.strengths.map((item, i) => <li key={i} className="flex gap-5 text-xl text-slate-700 font-medium"><div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center shrink-0 mt-1"><Check size={18} /></div>{item}</li>)}
                              </ul>
                          </div>
                          <div className="bg-red-50 p-12 rounded-[3.5rem] border-4 border-red-100 shadow-sm">
                              <h3 className="font-black text-red-700 mb-8 flex items-center gap-5 text-3xl"><AlertCircle size={40}/> Critical Gaps</h3>
                               <ul className="space-y-6">
                                  {gradingResult.weaknesses.length > 0 ? gradingResult.weaknesses.map((item, i) => <li key={i} className="flex gap-5 text-xl text-slate-700 font-medium"><div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center shrink-0 mt-1"><X size={18} /></div>{item}</li>) : <li className="text-green-700 font-black text-3xl text-center py-10">Perfect Execution!</li>}
                              </ul>
                          </div>
                      </div>

                      <div className="mt-20 border-t-4 border-slate-50 pt-20">
                        <div className="flex items-center gap-4 mb-16">
                            <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center shadow-lg"><Database size={32} /></div>
                            <div>
                                <h3 className="text-5xl font-black text-slate-900 tracking-tighter">Service Architecture Brief</h3>
                                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest mt-2">TECHNICAL BREAKDOWN OF SUBMITTED ARCHITECTURE</p>
                            </div>
                        </div>

                        <div className="space-y-16">
                            {blueprint.filter(col => col.phase.trim() !== '').map((col, index) => (
                                <div key={col.id} className="bg-white rounded-[4rem] border-4 border-slate-50 overflow-hidden shadow-sm">
                                    <div className="bg-slate-900 p-10 flex items-center gap-8">
                                        <span className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg shrink-0">{index + 1}</span>
                                        <h4 className="text-4xl font-black text-white tracking-tight">{col.phase}</h4>
                                    </div>

                                    <div className="p-12 space-y-8">
                                        {Object.keys(LAYER_INFO).map((layer) => (
                                            <div key={layer} className="flex flex-col md:flex-row gap-6 md:items-start border-b border-slate-100 pb-8 last:border-0 last:pb-0">
                                                <div className="w-full md:w-64 shrink-0">
                                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 flex items-center gap-3">
                                                      <div className={`w-3 h-3 rounded-full ${LAYER_INFO[layer as keyof typeof LAYER_INFO].color.split(' ')[0]}`}></div>
                                                      {LAYER_INFO[layer as keyof typeof LAYER_INFO].label}
                                                    </span>
                                                    <p className="text-[9px] text-slate-400 font-medium leading-tight md:pr-4">{LAYER_INFO[layer as keyof typeof LAYER_INFO].description}</p>
                                                </div>
                                                <div className={`flex-1 p-6 rounded-3xl border-2 font-medium text-slate-800 text-lg leading-relaxed ${LAYER_INFO[layer as keyof typeof LAYER_INFO].color.split(' ').slice(0, 2).join(' ')} border-opacity-20 shadow-inner`}>
                                                    {col[layer as keyof BlueprintColumn] || <span className="text-slate-300 italic text-base">No documented action for this layer.</span>}
                                                </div>
                                            </div>
                                        ))}

                                        <div className="grid md:grid-cols-2 gap-10 pt-10 border-t-2 border-slate-50">
                                            <div className="bg-red-50/50 p-8 rounded-3xl border-2 border-red-50">
                                                <div className="flex items-center gap-3 mb-6">
                                                    <AlertCircle size={24} className="text-red-500" />
                                                    <span className="text-xs font-black uppercase text-red-600 tracking-widest">Pain Points</span>
                                                </div>
                                                <div className="space-y-3">
                                                    {col.painPoints.length > 0 ? col.painPoints.map((p, i) => (
                                                        <div key={i} className="bg-white px-5 py-3 rounded-2xl text-sm font-bold border border-red-100 text-red-700 shadow-sm flex gap-3"><span className="text-red-300">•</span> {p}</div>
                                                    )) : <div className="text-slate-400 text-sm italic py-2">Optimal flow—no pain points detected.</div>}
                                                </div>
                                            </div>
                                            <div className="bg-emerald-50/50 p-8 rounded-3xl border-2 border-emerald-50">
                                                <div className="flex items-center gap-3 mb-6">
                                                    <Zap size={24} className="text-emerald-500" />
                                                    <span className="text-xs font-black uppercase text-emerald-600 tracking-widest">Growth Opportunities</span>
                                                </div>
                                                <div className="space-y-3">
                                                    {col.opportunities.length > 0 ? col.opportunities.map((o, i) => (
                                                        <div key={i} className="bg-white px-5 py-3 rounded-2xl text-sm font-bold border border-emerald-100 text-emerald-700 shadow-sm flex gap-3"><span className="text-emerald-300">•</span> {o}</div>
                                                    )) : <div className="text-slate-400 text-sm italic py-2">Baseline service—no strategic improvements noted.</div>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                      </div>
                  </div>

                  <div className="p-16 bg-slate-900 border-t-8 border-white/5 flex flex-col sm:flex-row gap-8 justify-center items-center rounded-b-[4rem] shrink-0">
                      <button type="button" onClick={handleImproveWork} className="bg-indigo-600 text-white px-12 py-6 rounded-[2.5rem] font-black flex items-center gap-4 shadow-2xl hover:scale-110 active:scale-95 text-xl transition-transform"><Pencil size={28} /> Refine Work</button>
                      <button type="button" onClick={handleDownloadPDF} className="bg-slate-800 text-white px-10 py-6 rounded-[2.5rem] font-black flex items-center gap-4 hover:bg-slate-700 active:scale-95 text-xl transition-all"><Download size={28} /> Export Brief</button>
                      <button type="button" onClick={handleGoHome} className="bg-white text-indigo-600 px-10 py-6 rounded-[2.5rem] font-black flex items-center gap-4 hover:border-indigo-600 active:scale-95 text-xl relative z-10 transition-all"><LayoutGrid size={28} /> Mission Control</button>
                  </div>
              </div>
          </div>
        )}
      </main>

      {showCustomModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-white rounded-[4rem] shadow-2xl w-full max-w-3xl p-16 relative">
                 <button onClick={() => setShowCustomModal(false)} className="absolute top-12 right-12 text-slate-300 hover:text-slate-900 p-3 hover:bg-slate-100 rounded-full cursor-pointer transition-colors"><X size={44} /></button>
                 <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mb-10 border-4 border-indigo-100 shadow-inner"><PenTool size={48} /></div>
                 <h2 className="text-5xl font-black text-slate-900 mb-12 tracking-tighter">Initialize Protocol</h2>
                 <div className="space-y-12">
                    <div className="bg-slate-50/50 p-6 rounded-[3rem] border-2 border-slate-100">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block ml-2">Simulation Codename</label>
                        <input type="text" className="w-full p-8 rounded-[2rem] bg-white border-2 border-transparent focus:border-indigo-500 outline-none font-black text-2xl shadow-sm" placeholder="e.g. SMART RETAIL" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} />
                    </div>
                    <div className="bg-slate-50/50 p-6 rounded-[3rem] border-2 border-slate-100">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block ml-2">Context & Constraints</label>
                        <textarea className="w-full p-8 rounded-[2rem] h-64 bg-white border-2 border-transparent focus:border-indigo-500 outline-none resize-none font-black text-xl shadow-sm" placeholder="Environment, persona, challenges..." value={customContext} onChange={(e) => setCustomContext(e.target.value)} />
                    </div>
                    <button onClick={handleCreateCustom} className="w-full bg-slate-900 text-white py-10 rounded-[2.5rem] font-black text-2xl hover:bg-indigo-600 transition-all shadow-2xl active:scale-95 cursor-pointer">Confirm Simulation Data</button>
                 </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
