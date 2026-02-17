
export type LayerType = 'physical' | 'customer' | 'frontstage' | 'backstage' | 'support';

export interface BlueprintColumn {
  id: string;
  phase: string;
  physical: string;
  customer: string;
  frontstage: string;
  backstage: string;
  support: string;
  painPoints: string[]; // List of pain points identified in this step
  opportunities: string[]; // List of opportunities identified in this step
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  initialPhases: string[];
  context: string; // Context for the AI to understand the scenario
}

export interface SavedBlueprint {
  id: string;
  name: string;
  studentName: string;
  scenario: Scenario;
  blueprint: BlueprintColumn[];
  lastModified: number;
  isLibrary?: boolean; // Flag to indicate if this mission is pinned to the library
  status?: 'draft' | 'completed';
  score?: number;
  completionRate?: number; // 0-100 percentage of non-empty cells
}

export interface GradingResult {
  score: number;
  letterGrade: string;
  feedbackSummary: string;
  strengths: string[];
  weaknesses: string[];
  tips: string[];
  isRemediation?: boolean;
}

export enum AppStage {
  ONBOARDING,
  SCENARIO_SELECTION,
  BLUEPRINT_BUILDER,
  ANALYSIS_MODE,
  SUBMISSION,
  RESULTS,
  PROJECT_ARCHIVE
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
}
