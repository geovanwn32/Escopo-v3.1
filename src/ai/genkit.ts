
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import * as dotenv from 'dotenv';

dotenv.config();

export const ai = genkit({
  plugins: [
    googleAI({
      apiVersion: 'v1beta',
      model: 'gemini-pro', // O modelo é definido aqui
    }),
  ],
});
