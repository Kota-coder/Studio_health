"use client";

import { useEffect, useState } from 'react';
import { getSignedImageUrl } from '@/lib/storage';

interface StoredImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  // A storage path, or a data: URL for an image that hasn't been uploaded yet.
  path: string;
  // Wrap the image in a link that opens the full image in a new tab.
  linked?: boolean;
  linkClassName?: string;
}

export function useSignedImageUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
    } else if (path.startsWith('data:')) {
      setUrl(path);
    } else {
      getSignedImageUrl(path).then(signed => { if (!cancelled) setUrl(signed); });
    }
    return () => { cancelled = true; };
  }, [path]);
  return url;
}

export function StoredImage({ path, linked, linkClassName, alt, ...imgProps }: StoredImageProps) {
  const url = useSignedImageUrl(path);
  if (!url) return <span className="text-xs text-muted-foreground">Loading image…</span>;
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src={url} alt={alt} {...imgProps} />;
  return linked ? <a href={url} target="_blank" rel="noopener noreferrer" className={linkClassName}>{img}</a> : img;
}
