
import { GoogleGenAI, Type } from "@google/genai";
import { BlueprintColumn, GradingResult, Scenario } from "../types";

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
    // Initializing Gemini client with named parameter apiKey as per guidelines.
    // Use process.env.API_KEY directly which is injected automatically.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

    // Using gemini-3-pro-preview for complex reasoning task (grading blueprints)
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
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
    if (!text) throw new Error("No response from AI");
    const result = JSON.parse(text) as GradingResult;
    return { ...result, isRemediation: !!previousResult };

  } catch (error: any) {
    console.error("Grading Error Detail:", error);
    // Specifically catch and re-throw quota errors for the UI to handle
    if (error?.message?.includes('429') || error?.message?.includes('quota')) {
      throw new Error("QUOTA_EXHAUSTED");
    }
    throw error;
  }
};

/**
 * Provides conversational advice to the student based on their current blueprint and chat history.
 * Each call creates a fresh AI instance to respect the latest user-provided API key.
 */
export const getMentorAdvice = async (
  history: { role: 'user' | 'model'; parts: { text: string }[] }[],
  blueprint: BlueprintColumn[],
  scenario: Scenario
): Promise<string> => {
  try {
    // Create fresh instance to use latest API key from env
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const filteredBlueprint = blueprint.filter(c => !isColumnBlank(c));

    const systemInstruction = `
      You are Professor AI, a world-class Service Design Mentor. 
      The student is working on a Service Blueprint for the scenario: "${scenario.title}".
      Context: ${scenario.context}
      
      Current Blueprint State (Non-blank phases):
      ${JSON.stringify(filteredBlueprint, null, 2)}
      
      Guidelines:
      1. Be encouraging but rigorous.
      2. Use Service Design terminology (Frontstage, Backstage, Support Processes, Physical Evidence).
      3. Help the student identify missing connections between layers.
      4. Provide specific examples relevant to "${scenario.title}".
      5. Keep responses concise and conversational.
    `;

    // Using gemini-3-flash-preview for quick conversational Q&A as per guidelines for Basic Text Tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: history,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    return response.text || "I'm sorry, I'm having trouble thinking right now. Could you rephrase your question?";
  } catch (error: any) {
    console.error("Mentor Service Error:", error);
    if (error?.message?.includes('429') || error?.message?.includes('quota')) {
      return "I'm a bit overwhelmed with students right now (Rate limit reached). Please wait a moment before asking again.";
    }
    return "I'm having a technical glitch. Please try again in a few seconds.";
  }
};
