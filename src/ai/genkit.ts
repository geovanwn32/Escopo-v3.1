
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import * as dotenv from 'dotenv';

dotenv.config();

export const googleAiPlugin = googleAI({
  apiVersion: 'v1beta',
});

export const ai = genkit({
  plugins: [
    googleAiPlugin,
  ],
  models: [
    googleAiPlugin.model('gemini-pro', {
      config: {
        temperature: 0.5,
      }
    }),
  ]
});
