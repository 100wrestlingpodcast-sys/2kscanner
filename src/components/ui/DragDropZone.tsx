'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon } from 'lucide-react';

interface DragDropZoneProps {
  onImageSelected: (file: File) => void;
  className?: string;
}

export function DragDropZone({ onImageSelected, className = '' }: DragDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        onImageSelected(file);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImageSelected(e.target.files[0]);
    }
  };

  return (
    <div
      className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-colors duration-300 cursor-pointer overflow-hidden
        ${isDragging ? 'border-bsn-neon bg-bsn-neon/10' : 'border-white/20 hover:border-white/50 bg-black/40 backdrop-blur-md'} ${className}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleChange}
      />
      
      <div className="flex flex-col items-center justify-center space-y-4 p-6 text-center">
        <div className={`p-4 rounded-full ${isDragging ? 'bg-bsn-neon text-black' : 'bg-white/10 text-gray-400'}`}>
          <UploadCloud className="w-8 h-8" />
        </div>
        <div>
          <p className="text-lg font-bold text-white uppercase tracking-wider">
            {isDragging ? 'Drop screenshot here' : 'Drag & Drop Screenshot'}
          </p>
          <p className="text-sm text-gray-400 mt-2">
            or click to browse from your device
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs text-gray-500 mt-4">
          <ImageIcon className="w-4 h-4" />
          <span>Supports PNG, JPG, JPEG</span>
        </div>
      </div>
    </div>
  );
}
