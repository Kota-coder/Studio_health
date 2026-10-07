'use server';

/**
 * @fileOverview Service for extracting patient details from an image using OCR and AI.
 */

import {extractPatientDetails} from '@/ai/flows/extract-patient-details';

/**
 * Represents the extracted data from an identity card.
 */
export interface IdentityData {
  /**
   * The full name of the person.
   */
  name: string;
  /**
   * The date of birth of the person.
   */
  dateOfBirth: string;
  /**
   * The address of the person.
   */
  address: string;
}

/**
 * Asynchronously extracts identity data from an image using AI.
 *
 * @param imageBase64 The base64 encoded image data.
 * @param idCardType The type of ID card (e.g., Aadhar Card, Driver's License).
 * @returns A promise that resolves to an IdentityData object containing extracted information.
 */
export async function extractIdentityData(
  imageBase64: string,
  idCardType: string
): Promise<IdentityData | undefined> {
  try {
    const result = await extractPatientDetails({
      imageBase64: imageBase64,
      idCardType: idCardType,
    });
    return result.identityData;
  } catch (error) {
    console.error('Error extracting identity data:', error);
    return undefined;
  }
}
