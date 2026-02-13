import React, { useState, useEffect, useRef } from 'react';
import { AppStage, BlueprintColumn, GradingResult, Scenario, SavedBlueprint } from './types';
import { SCENARIOS, EXAMPLE_BLUEPRINT, TUTORIAL_SCENARIO } from './constants';
import { gradeBlueprint, setGeminiApiKey, validateApiKey } from './services/geminiService';
import { getSavedBlueprints, saveBlueprint, deleteBlueprint } from './services/storageService';
import BlueprintBuilder from './components/BlueprintBuilder';
import MentorChat from './components/MentorChat';
import { BookOpen, Award, ArrowRight, RefreshCw, Star, CheckCircle, Map, Play, Clock, Trash2, Save, Download, LayoutTemplate, Key, Check, AlertCircle, Loader2, X, ExternalLink, Settings, Lock, GraduationCap, User, Users, PenTool, Upload, FileJson, Home } from 'lucide-react';
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

  // State for manual API key entry
  const [manualApiKey, setManualApiKey] = useState('');
  const [keyStatus, setKeyStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [showKeyModal, setShowKeyModal] = useState(false);
  
  // Custom Scenario Modal State
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customContext, setCustomContext] = useState('');
  
  // Tutorial State
  const [isTutorialMode, setIsTutorialMode] = useState(false);

  // File Input Ref for Import
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasEnvKey = !!process.env.API_KEY;

  const isAccessGranted = hasEnvKey || keyStatus === 'valid';

  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stage === AppStage.SCENARIO_SELECTION) {
      setSavedGames(getSavedBlueprints());
    }
  }, [stage]);

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const key = e.target.value;
    setManualApiKey(key);
    setKeyStatus('idle'); 
    setGeminiApiKey(key);
  };

  const handleVerifyKey = async () => {
    if (!manualApiKey.trim()) return;
    setKeyStatus('validating');
    const isValid = await validateApiKey(manualApiKey);
    if (isValid) {
      setKeyStatus('valid');
      setGeminiApiKey(manualApiKey);
    } else {
      setKeyStatus('invalid');
    }
  };

  const handleStartTraining = () => {
    if (!studentName.trim() || !teamNumber.trim()) {
        alert("Please enter your Student Name and Team Number to verify your identity.");
        return;
    }

    if (isAccessGranted) {
        setStage(AppStage.SCENARIO_SELECTION);
    } else {
        setShowKeyModal(true);
    }
  };

  const handleEnterMission = () => {
      setShowKeyModal(false);
      setStage(AppStage.SCENARIO_SELECTION);
  };

  const handleModalClose = () => {
    if (keyStatus !== 'valid') {
        setShowKeyModal(false);
    } else {
        handleEnterMission();
    }
  };

  const handleResetKey = () => {
      setKeyStatus('idle');
      setManualApiKey('');
  };

  const startScenario = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    setIsTutorialMode(false);
    setCurrentSaveId(undefined); // New game, no save ID yet
    
    // Initialize blueprint columns based on initial phases
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

  // Open the custom modal instead of using prompt()
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
    // Reset fields for next time
    setCustomTitle('');
    setCustomContext('');
    
    startScenario(customScenario);
  };

  const startTutorial = () => {
    const scenario = TUTORIAL_SCENARIO;
    setSelectedScenario(scenario);
    setIsTutorialMode(true);
    setCurrentSaveId(undefined);
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
    setCurrentSaveId(save.id); // Track the ID so we overwrite on save
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
      // If we have a currentSaveId, we are overwriting/updating
      // If not, we are creating new
      const savedGame = saveBlueprint(name, selectedScenario.id, blueprint, currentSaveId);
      setCurrentSaveId(savedGame.id); // Update local state to ensure subsequent saves overwrite this one
      alert("Blueprint saved successfully!");
    }
  };

  // --- Backup & Restore Logic ---

  const handleExportBackup = () => {
    if (!selectedScenario) return;

    const backupData = {
      version: 1,
      scenario: selectedScenario,
      blueprint: blueprint,
      timestamp: Date.now()
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `blueprint_backup_${selectedScenario.title.replace(/\s+/g, '_')}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
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
                    
                    // Simple validation
                    if (!parsedData.scenario || !parsedData.blueprint) {
                        throw new Error("Invalid file format");
                    }

                    if (stage === AppStage.SCENARIO_SELECTION) {
                        // If in dashboard, simple load
                        setSelectedScenario(parsedData.scenario);
                        setBlueprint(parsedData.blueprint);
                        setCurrentSaveId(undefined); // Treated as new/imported unless we saved it
                        setStage(AppStage.BLUEPRINT_BUILDER);
                    } else if (stage === AppStage.BLUEPRINT_BUILDER) {
                        // If in builder, ask to Merge or Replace
                        if (window.confirm("Do you want to APPEND this data to your current project? Click Cancel to REPLACE current project entirely.")) {
                            // Append Logic
                            const newCols = parsedData.blueprint.map((col: BlueprintColumn) => ({
                                ...col,
                                id: `imported-${col.id}-${Date.now()}` // Regenerate IDs to avoid conflicts
                            }));
                            setBlueprint(prev => [...prev, ...newCols]);
                        } else {
                            // Replace Logic
                            setSelectedScenario(parsedData.scenario);
                            setBlueprint(parsedData.blueprint);
                            setCurrentSaveId(undefined);
                        }
                    }
                }
            } catch (err) {
                console.error(err);
                alert("Failed to load file. Please check if it's a valid JSON backup.");
            }
            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
    }
  };

  const handleBackToDashboard = () => {
    if (window.confirm("Are you sure you want to exit? Unsaved changes may be lost.")) {
        setStage(AppStage.SCENARIO_SELECTION);
    }
  };

  // --- Grading & Submission ---

  const handleSubmission = async () => {
    if (!selectedScenario) return;
    setStage(AppStage.SUBMISSION);
    setIsGrading(true);
    
    const result = await gradeBlueprint(blueprint, selectedScenario);
    
    setGradingResult(result);
    setIsGrading(false);
    setStage(AppStage.RESULTS);
  };

  const handleDownloadPDF = async () => {
    if (!resultsRef.current) return;
    try {
      const element = resultsRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const ratio = pdfWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;
      
      let heightLeft = scaledHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledHeight);
        heightLeft -= pdfHeight;
      }
      
      pdf.save(`ServiceBlueprint_${studentName.replace(/\s+/g, '_')}_Team${teamNumber}_${selectedScenario?.title.replace(/\s+/g, '_') || 'Mission'}.pdf`);
    } catch (err) {
      console.error("PDF download failed", err);
      alert("Could not generate PDF. Please try again.");
    }
  };

  const resetApp = () => {
    setStage(AppStage.SCENARIO_SELECTION);
    setSelectedScenario(null);
    setBlueprint([]);
    setGradingResult(null);
    setShowKeyModal(false);
    setIsTutorialMode(false);
    setCurrentSaveId(undefined);
  };

  // --- Views ---

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

        {/* Inputs */}
        <div className="bg-gray-50 p-6 rounded-2xl mb-8 text-left border border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <User size={14}/> Cadet Identification
            </h3>
            <div className="space-y-4">
                <div className="relative">
                    <User className="absolute left-3 top-3.5 text-gray-400" size={18} />
                    <input
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="Student Name"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white"
                    />
                </div>
                <div className="relative">
                    <Users className="absolute left-3 top-3.5 text-gray-400" size={18} />
                    <input
                        type="text"
                        value={teamNumber}
                        onChange={(e) => setTeamNumber(e.target.value)}
                        placeholder="Team Number / Squad ID"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white"
                    />
                </div>
            </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col items-center gap-4">
            <button 
              onClick={handleStartTraining}
              className={`w-full text-lg font-bold px-10 py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3 ${
                isAccessGranted 
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                  : 'bg-slate-800 hover:bg-slate-900 text-slate-200'
              }`}
            >
              {isAccessGranted ? (
                <>Start Your Training <ArrowRight /></>
              ) : (
                <>Start Mission Setup <Lock size={18} className="text-slate-400" /></>
              )}
            </button>

            <button 
                onClick={() => setShowKeyModal(true)}
                className="flex items-center gap-2 text-gray-400 hover:text-indigo-600 text-sm font-medium transition-colors px-4 py-2 rounded-lg hover:bg-gray-50"
            >
                <Key size={16} /> 
                {isAccessGranted ? 'API Key Configured' : 'Configure API Key'}
            </button>
        </div>
      </div>

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative animate-in zoom-in-95 duration-200 overflow-hidden">
                <button onClick={handleModalClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10">
                    <X size={24} />
                </button>
                
                {keyStatus === 'valid' ? (
                    <div className="flex flex-col items-center justify-center py-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 shadow-inner animate-[bounce_1s_ease-in-out_1]">
                            <CheckCircle size={40} strokeWidth={3} />
                        </div>
                        <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Access Granted!</h2>
                        <p className="text-gray-500 text-center mb-6 px-4">
                            Your API key has been verified successfully. You are ready to begin your service design training.
                        </p>
                        
                        <button 
                            onClick={handleEnterMission}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-all transform hover:scale-[1.02] active:scale-95 mb-3"
                        >
                            Enter Mission Control <ArrowRight size={20} />
                        </button>

                        <button 
                            onClick={handleResetKey}
                            className="text-gray-400 hover:text-gray-600 text-sm underline"
                        >
                            Use a different key
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Key size={24} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">Identity Verification</h2>
                            <p className="text-gray-500 mt-2">Please provide your Gemini API Key to access the training simulation.</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <input 
                                    type="password"
                                    value={manualApiKey}
                                    onChange={handleKeyChange}
                                    placeholder="Paste API Key (starts with AIza...)"
                                    className={`w-full p-3 border rounded-xl focus:ring-2 outline-none transition-all ${
                                        keyStatus === 'invalid' ? 'border-red-300 focus:ring-red-200 bg-red-50' : 
                                        'border-gray-200 focus:ring-indigo-200 bg-gray-50'
                                    }`}
                                />
                                {keyStatus === 'invalid' && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12}/> Invalid API Key. Please try again.</p>}
                            </div>

                            <div className="flex flex-col gap-3">
                                <button 
                                    onClick={handleVerifyKey}
                                    disabled={!manualApiKey || keyStatus === 'validating'}
                                    className="w-full bg-gray-900 hover:bg-black text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {keyStatus === 'validating' ? <Loader2 className="animate-spin" size={20} /> : 'Verify Access Code'}
                                </button>
                                
                                <a 
                                    href="https://aistudio.google.com/app/apikey" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-indigo-200 group"
                                >
                                    Get Free API Key <ExternalLink size={16} className="group-hover:translate-x-0.5 transition-transform"/>
                                </a>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
      )}
    </div>
  );

  const renderScenarioSelection = () => (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">Select a Mission</h2>
                <p className="text-gray-500">Choose a scenario to demonstrate your service design skills.</p>
            </div>
            <div className="flex gap-3">
                <button
                    onClick={startTutorial}
                    className="bg-indigo-600 text-white hover:bg-indigo-700 px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 transform hover:scale-105 whitespace-nowrap"
                >
                    <GraduationCap size={20} />
                    Start Bootcamp
                </button>
                <button
                    onClick={handleLoadExample}
                    className="bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 shadow-sm whitespace-nowrap"
                >
                    <LayoutTemplate size={20} />
                    View Example Project
                </button>
            </div>
        </div>
        
        {/* Saved Games Library */}
        <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-700 flex items-center gap-2">
                    <Save size={20} className="text-indigo-600"/> Mission Library
                </h2>
                <button 
                    onClick={triggerImport}
                    className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                    <Upload size={16} /> Import from File
                </button>
            </div>
            
            {savedGames.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedGames.map(save => {
                    const scenario = SCENARIOS.find(s => s.id === save.scenarioId);
                    return (
                    <div key={save.id} onClick={() => resumeGame(save)} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all group">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-gray-800 truncate pr-2">{save.name}</h3>
                            <button onClick={(e) => handleDeleteSave(save.id, e)} className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50">
                            <Trash2 size={16} />
                            </button>
                        </div>
                        <p className="text-sm text-indigo-600 font-medium mb-3">{scenario?.title || save.name || 'Unknown Scenario'}</p>
                        <div className="flex items-center text-xs text-gray-500">
                            <Clock size={12} className="mr-1" />
                            Last modified: {new Date(save.lastModified).toLocaleDateString()}
                        </div>
                    </div>
                    );
                })}
                </div>
            ) : (
                <div className="bg-white p-8 rounded-xl border border-dashed border-gray-300 text-center text-gray-400">
                    <p>No saved missions found. Start a new mission or import a backup.</p>
                </div>
            )}
        </div>

        {/* New Scenarios */}
        <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
            <Play size={20} className="text-indigo-600"/> New Missions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12">
            {/* Custom Scenario Card */}
            <div 
                onClick={startCustomScenario}
                className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-sm hover:shadow-xl border border-gray-800 overflow-hidden transition-all duration-300 group cursor-pointer flex flex-col items-center justify-center p-8 text-center"
            >
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <PenTool className="text-white" size={32} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Design Your Own</h3>
                <p className="text-gray-400 mb-6">Create a custom service blueprint from scratch for any scenario you can imagine.</p>
                <button 
                  className="text-white bg-white/10 hover:bg-white/20 px-6 py-2 rounded-lg font-semibold transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    startCustomScenario();
                  }}
                >
                    Start Custom
                </button>
            </div>

            {/* Existing Scenarios */}
            {SCENARIOS.map((scenario) => (
                <div key={scenario.id} className="bg-white rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 overflow-hidden transition-all duration-300 group">
                <div className={`h-3 bg-gradient-to-r ${
                    scenario.difficulty === 'Beginner' ? 'from-green-400 to-green-600' :
                    scenario.difficulty === 'Intermediate' ? 'from-blue-400 to-blue-600' :
                    'from-red-400 to-red-600'
                }`} />
                <div className="p-8">
                    <div className="flex justify-between items-start mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        scenario.difficulty === 'Beginner' ? 'bg-green-100 text-green-700' :
                        scenario.difficulty === 'Intermediate' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                    }`}>
                        {scenario.difficulty}
                    </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-indigo-600 transition-colors">{scenario.title}</h3>
                    <p className="text-gray-600 mb-6 leading-relaxed">{scenario.description}</p>
                    
                    <div className="space-y-3 mb-8">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase">Key Phases</h4>
                        <div className="flex flex-wrap gap-2">
                            {scenario.initialPhases.slice(0, 3).map(p => (
                                <span key={p} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{p}</span>
                            ))}
                            {scenario.initialPhases.length > 3 && <span className="text-xs text-gray-400 px-1 py-1">+{scenario.initialPhases.length - 3} more</span>}
                        </div>
                    </div>

                    <button 
                    onClick={() => startScenario(scenario)}
                    className="w-full bg-gray-900 hover:bg-indigo-600 text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                    Start Mission <Play size={16} />
                    </button>
                </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="font-sans text-gray-900">
      {/* Hidden File Input for Imports */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImportFile} 
        className="hidden" 
        accept=".json"
      />

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
            onBack={handleBackToDashboard}
            onExport={handleExportBackup}
            onImport={triggerImport}
            currentSaveId={currentSaveId}
          />
          {!isTutorialMode && <MentorChat blueprint={blueprint} scenario={selectedScenario} />}
        </>
      )}
      
      {stage === AppStage.SUBMISSION && (
         <div className="min-h-screen bg-indigo-900 flex flex-col items-center justify-center p-6 text-white text-center">
            <div className="relative mb-8">
                <div className="w-24 h-24 border-4 border-indigo-400 border-t-white rounded-full animate-spin"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <Award size={32} />
                </div>
            </div>
            <h2 className="text-3xl font-bold mb-4">Analyzing Your Blueprint...</h2>
            <p className="text-indigo-200 text-lg max-w-md">
                Professor AI is reviewing your logical flow, layer depth, and identified opportunities.
            </p>
        </div>
      )}
      {stage === AppStage.RESULTS && gradingResult && (
        <div className="min-h-screen bg-gray-50 py-8 px-4 flex justify-center">
            <div ref={resultsRef} className="max-w-5xl w-full bg-white rounded-xl shadow-lg overflow-hidden flex flex-col">
                <div className="bg-white border-b border-gray-200 px-8 py-6 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{selectedScenario?.title}</h1>
                        <p className="text-gray-500 font-medium">Service Blueprint Report</p>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center justify-end gap-2 text-indigo-900 font-bold text-lg">
                            <User size={20} className="text-indigo-500" /> {studentName}
                        </div>
                        <div className="flex items-center justify-end gap-2 text-gray-600 font-medium">
                            <Users size={16} className="text-gray-400" /> Team {teamNumber}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{new Date().toLocaleDateString()}</p>
                    </div>
                </div>
                {/* Grading Result UI code simplified for brevity, assume same structure as previous */}
                <div className="p-8 bg-white border-b border-gray-200">
                    <h2 className="text-2xl font-bold mb-4">Grade: {gradingResult.letterGrade} ({gradingResult.score}%)</h2>
                    <p className="italic text-gray-600 mb-4">{gradingResult.feedbackSummary}</p>
                    
                    <div className="grid md:grid-cols-2 gap-8 mt-6">
                        <div>
                            <h3 className="font-bold text-green-700 mb-3 flex items-center gap-2"><CheckCircle size={18}/> Strengths</h3>
                            <ul className="space-y-2">
                                {gradingResult.strengths.map((item, i) => (
                                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                                        <span className="text-green-500">•</span> {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-bold text-red-600 mb-3 flex items-center gap-2"><AlertCircle size={18}/> Areas for Improvement</h3>
                             <ul className="space-y-2">
                                {gradingResult.weaknesses.map((item, i) => (
                                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                                        <span className="text-red-500">•</span> {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    
                    <div className="mt-8 bg-indigo-50 p-6 rounded-xl border border-indigo-100">
                         <h3 className="font-bold text-indigo-800 mb-3 flex items-center gap-2"><Star size={18}/> Professor's Tips</h3>
                         <ul className="space-y-2">
                                {gradingResult.tips.map((item, i) => (
                                    <li key={i} className="flex gap-2 text-sm text-indigo-900">
                                        <span className="text-indigo-500 font-bold">Tip {i+1}:</span> {item}
                                    </li>
                                ))}
                        </ul>
                    </div>

                </div>
                 <div className="p-6 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row gap-4 justify-center" data-html2canvas-ignore>
                    <button onClick={handleDownloadPDF} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex gap-2"><Download size={18} /> PDF</button>
                    <button onClick={resetApp} className="bg-white border-2 border-gray-200 hover:border-gray-800 text-gray-600 px-6 py-3 rounded-xl font-bold flex gap-2"><RefreshCw size={18} /> New Mission</button>
                </div>
            </div>
        </div>
      )}

      {/* Custom Scenario Creation Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 relative animate-in zoom-in-95 duration-200">
                 <button onClick={() => setShowCustomModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <X size={24} />
                </button>
                <div className="mb-6">
                    <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                        <PenTool size={24} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Design Your Own Mission</h2>
                    <p className="text-gray-500 mt-2">Define the scenario you want to map. The AI Mentor will use this context to guide you.</p>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Mission Title</label>
                        <input 
                            type="text" 
                            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900"
                            placeholder="e.g. Downtown Pizza Delivery"
                            value={customTitle}
                            onChange={(e) => setCustomTitle(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Context Description</label>
                        <textarea 
                            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none h-32 resize-none bg-white text-gray-900"
                            placeholder="e.g. A busy Friday night at a small pizza place with 2 drivers. Focus on the delivery process."
                            value={customContext}
                            onChange={(e) => setCustomContext(e.target.value)}
                        />
                    </div>
                    
                    <div className="pt-2">
                         <button 
                            onClick={handleCreateCustom}
                            disabled={!customTitle.trim() || !customContext.trim()}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                        >
                            Start Designing <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;