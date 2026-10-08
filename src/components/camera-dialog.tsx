"use client";

import { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useT } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';

// In-app camera for computers (phones use their own camera app). Asks for the back camera;
// a laptop's only webcam is used when there is no back camera. Nothing is kept until "Use photo".
export function CameraDialog({ onCapture, onClose, onUnavailable }: {
  onCapture: (file: File) => void;
  onClose: () => void;
  onUnavailable: () => void; // no camera or permission refused: fall back to choosing a file
}) {
  const t = useT();
  const { toast } = useToast();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [shot, setShot] = useState<{ url: string; blob: Blob } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({ title: 'No camera available', description: 'Choose a picture from the device instead.' });
      onUnavailable();
      return;
    }
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    }).then(media => {
      if (cancelled) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      if (video.current) { video.current.srcObject = media; video.current.play().catch(() => undefined); }
    }).catch(() => {
      if (cancelled) return;
      toast({ title: 'Camera not available', description: 'Allow camera access in the browser, or choose a picture instead.' });
      onUnavailable();
    });
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach(track => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start the camera once
  }, []);

  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    canvas.toBlob(blob => { if (blob) setShot({ url: URL.createObjectURL(blob), blob }); }, 'image/jpeg', 0.92);
  };

  const use = () => {
    if (!shot) return;
    onCapture(new File([shot.blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('Take photo')}</DialogTitle>
          <DialogDescription>Hold the card or document flat and fill the frame, then press Capture.</DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-md bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the photo just taken */}
          {shot && <img src={shot.url} alt="Photo taken" className="max-h-[60vh] w-full object-contain" />}
          <video ref={video} playsInline muted onLoadedData={() => setReady(true)}
            className={shot ? 'hidden' : 'max-h-[60vh] w-full object-contain'} />
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose}>{t('Cancel')}</Button>
          {shot ? (
            <>
              <Button type="button" variant="outline" onClick={() => setShot(null)}><RotateCcw className="mr-2 h-4 w-4" /> {t('Retake')}</Button>
              <Button type="button" onClick={use}>{t('Use photo')}</Button>
            </>
          ) : (
            <Button type="button" onClick={capture} disabled={!ready}><Camera className="mr-2 h-4 w-4" /> {t('Capture')}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
