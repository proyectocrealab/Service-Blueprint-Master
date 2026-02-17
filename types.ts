
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
  scenario: Scenario;
  blueprint: BlueprintColumn[];
  lastModified: number;
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

// Added ChatMessage interface to support MentorChat component
export interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
}

export enum AppStage {
  ONBOARDING,
  SCENARIO_SELECTION,
  BLUEPRINT_BUILDER,
  ANALYSIS_MODE,
  SUBMISSION,
  RESULTS
}
