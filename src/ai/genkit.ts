
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
  // Custom model configurations are now handled directly in the prompt call
  // or by defining a custom model with a unique name if needed.
  // The 'models' array in this config is deprecated for this use case.
});
