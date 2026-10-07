
import { Client } from '@replit/object-storage';

const client = new Client();

export async function uploadAttachment(file: File, prefix: string): Promise<string> {
  const uniqueId = Math.random().toString(36).substring(2);
  const key = `${prefix}/${uniqueId}-${file.name}`;
  
  const buffer = await file.arrayBuffer();
  await client.upload(key, Buffer.from(buffer));
  
  return key;
}

export async function deleteAttachment(key: string): Promise<void> {
  await client.delete(key);
}

export function getAttachmentUrl(key: string): string {
  return client.getSignedUrl(key, 'read', 3600); // 1 hour expiry
}
