"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { extractPatientDetails } from '@/ai/flows/extract-patient-details';
import { parseDMY } from '@/components/date-field';
import { useToast } from '@/hooks/use-toast';
import { isAadhaarCard, maskAadhaarNumber } from '@/lib/aadhaar';
import { getSignedImageUrl } from '@/lib/storage';

export interface ScannedDetails {
  firstName: string;
  lastName: string;
  address: string;
  idNumber: string;     // already masked for Aadhaar cards
  dateOfBirth: string;  // as read from the card (dd/MM/yyyy when it could be read)
}

// Extraction needs the image itself; images already saved are fetched back from storage.
async function toDataUrl(image: string): Promise<string> {
  if (image.startsWith('data:')) return image;
  const url = await getSignedImageUrl(image);
  if (!url) throw new Error('Could not load the saved ID image.');
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const SCAN_ERRORS: Record<NonNullable<Awaited<ReturnType<typeof extractPatientDetails>>['error']>, string> = {
  'no-key': 'The ID-card reader is not set up: the Super Admin needs to add the Google Gemini key (GOOGLE_GENAI_API_KEY) to this app\'s settings. Meanwhile, type the details in.',
  'bad-key': 'Google refused the ID-card reader\'s key. The Super Admin needs to check the Gemini key (GOOGLE_GENAI_API_KEY) in this app\'s settings.',
  'model': 'The ID-card reader\'s Gemini model is no longer available. The Super Admin needs to set GEMINI_MODEL to a current model.',
  'quota': 'The ID-card reader has used up its Google quota for now. Try again in a minute, or type the details in.',
  'unreadable': 'No details could be read from this picture. Take it again, flat and in good light with the whole card in view, and check the card type is right.',
  'failed': 'The ID-card reader could not process this picture. Try again, or type the details in.',
};

// Reads name, date of birth, address and ID number from the first ID card image (server
// action extractPatientDetails), and offers that image as a download afterwards (not for
// Aadhaar, whose copies must not be kept). Loaded with next/dynamic by the registration page.
export default function IdCardScan({ images, idCardType, firstName, onExtracted }: {
  images: string[];
  idCardType: string;
  firstName: string;
  onExtracted: (details: ScannedDetails) => void;
}) {
  const { toast } = useToast();
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);

  // New or removed images need a fresh scan.
  useEffect(() => setExtracted(false), [images]);

  const extract = async () => {
    setExtracting(true);
    try {
      toast({ title: 'Extracting details...', description: 'Please wait while we process the first image.' });
      const { identityData, error } = await extractPatientDetails({ imageBase64: await toDataUrl(images[0]), idCardType });
      if (!identityData) {
        toast({ title: 'Could not read the card', description: SCAN_ERRORS[error ?? 'failed'], variant: 'destructive' });
        setExtracted(false);
        return;
      }
      const [first = '', ...rest] = identityData.name.split(' ');
      const idNumber = identityData.idNumber || '';
      const dateOfBirth = identityData.dateOfBirth || '';
      onExtracted({
        firstName: first,
        lastName: rest.join(' '),
        address: identityData.address || '',
        idNumber: isAadhaarCard(idCardType) ? maskAadhaarNumber(idNumber) : idNumber,
        dateOfBirth,
      });
      if (dateOfBirth && !parseDMY(dateOfBirth)) {
        toast({ title: 'Check the date of birth', description: 'The date of birth read from the card is not a valid dd/mm/yyyy date. Please verify.' });
      }
      toast({ title: 'Details extracted', description: 'Review the details and save.' });
      setExtracted(true);
    } catch (error) {
      console.error('Error extracting details:', error);
      toast({ title: 'Error', description: 'Failed to extract details. Please try again.', variant: 'destructive' });
      setExtracted(false);
    } finally {
      setExtracting(false);
    }
  };

  const download = async () => {
    if (!firstName) {
      toast({ title: 'Missing name', description: 'Enter the first name before downloading the image.', variant: 'destructive' });
      return;
    }
    const src = images[0].startsWith('data:') ? images[0] : await getSignedImageUrl(images[0]);
    if (!src) return;
    const extension = src.startsWith('data:image/png') ? 'png' : 'jpg';
    const filename = `${firstName.replace(/ /g, '_')}_${idCardType.replace(/ /g, '_')}_${Date.now()}.${extension}`;
    const link = document.createElement('a');
    link.href = src;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast({ title: 'ID card image saved', description: `Downloaded as ${filename}` });
  };

  return (
    <>
      <Button type="button" onClick={extract} disabled={extracting} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
        Extract Details from First ID Image
      </Button>
      {extracted && !isAadhaarCard(idCardType) && (
        <Button type="button" variant="secondary" onClick={download} className="w-full">Download First ID Image</Button>
      )}
    </>
  );
}

