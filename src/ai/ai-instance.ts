import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// gemini-2.0-flash has been retired; override with GEMINI_MODEL if Google retires this one too.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
      models: [GEMINI_MODEL],
    }),
  ],
  model: `googleai/${GEMINI_MODEL}`,
});
