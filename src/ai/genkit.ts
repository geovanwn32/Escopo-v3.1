
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import * as dotenv from 'dotenv';

dotenv.config();

export const ai = genkit({
  plugins: [googleAI({apiVersion: 'v1'})],
  model: 'googleai/gemini-pro',
});
