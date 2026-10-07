'use server';
/**
 * @fileOverview Extracts patient details from an image of an ID card using OCR.
 *
 * - extractPatientDetails - A function that extracts patient details from an image.
 * - ExtractPatientDetailsInput - The input type for the extractPatientDetails function.
 * - ExtractPatientDetailsOutput - The return type for the extractPatientDetails function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import {getCurrentStaff} from '@/lib/supabase/server';

const ExtractPatientDetailsInputSchema = z.object({
  imageBase64: z
    .string()
    .describe(
      'A base64 encoded image of an ID card. Must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.'
    ),
  idCardType: z.string().describe('The type of ID card (e.g., Aadhar Card, Driver\'s License, PAN Card).'),
});
export type ExtractPatientDetailsInput = z.infer<typeof ExtractPatientDetailsInputSchema>;

const ExtractPatientDetailsOutputSchema = z.object({
  identityData: z.object({
    name: z.string().describe('The full name of the patient.'),
    dateOfBirth: z.string().describe('The date of birth of the patient.'),
    address: z.string().describe('The address of the patient.'),
    idNumber: z.string().describe('The ID number of the patient.'),
  }).optional().describe('Extracted patient details, if available.')
});
export type ExtractPatientDetailsOutput = z.infer<typeof ExtractPatientDetailsOutputSchema>;

export async function extractPatientDetails(input: ExtractPatientDetailsInput): Promise<ExtractPatientDetailsOutput> {
  // Server actions are public endpoints; only signed-in staff may use the Gemini key.
  if (!(await getCurrentStaff())) {
    throw new Error('Not authorised');
  }
  return extractPatientDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractPatientDetailsPrompt',
  input: {
    schema: z.object({
      imageBase64: z
        .string()
        .describe(
          "A base64 encoded image of an ID card. Must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
        ),
      idCardType: z.string().describe('The type of ID card (e.g., Aadhar Card, Driver\'s License, PAN Card).'),
    }),
  },
  output: {
    schema: z.object({
      identityData: z.object({
        name: z.string().describe('The full name of the patient.'),
        dateOfBirth: z.string().describe('The date of birth of the patient. in dd/mm/yyyy format'),
        address: z.string().describe('The address of the patient.'),
        idNumber: z.string().describe('The ID number of the patient.'),
      }).optional().describe('Extracted patient details, if available.'),
    }),
  },
  prompt: `You are an expert OCR reader and data extraction specialist. Your job is to extract relevant information from the image of the provided ID card.
  The ID card is of type: {{idCardType}}.
  Please extract the following information:
  - The full name of the patient.
  - The date of birth of the patient in dd/mm/yyyy format.
  - The address of the patient.
  - The ID number of the patient.

  Here is the image of the ID card:
  {{media url=imageBase64}}

  If any of the information is not available in the image, leave that field blank. If the image does not contain an ID card, return empty fields.
  Ensure the output is formatted correctly and accurately reflects the information present in the image.`,
});

const extractPatientDetailsFlow = ai.defineFlow<
  typeof ExtractPatientDetailsInputSchema,
  typeof ExtractPatientDetailsOutputSchema
>(
  {
    name: 'extractPatientDetailsFlow',
    inputSchema: ExtractPatientDetailsInputSchema,
    outputSchema: ExtractPatientDetailsOutputSchema,
  },
  async input => {
    try {
      const {output} = await prompt(input);
      return { identityData: output?.identityData };
    } catch (error) {
      console.error('Error extracting identity data:', error);
      return { identityData: undefined };
    }
  }
);
