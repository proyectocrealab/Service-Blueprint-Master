import { GoogleGenAI, Type } from "@google/genai";
import { BlueprintColumn, GradingResult, Scenario } from "../types";

/**
 * Validates an API key by making a minimal test call to ensure it is active and has quota.
 */
export const validateKey = async (key: string): Promise<boolean> => {
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    // Minimal test call to verify key functionality
    await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'test',
      config: { maxOutputTokens: 2 }
    });
    return true;
  } catch (error) {
    console.error("API Key Validation Failed:", error);
    return false;
  }
};

// Helper to check if a column is functionally blank
export const isColumnBlank = (col: BlueprintColumn) => {
    return !col.physical.trim() && 
           !col.customer.trim() && 
           !col.frontstage.trim() && 
           !col.backstage.trim() && 
           !col.support.trim() && 
           col.painPoints.length === 0 && 
           col.opportunities.length === 0;
};

/**
 * Grading logic to evaluate the student's submission.
 * Each call creates a fresh AI instance to respect the latest user-provided API key.
 */
export const gradeBlueprint = async (
  blueprint: BlueprintColumn[],
  scenario: Scenario,
  previousResult?: GradingResult
): Promise<GradingResult> => {
  try {
    // Access the key through the process object which is shimmed in index.tsx
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API_KEY_MISSING");

    const ai = new GoogleGenAI({ apiKey });
    const filteredBlueprint = blueprint.filter(c => !isColumnBlank(c));

    let modeInstruction = "";
    if (previousResult && previousResult.weaknesses.length > 0) {
      modeInstruction = `
        REMEDIATION MODE (STRICT EVALUATION):
        The student is re-submitting based on specific feedback.
        Previous Score: ${previousResult.score}
        Items to Fix: ${JSON.stringify(previousResult.weaknesses)}

        STRICT FAIRNESS RULES:
        1. NO MOVING GOALPOSTS: Do not find new weaknesses. Only evaluate the existing list.
        2. CLEAR IMPROVEMENT: For each item in 'Items to Fix', if the student has reasonably addressed it, remove it from the new 'weaknesses' list.
        3. SCORE DELTA: Increase score proportionally to fixed items.
        4. CEILING: If ALL previous weaknesses are addressed, the score MUST be 100.
      `;
    } else {
      modeInstruction = `
        INITIAL GRADING MODE (RUBRIC-BASED):
        Standard: University Undergraduate Level
        Criteria:
        - Completeness (20%): All 5 layers used meaningfully?
        - Coherence (30%): Vertical alignment check (Does Backstage enable Frontstage?).
        - Context Realism (20%): Does it reflect the "${scenario.title}" context accurately?
        - Strategic Insight (30%): Precision of pain points and innovation of opportunities.

        FAIRNESS CONSTRAINTS:
        - Score < 40: Critical failures in logic.
        - Score 40-70: Functional but missing depth.
        - Score 70-90: High quality, minor gaps.
        - Score 90-100: Professional grade work.
      `;
    }

    const prompt = `
      Act as a standardized University Assessment System for Service Design.
      Scenario: ${scenario.title}
      Context: ${scenario.context}
      
      Student Submission:
      ${JSON.stringify(filteredBlueprint, null, 2)}
      
      ${modeInstruction}
      
      Response JSON structure:
      {
        "score": integer,
        "letterGrade": "A"|"B"|"C"|"D"|"F",
        "feedbackSummary": "Brief objective summary",
        "strengths": ["string", "string", "string"],
        "weaknesses": ["string", "based on rubric/mode rules"],
        "tips": ["actionable advice", "actionable advice", "actionable advice"]
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: prompt,
      config: {
        temperature: 0.0,
        seed: 42,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            letterGrade: { type: Type.STRING },
            feedbackSummary: { type: Type.STRING },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            tips: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['score', 'letterGrade', 'feedbackSummary', 'strengths', 'weaknesses', 'tips']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("EMPTY_RESPONSE");
    const result = JSON.parse(text) as GradingResult;
    return { ...result, isRemediation: !!previousResult };

  } catch (error: any) {
    console.error("Grading Error:", error);
    const msg = error?.message || "";
    
    // Explicit re-throwing for handled UI cases
    if (msg.includes('429') || msg.includes('quota')) throw new Error("QUOTA_EXHAUSTED");
    if (msg.includes('401') || msg.includes('403') || msg.includes('API key') || msg.includes('invalid')) throw new Error("INVALID_KEY");
    if (msg.includes('404') || msg.includes('not found') || msg.includes('Requested entity')) throw new Error("MODEL_NOT_FOUND");
    if (msg === "API_KEY_MISSING") throw new Error("API_KEY_MISSING");
    
    // Rethrow original error with context for the App component to handle
    throw error;
  }
};