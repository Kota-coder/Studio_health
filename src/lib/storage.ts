// Patient images live in the private "patient-files" bucket. Tables store the
// object path; images are shown through short-lived signed URLs.

import { getSupabase } from '@/lib/supabase/client';
import { dataUrlToBlob } from '@/lib/images';

export const PATIENT_FILES_BUCKET = 'patient-files';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

// Uploads a (compressed) image data URL and returns its storage path.
// folder is e.g. "patients/12/care-notes".
export async function uploadImage(dataUrl: string, folder: string): Promise<string> {
  const blob = dataUrlToBlob(dataUrl);
  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${folder}/${crypto.randomUUID()}.${extension}`;
  const { error } = await getSupabase().storage
    .from(PATIENT_FILES_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  return path;
}

// Uploads when given a new data URL; passes stored paths through unchanged.
export async function uploadIfNew(value: string | null | undefined, folder: string): Promise<string | null> {
  if (!value) return null;
  return value.startsWith('data:') ? uploadImage(value, folder) : value;
}

export async function getSignedImageUrl(path: string): Promise<string | null> {
  const { data, error } = await getSupabase().storage
    .from(PATIENT_FILES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error('Could not sign image URL', error);
    return null;
  }
  return data.signedUrl;
}

export async function deleteImage(path: string): Promise<void> {
  const { error } = await getSupabase().storage.from(PATIENT_FILES_BUCKET).remove([path]);
  if (error) console.error('Could not delete image', error);
}

// Uploads the new (data URL) images in a list and returns the list as storage paths.
export async function uploadNewImages(values: string[] | null | undefined, folder: string): Promise<string[]> {
  if (!values?.length) return [];
  return Promise.all(values.map(value => uploadIfNew(value, folder) as Promise<string>));
}
