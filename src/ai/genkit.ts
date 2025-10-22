
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import * as dotenv from 'dotenv';

dotenv.config();

export const ai = genkit({
  plugins: [
    googleAI({
      apiVersion: 'v1beta',
      models: {
        'gemini-pro': {
          model: 'gemini-pro',
          config: {
            temperature: 0.5
          }
        }
      }
    }),
  ],
});
