import React from 'react';
import { ArrowRight, BookOpen, Check, X } from 'lucide-react';
import { TUTORIAL_STEPS } from '../constants';

interface TutorialOverlayProps {
  currentStep: number;
  onNext: () => void;
  onClose: () => void;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ currentStep, onNext, onClose }) => {
  const stepData = TUTORIAL_STEPS[currentStep];
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[60] w-full max-w-lg px-4">
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-indigo-600 p-6 relative animate-in slide-in-from-bottom-10 duration-500">
        
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gray-100 rounded-t-2xl overflow-hidden">
            <div 
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%` }}
            />
        </div>

        <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            title="Exit Tutorial"
        >
            <X size={20} />
        </button>

        <div className="flex items-start gap-4">
            <div className="bg-indigo-100 p-3 rounded-full text-indigo-600 shrink-0 mt-1">
                {isLastStep ? <Check size={24} /> : <BookOpen size={24} />}
            </div>
            
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Step {currentStep + 1}/{TUTORIAL_STEPS.length}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{stepData.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-6">
                    {stepData.content}
                </p>

                <div className="flex justify-end">
                    <button
                        onClick={isLastStep ? onClose : onNext}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95"
                    >
                        {isLastStep ? 'Finish Bootcamp' : 'Next Step'} <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;