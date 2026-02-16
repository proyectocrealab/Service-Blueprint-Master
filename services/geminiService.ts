
import { GoogleGenAI, Type } from "@google/genai";
import { BlueprintColumn, GradingResult, Scenario } from "../types";

// Helper to check if a column is functionally blank
const isColumnBlank = (col: BlueprintColumn) => {
    return !col.physical.trim() && 
           !col.customer.trim() && 
           !col.frontstage.trim() && 
           !col.backstage.trim() && 
           !col.support.trim() && 
           col.painPoints.length === 0 && 
           col.opportunities.length === 0;
};

// Removed dynamic API key setter as per guidelines requiring process.env.API_KEY usage only.

export const getMentorAdvice = async (
  history: { role: 'user' | 'model'; parts: { text: string }[] }[],
  currentBlueprint: BlueprintColumn[],
  scenario: Scenario
): Promise<string> => {
  try {
    // Initializing Gemini client with API_KEY from process.env as per guidelines.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Filter out blank columns for mentor context
    const filteredBlueprint = currentBlueprint.filter(c => !isColumnBlank(c));

    const systemInstruction = `
      You are an encouraging and expert Service Design Professor.
      The student is working on a Service Blueprint for the scenario: "${scenario.title}" - ${scenario.description}.
      Context: ${scenario.context}.
      
      Your goal is to guide them. Do NOT give them the direct answers for every cell.
      Instead, ask probing questions or give hints to help them uncover the answer.
      
      Current Blueprint State Summary:
      ${JSON.stringify(filteredBlueprint.map(c => ({ phase: c.phase, customer: c.customer, front: c.frontstage })))}

      Keep your responses concise (under 3 sentences usually) and friendly.
    `;

    const model = 'gemini-3-flash-preview';
    const response = await ai.models.generateContent({
      model,
      contents: history,
      config: {
        systemInstruction,
        temperature: 0.1, // Near deterministic for consistent advice
      },
    });

    // Accessing .text property directly as per guidelines.
    return response.text || "I'm having trouble thinking of advice right now. Try adding more details to your blueprint!";
  } catch (error) {
    console.error("Mentor Error:", error);
    return "Professor AI is currently offline. Please check your connection and configuration.";
  }
};

export const gradeBlueprint = async (
  blueprint: BlueprintColumn[],
  scenario: Scenario,
  previousResult?: GradingResult
): Promise<GradingResult> => {
  try {
    // Initializing Gemini client with API_KEY from process.env as per guidelines.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Filter out columns that are essentially blank placeholders at the end
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
      
      Generate a consistent, objective grade. Do not be overly generous or overly harsh. Be fair among different users.
      
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
        temperature: 0.0, // High determinism for fairness
        seed: 42, // Consistent results for same input
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

    // Accessing .text property directly as per guidelines.
    const text = response.text;
    if (!text) throw new Error("No response from AI");
    const result = JSON.parse(text) as GradingResult;
    return { ...result, isRemediation: !!previousResult };

  } catch (error) {
    console.error("Grading Error:", error);
    return {
      score: 0,
      letterGrade: 'N/A',
      feedbackSummary: "A system error occurred. Please verify your connection.",
      strengths: [],
      weaknesses: ["System Error: Grade could not be calculated"],
      tips: ["Ensure your environment is correctly configured."]
    };
  }
};
