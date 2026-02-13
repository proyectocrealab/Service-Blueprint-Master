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

export interface GradingResult {
  score: number;
  letterGrade: string;
  feedbackSummary: string;
  strengths: string[];
  weaknesses: string[];
  tips: string[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
}

export interface SavedBlueprint {
  id: string;
  name: string;
  scenarioId: string;
  blueprint: BlueprintColumn[];
  lastModified: number;
}

export enum AppStage {
  ONBOARDING,
  SCENARIO_SELECTION,
  BLUEPRINT_BUILDER,
  ANALYSIS_MODE,
  SUBMISSION,
  RESULTS
}