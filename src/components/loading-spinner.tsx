
"use client"

import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8", 
    lg: "h-12 w-12"
  };

  useEffect(() => {
    // Add keyframes for smooth spinning only on client side
    if (typeof document !== 'undefined') {
      const existingStyle = document.getElementById('loading-spinner-styles');
      if (!existingStyle) {
        const style = document.createElement('style');
        style.id = 'loading-spinner-styles';
        style.textContent = `
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div 
        className={cn(
          "animate-spin rounded-full border-2 border-gray-300 border-t-blue-600",
          sizeClasses[size]
        )}
        style={{
          animation: "spin 1s linear infinite"
        }}
      />
    </div>
  );
}
