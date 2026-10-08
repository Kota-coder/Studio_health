"use client";

import { useRef } from 'react';
import { UploadCloud, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { StoredImage } from '@/components/stored-image';
import { useToast } from '@/hooks/use-toast';
import { compressImageFiles } from '@/lib/images';

// Picks images (resized in the browser) to attach to a note, test or admission record.
// value holds data: URLs for new images and storage paths for saved ones.
export function AttachmentPicker({ id, label = 'Attachments (Optional, images are resized automatically)', value, onChange }: {
  id: string;
  label?: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);

  const addFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    const added = await compressImageFiles(files);
    onChange([...value, ...added]);
    if (added.length > 0) toast({ title: 'Attachments added', description: `${added.length} file(s) added.` });
  };

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-1 flex items-center gap-3">
        <input id={id} type="file" accept="image/*" multiple onChange={addFiles} ref={input} className="hidden" />
        <Button type="button" variant="outline" onClick={() => input.current?.click()} className="flex-1">
          <UploadCloud className="mr-2 h-4 w-4" /> {value.length > 0 ? `Add More (${value.length})` : 'Upload Files'}
        </Button>
        {value.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])} className="text-xs text-destructive">Clear All</Button>
        )}
      </div>
      {value.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {value.map((attachment, index) => (
            <div key={index} className="relative rounded-md border p-1">
              <StoredImage path={attachment} alt={`Attachment ${index + 1}`} className="h-20 w-full rounded-md object-cover" />
              <Button type="button" variant="destructive" size="icon" aria-label={`Remove attachment ${index + 1}`}
                className="absolute -right-2 -top-2 h-5 w-5 rounded-full" onClick={() => onChange(value.filter((_, i) => i !== index))}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Saved attachments shown as linked thumbnails.
export function AttachmentList({ paths, label = 'Attachments', size = 'max-h-32 max-w-[200px]' }: { paths?: string[]; label?: string; size?: string }) {
  if (!paths || paths.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-xs font-medium">{label}:</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {paths.map((path, index) => (
          <StoredImage key={path} path={path} linked alt={`${label} ${index + 1}`} className={`${size} rounded border object-cover`} />
        ))}
      </div>
    </div>
  );
}
