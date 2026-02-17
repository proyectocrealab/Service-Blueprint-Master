
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppStage, BlueprintColumn, GradingResult, Scenario, SavedBlueprint } from './types';
import { SCENARIOS, EXAMPLE_BLUEPRINT, TUTORIAL_SCENARIO, LAYER_INFO } from './constants';
import { gradeBlueprint } from './services/geminiService';
import { getSavedBlueprints, saveBlueprint, deleteBlueprint, exportAllData, importDataFromFile } from './services/storageService';
import BlueprintBuilder from './components/BlueprintBuilder';
import { ArrowRight, CheckCircle, Play, Clock, Loader2, X, PenTool, Sparkles, LayoutGrid, User, BookOpen, Download, Check, AlertCircle, Database, Activity, Info, ChevronRight, Save, Trash2, Upload, FileJson, Bookmark, Search, Filter, Trophy, Pencil, Zap } from 'lucide-react';
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

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
  const [activeSaveId, setActiveSaveId] = useState<string | undefined>(undefined);
  
  const [studentName, setStudentName] = useState(localStorage.getItem('student_name') || '');
  const [savedMissions, setSavedMissions] = useState<SavedBlueprint[]>([]);
  
  // UI Feedback States
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [lastSavedName, setLastSavedName] = useState('');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<Date | null>(null);

  // Library States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState<'All' | 'Beginner' | 'Intermediate' | 'Advanced'>('All');
  const [libraryTab, setLibraryTab] = useState<'objectives' | 'archives'>('objectives');

  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customContext, setCustomContext] = useState('');
  const [isTutorialMode, setIsTutorialMode] = useState(false);

  const builderRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  
  // Refs to always have the latest values for the auto-save interval
  const blueprintRef = useRef(blueprint);
  const selectedScenarioRef = useRef(selectedScenario);
  const activeSaveIdRef = useRef(activeSaveId);
  const studentNameRef = useRef(studentName);

  useEffect(() => { blueprintRef.current = blueprint; }, [blueprint]);
  useEffect(() => { selectedScenarioRef.current = selectedScenario; }, [selectedScenario]);
  useEffect(() => { activeSaveIdRef.current = activeSaveId; }, [activeSaveId]);
  useEffect(() => { studentNameRef.current = studentName; }, [studentName]);

  // Load saves on mount
  useEffect(() => {
    refreshSavedMissions();
    
    const checkConnection = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setIsConnected(hasKey);
      } else {
        // If not in AI Studio (e.g. Netlify), assume connected if API_KEY env is set
        setIsConnected(!!process.env.API_KEY);
      }
    };
    checkConnection();
  }, []);

  // AUTO-SAVE SYSTEM: Executes every 60 seconds when building
  useEffect(() => {
    if (stage !== AppStage.BLUEPRINT_BUILDER || isTutorialMode) {
      setAutoSaveStatus('idle');
      return;
    }

    const performAutoSave = () => {
      if (!selectedScenarioRef.current) return;

      setAutoSaveStatus('saving');
      try {
        const currentName = activeSaveIdRef.current 
          ? (getSavedBlueprints().find(s => s.id === activeSaveIdRef.current)?.name || `Draft: ${selectedScenarioRef.current.title}`)
          : `Auto-save: ${selectedScenarioRef.current.title}`;

        const saved = saveBlueprint(
          currentName,
          studentNameRef.current,
          selectedScenarioRef.current,
          blueprintRef.current,
          activeSaveIdRef.current,
          false,
          undefined // No score on auto-save
        );

        if (!activeSaveIdRef.current) {
          setActiveSaveId(saved.id);
        }
        
        setLastAutoSaveTime(new Date());
        setAutoSaveStatus('success');
        refreshSavedMissions();
      } catch (err) {
        console.error("Auto-save failed:", err);
        setAutoSaveStatus('error');
      }
    };

    const interval = setInterval(performAutoSave, 60000); // 60 Seconds
    return () => clearInterval(interval);
  }, [stage, isTutorialMode]);

  const refreshSavedMissions = () => {
    const saves = getSavedBlueprints();
    setSavedMissions(saves);
  };

  useEffect(() => {
    localStorage.setItem('student_name', studentName);
  }, [studentName]);

  const handleAuthorize = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setIsConnected(true);
    } else {
      alert("System Note: Security Uplink is managed via environment variables in this deployment.");
    }
  };

  const resetApp = useCallback(() => {
    setStage(AppStage.SCENARIO_SELECTION);
    setSelectedScenario(null);
    setBlueprint([]);
    setGradingResult(null);
    setIsTutorialMode(false);
    setActiveSaveId(undefined);
    refreshSavedMissions();
    setShowSaveToast(false);
    setAutoSaveStatus('idle');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleImproveWork = useCallback(() => {
    setStage(AppStage.BLUEPRINT_BUILDER);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleGoHome = useCallback((e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e && 'preventDefault' in e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    const isBuilderActive = stage === AppStage.BLUEPRINT_BUILDER && !isTutorialMode;
    if (isBuilderActive) {
      if (window.confirm("Abort Mission? Unsaved progress will be lost. Use 'Log Archive' to preserve your work.")) {
        resetApp();
      }
    } else {
      resetApp();
    }
  }, [stage, isTutorialMode, resetApp]);

  const handleUpdateScenario = (updated: Scenario) => {
    setSelectedScenario(updated);
  };

  const handleSaveCurrent = () => {
    if (!selectedScenario) return;
    
    const existingName = activeSaveId ? savedMissions.find(m => m.id === activeSaveId)?.name : '';
    const name = prompt("Operation Name:", existingName || `Draft: ${selectedScenario.title} - ${new Date().toLocaleTimeString()}`);
    
    if (name) {
      const saved = saveBlueprint(name, studentName, selectedScenario, blueprint, activeSaveId, false, gradingResult?.score);
      setActiveSaveId(saved.id);
      setLastSavedName(name);
      refreshSavedMissions();
      
      // Show non-intrusive toast
      setShowSaveToast(true);
      if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = window.setTimeout(() => setShowSaveToast(false), 5000);
    }
  };

  const handleSaveToLibrary = () => {
    if (!selectedScenario) return;
    const currentMission = activeSaveId ? savedMissions.find(m => m.id === activeSaveId) : null;
    const name = prompt("Highlight Archive Name:", currentMission ? currentMission.name : `${selectedScenario.title} - Final Revision`);
    if (name) {
      const saved = saveBlueprint(name, studentName, selectedScenario, blueprint, activeSaveId, true, gradingResult?.score);
      setActiveSaveId(saved.id);
      refreshSavedMissions();
      alert("Pinned to Mission Library Highlights.");
    }
  };

  const handleLoadMission = (mission: SavedBlueprint) => {
    setSelectedScenario(mission.scenario);
    setBlueprint(mission.blueprint);
    setActiveSaveId(mission.id);
    setStudentName(mission.studentName);
    setIsTutorialMode(false);
    setGradingResult(null);
    setStage(AppStage.BLUEPRINT_BUILDER);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleDeleteMission = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Permanent erasure of this mission log? This cannot be undone.")) {
      deleteBlueprint(id);
      refreshSavedMissions();
    }
  };

  const handleExportBackup = () => {
    exportAllData();
  };

  const handleImportBackup = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await importDataFromFile(file);
        refreshSavedMissions();
        alert("Archive synchronized successfully.");
      } catch (err) {
        alert("Synchronization failed: Invalid archive file.");
      }
    }
  };

  const startScenario = (scenario: Scenario) => {
    if (!isConnected) {
      handleAuthorize();
      return;
    }
    setSelectedScenario(scenario);
    setIsTutorialMode(false);
    setGradingResult(null); 
    setActiveSaveId(undefined);
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

    // VALIDATION: Ensure student name is present before analysis
    if (!studentName.trim()) {
      alert("Protocol Error: Student Name (Lead Designer) must be defined before strategic analysis can proceed.");
      return;
    }

    // Auto-save progress before submission to ensure archive is updated
    const autoName = activeSaveId 
      ? savedMissions.find(m => m.id === activeSaveId)?.name 
      : `${selectedScenario.title} - ${new Date().toLocaleTimeString()}`;
    
    const preSave = saveBlueprint(
      autoName || 'Submitted Blueprint',
      studentName,
      selectedScenario,
      blueprint,
      activeSaveId,
      false,
      undefined 
    );
    setActiveSaveId(preSave.id);
    refreshSavedMissions();

    setStage(AppStage.SUBMISSION);
    setIsGrading(true);
    try {
      const result = await gradeBlueprint(blueprint, selectedScenario, gradingResult || undefined);
      setGradingResult(result);
      
      saveBlueprint(
        autoName || 'Completed Blueprint',
        studentName,
        selectedScenario,
        blueprint,
        preSave.id,
        false,
        result.score
      );
      refreshSavedMissions();

      setIsGrading(false);
      setStage(AppStage.RESULTS);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setIsGrading(false);
      setStage(AppStage.BLUEPRINT_BUILDER);
      if (e?.message === "QUOTA_EXHAUSTED" || e?.message?.includes('429')) {
          alert("Rate Limit Exceeded (429). Please wait 60 seconds.");
      } else if (e?.message?.includes("Requested entity was not found")) {
          setIsConnected(false);
          alert("API Key expired or invalid.");
      } else {
          alert("Submission failed. Try again in a moment.");
      }
    }
  };

  const handleDownloadPDF = async () => {
    const element = stage === AppStage.RESULTS ? resultsRef.current : builderRef.current;
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff', logging: false, scrollY: -window.scrollY });
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
    } catch (err) { console.error(err); }
  };

  const filteredObjectives = useMemo(() => {
    let list = [...SCENARIOS];
    if (filterDifficulty !== 'All') {
      list = list.filter(s => s.difficulty === filterDifficulty);
    }
    if (searchQuery) {
      list = list.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.description.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return list;
  }, [searchQuery, filterDifficulty]);

  const filteredArchives = useMemo(() => {
    let list = [...savedMissions];
    if (searchQuery) {
      list = list.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.scenario.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return list;
  }, [searchQuery, savedMissions]);

  const archiveCount = savedMissions.length;

  return (
    <div className="font-sans text-slate-900 selection:bg-indigo-100 min-h-screen bg-slate-50 flex flex-col">
      <input type="file" ref={fileInputRef} onChange={onFileChange} style={{ display: 'none' }} accept=".json" />
      
      {stage !== AppStage.SCENARIO_SELECTION && stage !== AppStage.SUBMISSION && (
        <nav className="sticky top-0 z-[100] bg-[#1a2130] border-b border-white/5 px-6 py-4 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500 shrink-0 shadow-2xl">
           <div className="flex items-center gap-6">
              <button onClick={handleGoHome} className="flex items-center gap-3 bg-[#4d57df] hover:bg-[#434dc9] text-white px-5 py-2 rounded-xl font-black text-xs transition-all active:scale-95 shadow-lg uppercase tracking-wider group">
                <LayoutGrid size={16} className="group-hover:rotate-90 transition-transform duration-300" />
                <span>Mission Control</span>
              </button>
              
              <div className="flex items-center gap-3 text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] whitespace-nowrap opacity-60">Active Operation</span>
                <ChevronRight size={14} className="opacity-40" />
                <h2 className="text-white font-black text-lg tracking-tight truncate max-w-[200px]">{selectedScenario?.title}</h2>
              </div>
           </div>

           <div className="flex items-center gap-3">
              {stage === AppStage.BLUEPRINT_BUILDER && (
                <>
                  <button onClick={handleSaveCurrent} className="bg-[#242d40] text-white px-4 py-2.5 rounded-xl hover:bg-[#2d3850] transition-all flex items-center gap-2 group border border-white/10" title="Save to Archives">
                    <Save size={18} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Log Archive</span>
                  </button>
                  <button onClick={handleSaveToLibrary} className="bg-[#f29100] hover:bg-[#d98200] text-white p-2.5 rounded-xl transition-all shadow-lg" title="Pin Highlight">
                    <Bookmark size={18} className="fill-white/10" />
                  </button>
                  <button onClick={handleSubmission} className="bg-[#4d57df] hover:bg-[#434dc9] text-white px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-[0.15em] shadow-xl transition-all flex items-center gap-2 active:scale-95">
                    Analyze & Archive <ArrowRight size={16} />
                  </button>
                </>
              )}
              {stage === AppStage.RESULTS && (
                <div className="flex items-center gap-3">
                  <button onClick={handleSaveToLibrary} className="bg-[#f29100] hover:bg-[#d98200] text-white p-2.5 rounded-xl transition-all shadow-lg" title="Add to Library Highlights">
                    <Bookmark size={18} />
                  </button>
                  <button onClick={handleDownloadPDF} className="bg-[#242d40] text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-[0.15em] hover:bg-[#2d3850] transition-all flex items-center gap-2 border border-white/10">
                    <Download size={16} /> Export PDF
                  </button>
                </div>
              )}
           </div>
        </nav>
      )}

      {/* NON-INTRUSIVE TOAST NOTIFICATION */}
      {showSaveToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[300] w-full max-w-lg px-4 animate-in slide-in-from-top-12 duration-500 pointer-events-none">
          <div className="bg-[#1a2130] text-white p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 flex items-center justify-between gap-6 pointer-events-auto">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-[#4d57df] rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg">
                <Check size={20} strokeWidth={3} />
              </div>
              <div className="min-w-0">
                <p className="font-black text-[10px] uppercase tracking-[0.2em] leading-none mb-1 text-indigo-400">Archive Logged</p>
                <p className="text-slate-300 text-xs truncate max-w-[200px]">"{lastSavedName}"</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 border-l border-white/10 pl-4">
               <button 
                  onClick={resetApp}
                  className="bg-white text-[#1a2130] px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all active:scale-95 flex items-center gap-2 shadow-md"
               >
                 <LayoutGrid size={12} /> Mission Control
               </button>
               <button 
                 onClick={() => setShowSaveToast(false)}
                 className="p-2 text-slate-500 hover:text-white transition-colors"
               >
                 <X size={16} />
               </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col overflow-x-hidden">
        {stage === AppStage.SCENARIO_SELECTION && (
          <div className="p-8 pb-24 animate-in fade-in duration-500">
            <div className="max-w-7xl mx-auto">
              {/* Profile Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b-4 border-slate-200 pb-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                      <LayoutGrid size={28} />
                    </div>
                    <div>
                      <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">Service Blueprint Toolkit</h1>
                      <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Made by Arturo Zamora</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm">
                      <User className="text-slate-300" size={16} />
                      <input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Student Name" className="bg-transparent font-bold text-xs w-32 outline-none" />
                    </div>
                    
                    <button onClick={handleAuthorize} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-bold text-[11px] tracking-wide uppercase shadow-sm transition-all active:scale-95 ${isConnected ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-amber-50 border-amber-100 text-amber-600 animate-pulse'}`}>
                      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                      {isConnected ? 'Uplink Ready' : 'Authorize Uplink'}
                    </button>

                    <button onClick={startTutorial} className="bg-indigo-600 text-white px-7 py-3 rounded-xl font-black flex items-center gap-2 shadow-xl hover:scale-105 active:scale-95 text-[11px] uppercase tracking-widest transition-transform">
                      <BookOpen size={16} /> Bootcamp
                    </button>
                  </div>
              </div>

              {/* Top Row: Custom Mission & Backup */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
                  {/* Custom Card */}
                  <div className="lg:col-span-2 bg-slate-900 rounded-[3rem] p-12 relative overflow-hidden group shadow-2xl border border-slate-800 transition-all hover:border-indigo-500/50">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-bl-full pointer-events-none"></div>
                      <PenTool className="text-indigo-400 mb-8" size={56} />
                      <h3 className="text-4xl font-black text-white mb-4 tracking-tighter">Initialize New Mission</h3>
                      <p className="text-slate-400 mb-10 text-lg leading-relaxed max-w-md">Define custom parameters for a unique Mission architecture simulation.</p>
                      <button onClick={() => setShowCustomModal(true)} className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:bg-indigo-500 active:scale-95 text-lg transition-all">Start Protocol</button>
                  </div>

                  {/* Backup Card */}
                  <div className="bg-white rounded-[3rem] p-10 shadow-xl border-4 border-slate-100 flex flex-col justify-between">
                      <div>
                        <FileJson className="text-slate-300 mb-6" size={48} />
                        <h3 className="text-2xl font-black text-slate-900 mb-2">Central Archive</h3>
                        <p className="text-slate-500 text-sm leading-relaxed mb-8">Synchronize all local logs or restore from an external archive file.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <button onClick={handleExportBackup} className="bg-slate-100 text-slate-600 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2"><Download size={14} /> Backup</button>
                        <button onClick={handleImportBackup} className="bg-indigo-50 text-indigo-600 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"><Upload size={14} /> Restore</button>
                      </div>
                  </div>
              </div>

              {/* Mission Library Interface */}
              <div className="bg-white rounded-[4rem] p-10 lg:p-16 shadow-2xl border border-slate-100 min-h-[600px] flex flex-col">
                  {/* Filters & Tabs */}
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 mb-12">
                      <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl self-start">
                          <button onClick={() => setLibraryTab('objectives')} className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${libraryTab === 'objectives' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                            Learning Objectives
                          </button>
                          <button onClick={() => setLibraryTab('archives')} className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all relative ${libraryTab === 'archives' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                            Mission Archives
                            {archiveCount > 0 && <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-[9px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">{archiveCount}</span>}
                          </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                          <div className="relative group flex-1 min-w-[300px]">
                              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                              <input 
                                type="text" 
                                placeholder="Filter missions or archives..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-400 focus:bg-white outline-none font-bold text-sm shadow-inner transition-all" 
                              />
                          </div>
                          
                          <div className="flex items-center gap-2 bg-slate-50 border-2 border-slate-100 p-1.5 rounded-2xl">
                              <Filter size={18} className="text-slate-400 ml-3 mr-2" />
                              {['All', 'Beginner', 'Intermediate', 'Advanced'].map(diff => (
                                <button 
                                  key={diff}
                                  onClick={() => setFilterDifficulty(diff as any)}
                                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterDifficulty === diff ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-200'}`}
                                >
                                  {diff}
                                </button>
                              ))}
                          </div>
                      </div>
                  </div>

                  {/* Objective Grid */}
                  {libraryTab === 'objectives' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      {/* Expert Model Special Card */}
                      <div onClick={handleLoadExample} className="bg-indigo-700 rounded-[3rem] p-10 text-white shadow-xl hover:scale-[1.02] active:scale-95 transition-all cursor-pointer relative overflow-hidden group border-4 border-indigo-600 flex flex-col justify-between">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full pointer-events-none"></div>
                          <div>
                            <Sparkles className="text-amber-400 mb-6" size={40} />
                            <h3 className="text-2xl font-black mb-3 tracking-tight leading-tight">Expert Model: Coffee Shop</h3>
                            <p className="text-indigo-100/80 text-sm leading-relaxed">Study a masterfully drafted blueprint as a technical and strategic reference.</p>
                          </div>
                          <div className="flex items-center gap-2 font-black uppercase text-[10px] tracking-widest mt-8">Examine Masterpiece <ArrowRight size={14} /></div>
                      </div>

                      {filteredObjectives.map((scenario) => (
                          <div key={scenario.id} onClick={() => startScenario(scenario)} className="bg-white rounded-[3rem] shadow-sm hover:shadow-xl border-4 border-slate-100 p-10 flex flex-col relative overflow-hidden group transition-all cursor-pointer hover:border-indigo-200">
                              <div className="flex justify-between items-start mb-6">
                                  <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                    scenario.difficulty === 'Beginner' ? 'bg-emerald-50 text-emerald-600' :
                                    scenario.difficulty === 'Intermediate' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                                  }`}>{scenario.difficulty}</span>
                                  <div className="w-10 h-10 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center"><Database size={20} /></div>
                              </div>
                              <h3 className="text-2xl font-black text-slate-900 mb-4 group-hover:text-indigo-600 transition-colors leading-tight">{scenario.title}</h3>
                              <p className="text-slate-500 text-sm mb-10 flex-1 leading-relaxed">{scenario.description}</p>
                              <div className="flex items-center gap-3 font-black text-slate-900 uppercase text-[10px] tracking-widest group-hover:text-indigo-600">Start Mission <Play size={14} className="fill-current" /></div>
                          </div>
                      ))}

                      {filteredObjectives.length === 0 && (
                        <div className="col-span-full py-20 text-center">
                          <Search size={64} className="text-slate-200 mx-auto mb-6" />
                          <h4 className="text-2xl font-black text-slate-400 uppercase tracking-widest">No matching objectives found</h4>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mission Archive Grid */}
                  {libraryTab === 'archives' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      {filteredArchives.map((mission) => (
                        <div key={mission.id} onClick={() => handleLoadMission(mission)} className="bg-white rounded-[3rem] p-10 border-4 border-slate-100 hover:border-indigo-400 hover:shadow-2xl transition-all cursor-pointer group relative overflow-hidden flex flex-col h-full min-h-[360px]">
                          {/* Completion Progress Bar */}
                          <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-50">
                            <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${mission.completionRate || 0}%` }}></div>
                          </div>

                          <div className="flex justify-between items-start mb-6 mt-2">
                            <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${
                              mission.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                            }`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${mission.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                              {mission.status === 'completed' ? 'Analyzed' : 'In Progress'}
                            </div>
                            <button 
                                type="button"
                                onClick={(e) => handleDeleteMission(e, mission.id)} 
                                className="text-slate-300 hover:text-red-500 transition-all p-2 z-20 relative bg-white/50 rounded-lg hover:bg-white shadow-sm hover:scale-110 active:scale-95"
                                title="Delete Mission Log"
                            >
                                <Trash2 size={18} />
                            </button>
                          </div>
                          
                          <div className="mb-8">
                            <div className="flex items-center gap-2 mb-1">
                                {mission.isLibrary && <Bookmark size={14} className="text-amber-500 fill-amber-500" />}
                                <h4 className="text-2xl font-black text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors truncate">{mission.name}</h4>
                            </div>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{mission.scenario.title}</p>
                          </div>

                          <div className="flex-1 flex flex-col justify-end gap-6">
                            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <div className="flex items-center gap-3">
                                  <Trophy size={18} className={mission.score !== undefined ? 'text-amber-500' : 'text-slate-300'} />
                                  <span className="text-lg font-black text-slate-700">{mission.score !== undefined ? mission.score : '--'} <span className="text-[10px] text-slate-400 font-bold uppercase ml-1">XP</span></span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] font-black text-indigo-600 uppercase block">{mission.completionRate || 0}%</span>
                                  <span className="text-[8px] text-slate-400 font-bold uppercase block tracking-tighter">Documented</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                <span className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-2"><Clock size={12}/> {new Date(mission.lastModified).toLocaleDateString()}</span>
                                <div className="flex items-center gap-1 text-indigo-600 font-black text-[10px] uppercase">Review & Continue <ArrowRight size={12} /></div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {filteredArchives.length === 0 && (
                        <div className="col-span-full py-24 text-center border-4 border-dashed border-slate-100 rounded-[3rem]">
                          <Activity size={64} className="text-slate-200 mx-auto mb-6" />
                          <h4 className="text-2xl font-black text-slate-300 uppercase tracking-widest mb-2">Archive Empty</h4>
                          <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">Every time you save or submit a blueprint, a mission log will be automatically stored here.</p>
                        </div>
                      )}
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}

        {stage === AppStage.BLUEPRINT_BUILDER && selectedScenario && (
          <div ref={builderRef} className="flex-1 flex flex-col min-h-0 relative">
            <BlueprintBuilder 
              blueprint={blueprint} setBlueprint={setBlueprint} 
              onComplete={handleSubmission} 
              scenario={selectedScenario} isTutorial={isTutorialMode}
              onTutorialComplete={resetApp} onBackToControl={handleGoHome}
              onExport={handleDownloadPDF} 
              previousGradingResult={gradingResult}
              onUpdateScenario={handleUpdateScenario}
              onSave={handleSaveCurrent}
              autoSaveStatus={autoSaveStatus}
              lastAutoSaveTime={lastAutoSaveTime}
              studentName={studentName}
              onUpdateStudentName={setStudentName}
            />
          </div>
        )}

        {stage === AppStage.SUBMISSION && (
           <div className="flex-1 bg-indigo-900 flex flex-col items-center justify-center p-6 text-white text-center min-h-[500px]">
              <Loader2 className="animate-spin text-indigo-400 mb-8" size={64} />
              <h2 className="text-4xl font-black mb-4 tracking-tight">Professor Analysis in Progress...</h2>
              <p className="text-indigo-200 max-w-sm text-lg leading-relaxed">Mapping logic against service standards and identifying strategic gaps.</p>
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
                              <h2 className="text-6xl font-black text-slate-900 mb-2 tracking-tighter">Score: {gradingResult.score} XP</h2>
                              <div className="flex items-center gap-2 mb-6">
                                <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-indigo-100">STUDENT: {studentName || 'UNKNOWN AGENT'}</span>
                              </div>
                              <p className="text-slate-500 text-2xl italic leading-relaxed">"{gradingResult.feedbackSummary}"</p>
                          </div>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-12 mb-20">
                          <div className="bg-green-50 p-12 rounded-[3.5rem] border-4 border-green-100 shadow-sm">
                              <h3 className="font-black text-green-700 mb-8 flex items-center gap-5 text-3xl"><CheckCircle size={40}/> Strategic Success</h3>
                              <ul className="space-y-6">
                                  {gradingResult.strengths.map((item, i) => <li key={i} className="flex gap-5 text-xl text-slate-700 font-medium"><div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center shrink-0 mt-1"><Check size={18} /></div>{item}</li>)}
                              </ul>
                          </div>
                          <div className="bg-red-50 p-12 rounded-[3.5rem] border-4 border-red-100 shadow-sm">
                              <h3 className="font-black text-red-700 mb-8 flex items-center gap-5 text-3xl"><AlertCircle size={40}/> Knowledge Gaps</h3>
                               <ul className="space-y-6">
                                  {gradingResult.weaknesses.length > 0 ? gradingResult.weaknesses.map((item, i) => <li key={i} className="flex gap-5 text-xl text-slate-700 font-medium"><div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center shrink-0 mt-1"><X size={18} /></div>{item}</li>) : <li className="text-green-700 font-black text-3xl text-center py-10">Flawless Service Design!</li>}
                              </ul>
                          </div>
                      </div>

                      <div className="mt-20 border-t-4 border-slate-50 pt-20">
                        <div className="flex items-center gap-4 mb-16">
                            <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center shadow-lg"><Database size={32} /></div>
                            <div className="flex-1">
                                <h3 className="text-5xl font-black text-slate-900 tracking-tighter">Architectural Blueprint</h3>
                                <div className="flex items-center gap-3 mt-2">
                                  <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">TECHNICAL BREAKDOWN OF SUBMITTED SERVICE MAP</p>
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                  <p className="text-indigo-600 font-black uppercase text-xs tracking-widest">COMPILED BY: {studentName || 'ANONYMOUS'}</p>
                                </div>
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
                                                    {col[layer as keyof BlueprintColumn] || <span className="text-slate-300 italic text-base">Unmapped territory.</span>}
                                                </div>
                                            </div>
                                        ))}

                                        <div className="grid md:grid-cols-2 gap-10 pt-10 border-t-2 border-slate-50">
                                            <div className="bg-red-50/50 p-8 rounded-3xl border-2 border-red-50">
                                                <div className="flex items-center gap-3 mb-6">
                                                    <AlertCircle size={24} className="text-red-500" />
                                                    <span className="text-xs font-black uppercase text-red-600 tracking-widest">Identified Friction</span>
                                                </div>
                                                <div className="space-y-3">
                                                    {col.painPoints.length > 0 ? col.painPoints.map((p, i) => (
                                                        <div key={i} className="bg-white px-5 py-3 rounded-2xl text-sm font-bold border border-red-100 text-red-700 shadow-sm flex gap-3"><span className="text-red-300">•</span> {p}</div>
                                                    )) : <div className="text-slate-400 text-sm italic py-2">Optimal path—no pain points detected.</div>}
                                                </div>
                                            </div>
                                            <div className="bg-emerald-50/50 p-8 rounded-3xl border-2 border-emerald-50">
                                                <div className="flex items-center gap-3 mb-6">
                                                    <Zap size={24} className="text-emerald-500" />
                                                    <span className="text-xs font-black uppercase text-emerald-600 tracking-widest">Growth Opportunities</span>
                                                </div>
                                                <div className="space-y-3">
                                                    {col.opportunities.length > 0 ? col.opportunities.map((o, i) => (
                                                        <div key={i} className="bg-white px-5 py-3 rounded-2xl text-sm font-bold border border-emerald-100 text-emerald-700 shadow-sm flex gap-3"><span className="text-red-300">•</span> {o}</div>
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
                      <button type="button" onClick={handleImproveWork} className="bg-indigo-600 text-white px-12 py-6 rounded-[2.5rem] font-black flex items-center gap-4 shadow-2xl hover:scale-110 active:scale-95 text-xl transition-transform"><Pencil size={28} /> Refine Project</button>
                      <button type="button" onClick={handleSaveToLibrary} className="bg-amber-600 text-white px-10 py-6 rounded-[2.5rem] font-black flex items-center gap-4 hover:bg-amber-500 active:scale-95 text-xl transition-all"><Bookmark size={28} /> Pin Highlight</button>
                      <button type="button" onClick={handleDownloadPDF} className="bg-slate-800 text-white px-10 py-6 rounded-[2.5rem] font-black flex items-center gap-4 hover:bg-slate-700 active:scale-95 text-xl transition-all"><Download size={28} /> Export PDF</button>
                      <button type="button" onClick={handleGoHome} className="bg-white text-indigo-600 px-10 py-6 rounded-[2.5rem] font-black flex items-center gap-4 hover:border-indigo-600 active:scale-95 text-xl relative z-10 transition-all"><LayoutGrid size={28} /> Mission Control</button>
                  </div>
              </div>
          </div>
        )}
      </main>

      {/* Custom Mission Modal */}
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
