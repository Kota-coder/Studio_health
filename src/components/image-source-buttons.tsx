"use client";

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Camera, Images } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/language-provider';
import { cn } from '@/lib/utils';

// The in-app camera is only downloaded when someone without a phone camera app uses it.
const CameraDialog = dynamic(() => import('@/components/camera-dialog').then(m => m.CameraDialog), { ssr: false });

// Phones and tablets: their own camera app (rear camera via capture="environment") is better
// for documents (focus, flash). Computers: the in-app camera.
const hasCameraApp = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

// "Take photo" (always the back camera) and "Choose from gallery" for ID cards, documents and
// patient photos. Hands the picked or taken images to onFiles.
export function ImageSourceButtons({ onFiles, multiple = true, galleryLabel, className }: {
  onFiles: (files: File[]) => void | Promise<void>;
  multiple?: boolean;
  galleryLabel?: string; // e.g. "Add more (2)"; defaults to "Choose from gallery"
  className?: string;
}) {
  const t = useT();
  const gallery = useRef<HTMLInputElement>(null);
  const cameraApp = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const handle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length) onFiles(files);
  };

  const takePhoto = () => {
    if (hasCameraApp()) cameraApp.current?.click();
    else setCameraOpen(true);
  };

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      <input ref={gallery} type="file" accept="image/*" multiple={multiple} className="hidden" onChange={handle} />
      <input ref={cameraApp} type="file" accept="image/*" capture="environment" className="hidden" onChange={handle} />
      <Button type="button" variant="outline" onClick={takePhoto} className="flex-1">
        <Camera className="mr-2 h-4 w-4" /> {t('Take photo')}
      </Button>
      <Button type="button" variant="outline" onClick={() => gallery.current?.click()} className="flex-1">
        <Images className="mr-2 h-4 w-4" /> {galleryLabel ?? t('Choose from gallery')}
      </Button>
      {cameraOpen && (
        <CameraDialog
          onClose={() => setCameraOpen(false)}
          onCapture={file => { setCameraOpen(false); onFiles([file]); }}
          onUnavailable={() => { setCameraOpen(false); gallery.current?.click(); }} />
      )}
    </div>
  );
}
