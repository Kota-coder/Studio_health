"use client";

import { Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StoredImage } from '@/components/stored-image';
import { useToast } from '@/hooks/use-toast';
import { compressImageFiles } from '@/lib/images';
import { cn } from '@/lib/utils';

// Images picked on the registration form (patient photos, ID card images). Values are data
// URLs for new images or storage paths for saved ones; they are uploaded when the patient is saved.
export function ImageAttachments({ images, onChange, addLabel, moreLabel, itemLabel, uploadedTitle, large }: {
  images: string[];
  onChange: (images: string[]) => void;
  addLabel: string;    // button text when there are no images yet
  moreLabel: string;   // button text when there are some, shown with the count
  itemLabel: string;   // "ID Card" -> alt text "ID Card 1"
  uploadedTitle: string;
  large?: boolean;     // two columns with a caption (ID cards) instead of small thumbnails
}) {
  const { toast } = useToast();

  const pick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (files.length === 0) return;
      onChange([...images, ...await compressImageFiles(files)]);
      toast({ title: uploadedTitle, description: `${files.length} image(s) added.` });
    };
    input.click();
  };

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" onClick={pick} className="w-full">
        <Paperclip className="mr-2 h-4 w-4" /> {images.length > 0 ? `${moreLabel} (${images.length})` : addLabel}
      </Button>
      {images.length > 0 && (
        <div className={cn('grid gap-2', large ? 'grid-cols-2' : 'grid-cols-3')}>
          {images.map((image, index) => (
            <div key={index} className={cn('relative rounded-md border', large ? 'p-2' : 'p-1')}>
              {large && <p className="mb-1 text-xs text-muted-foreground">{itemLabel} {index + 1}:</p>}
              <StoredImage path={image} alt={`${itemLabel} ${index + 1}`}
                className={cn('w-full rounded-md object-cover', large ? 'h-auto max-h-40' : 'h-20')} />
              <Button type="button" variant="destructive" size="icon" aria-label={`Remove ${itemLabel} ${index + 1}`}
                className="absolute -right-2 -top-2 h-6 w-6 rounded-full p-0"
                onClick={() => onChange(images.filter((_, i) => i !== index))}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
