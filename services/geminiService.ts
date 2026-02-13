import { GoogleGenAI, Type } from "@google/genai";
import { BlueprintColumn, GradingResult, Scenario } from "../types";

let userApiKey = process.env.API_KEY || '';

export const setGeminiApiKey = (key: string) => {
  userApiKey = key;
};

// Helper to get AI instance using the dynamic variable
const getAI = () => {
  if (!userApiKey) {
    throw new Error("API Key is missing. Please provide a valid Gemini API Key.");
  }
  return new GoogleGenAI({ apiKey: userApiKey });
};

export const validateApiKey = async (key: string): Promise<boolean> => {
  if (!key) return false;
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    // Minimal request to check validity (Ping)
    await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'Ping',
    });
    return true;
  } catch (error) {
    console.error("API Key Validation Error:", error);
    return false;
  }
};

export const getMentorAdvice = async (
  history: { role: 'user' | 'model'; parts: [{ text: string }] }[],
  currentBlueprint: BlueprintColumn[],
  scenario: Scenario
): Promise<string> => {
  try {
    const ai = getAI();
    const systemInstruction = `
      You are an encouraging and expert Service Design Professor.
      The student is working on a Service Blueprint for the scenario: "${scenario.title}" - ${scenario.description}.
      Context: ${scenario.context}.
      
      Your goal is to guide them. Do NOT give them the direct answers for every cell.
      Instead, ask probing questions or give hints to help them uncover the answer.
      
      Current Blueprint State Summary:
      ${JSON.stringify(currentBlueprint.map(c => ({ phase: c.phase, customer: c.customer, front: c.frontstage })))}

      Keep your responses concise (under 3 sentences usually) and friendly.
    `;

    const model = 'gemini-3-flash-preview';
    const chat = ai.chats.create({
      model,
      config: {
        systemInstruction,
      },
      history: history,
    });

    const lastMsg = history[history.length - 1];
    const userMsg = lastMsg.role === 'user' ? lastMsg.parts[0].text : "Please help me.";

    const result = await chat.sendMessage({ message: userMsg });
    return result.text || "I'm having trouble thinking of advice right now. Try adding more details to your blueprint!";
  } catch (error) {
    console.error("Mentor Error:", error);
    return "Professor AI is currently offline. Please check your API Key and connection.";
  }
};

export const gradeBlueprint = async (
  blueprint: BlueprintColumn[],
  scenario: Scenario
): Promise<GradingResult> => {
  try {
    const ai = getAI();
    const prompt = `
      Act as a strict but fair University Professor grading a Service Blueprint assignment.
      
      Scenario: ${scenario.title}
      Context: ${scenario.context}
      
      Student's Submission (JSON):
      ${JSON.stringify(blueprint, null, 2)}
      
      Evaluate the blueprint based on:
      1. Completeness: Are all layers (Physical, Customer, Frontstage, Backstage, Support) filled reasonably?
      2. Logic: Do the steps flow logically in time? Do frontstage actions match customer actions?
      3. Depth: Did they identify meaningful Pain Points and Opportunities? (Look at painPoints and opportunities arrays in the JSON).
      4. Correctness: Are "Backstage" items truly invisible? Are "Support" items systems/processes?
      
      Return a JSON object with this schema:
      {
        "score": number (0-100),
        "letterGrade": string (A, B, C, D, F),
        "feedbackSummary": string (2-3 sentences),
        "strengths": string[] (3 bullet points),
        "weaknesses": string[] (3 bullet points),
        "tips": string[] (3 actionable tips for next time)
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
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
    return JSON.parse(text) as GradingResult;

  } catch (error) {
    console.error("Grading Error:", error);
    return {
      score: 0,
      letterGrade: 'N/A',
      feedbackSummary: "An error occurred while grading. Please check your API Key.",
      strengths: [],
      weaknesses: [],
      tips: []
    };
  }
};