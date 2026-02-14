
import { GoogleGenAI, Type } from "@google/genai";

export interface TeamMember {
  name: string;
  group: string;
  skill: string;
}

export const generateTeamData = async (): Promise<TeamMember[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: "Generate 25 realistic Bangladeshi student organization member names (Bangla), their sub-team (upondal like 'Padma', 'Meghna', 'Jamuna'), and their specific role/skill (like 'Leader', 'Scribe', 'QM') in Bengali.",
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            group: { type: Type.STRING },
            skill: { type: Type.STRING }
          },
          required: ['name', 'group', 'skill']
        }
      }
    }
  });

  try {
    return JSON.parse(response.text.trim());
  } catch (e) {
    console.error("AI JSON Parse Error", e);
    return [];
  }
};
