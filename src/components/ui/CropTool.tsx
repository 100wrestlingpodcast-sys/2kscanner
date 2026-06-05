'use client';

import React, { useState, useRef, useEffect } from 'react';
import { GlassCard } from './GlassCard';
import { NeonButton } from './NeonButton';
import { Crop, RefreshCw, ZoomIn, ZoomOut, Check, ArrowRight } from 'lucide-react';

interface CropToolProps {
  imageSrc: string;
  onCropCompleted: (croppedBase64: string) => void;
  onCancel: () => void;
  lang: 'es' | 'en';
}

export function CropTool({ imageSrc, onCropCompleted, onCancel, lang }: CropToolProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [cropArea, setCropArea] = useState({ x: 10, y: 25, width: 80, height: 50 }); // percentage based
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const isDraggingImg = useRef(false);
  const isResizingBox = useRef<string | null>(null); // 'tl', 'tr', 'bl', 'br', 'move'
  const dragStart = useRef({ x: 0, y: 0 });
  const initialPos = useRef({ x: 0, y: 0 });
  const initialCrop = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const t = {
    es: {
      title: "Recortar Marcador",
      instructions: "Arrastra las esquinas del recuadro para seleccionar ÚNICAMENTE la tabla de jugadores y estadísticas. Elimina el score final, logos y fondos para maximizar precisión.",
      zoom: "Zoom",
      confirm: "Confirmar Recorte",
      reset: "Restablecer",
      scan: "Escanear Estadísticas",
      cancel: "Cancelar"
    },
    en: {
      title: "Crop Scoreboard",
      instructions: "Drag the corners of the box to select ONLY the players and stats table. Eliminate final scores, logos, and backgrounds to maximize OCR precision.",
      zoom: "Zoom",
      confirm: "Confirm Crop",
      reset: "Reset Crop",
      scan: "Scan Stats",
      cancel: "Cancel"
    }
  };

  // Reset zoom and positions on image change
  useEffect(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setCropArea({ x: 10, y: 20, width: 80, height: 60 });
    setImageDimensions(null);

    const checkImage = () => {
      const img = imageRef.current;
      if (img) {
        if (img.complete && img.naturalWidth) {
          setImageDimensions({
            width: img.naturalWidth,
            height: img.naturalHeight
          });
        } else {
          img.onload = () => {
            setImageDimensions({
              width: img.naturalWidth,
              height: img.naturalHeight
            });
          };
        }
      }
    };

    const timer = setTimeout(checkImage, 50);
    return () => clearTimeout(timer);
  }, [imageSrc]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight
    });
  };

  const getImageDisplayDetails = () => {
    if (!containerRef.current) {
      return { renderedWidth: 0, renderedHeight: 0, offsetX: 0, offsetY: 0, naturalWidth: 0, naturalHeight: 0 };
    }

    const container = containerRef.current;
    const img = imageRef.current;
    
    // Resolve natural dimensions with fallback to ref to prevent cached-image null locks
    const naturalWidth = imageDimensions?.width || img?.naturalWidth || 0;
    const naturalHeight = imageDimensions?.height || img?.naturalHeight || 0;

    if (!naturalWidth || !naturalHeight) {
      return { renderedWidth: 0, renderedHeight: 0, offsetX: 0, offsetY: 0, naturalWidth: 0, naturalHeight: 0 };
    }

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const imageAspect = naturalWidth / naturalHeight;
    const containerAspect = containerWidth / containerHeight;

    let displayWidth = containerWidth;
    let displayHeight = containerHeight;

    if (imageAspect > containerAspect) {
      displayHeight = containerWidth / imageAspect;
    } else {
      displayWidth = containerHeight * imageAspect;
    }

    const renderedWidth = displayWidth * zoom;
    const renderedHeight = displayHeight * zoom;

    const offsetX = (containerWidth - renderedWidth) / 2 + position.x;
    const offsetY = (containerHeight - renderedHeight) / 2 + position.y;

    return {
      renderedWidth,
      renderedHeight,
      offsetX,
      offsetY,
      naturalWidth,
      naturalHeight
    };
  };

  // Handle Dragging of the background image
  const handleImageMouseDown = (e: React.MouseEvent) => {
    if (isResizingBox.current) return;
    isDraggingImg.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    initialPos.current = { ...position };
  };

  // Touch support for mobile dragging
  const handleImageTouchStart = (e: React.TouchEvent) => {
    if (isResizingBox.current) return;
    if (e.touches.length === 1) {
      isDraggingImg.current = true;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      initialPos.current = { ...position };
    }
  };

  // Handle Crop box drag and resize
  const handleCropBoxMouseDown = (handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isResizingBox.current = handle;
    dragStart.current = { x: e.clientX, y: e.clientY };
    initialCrop.current = { ...cropArea };
  };

  const handleCropBoxTouchStart = (handle: string, e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length === 1) {
      isResizingBox.current = handle;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      initialCrop.current = { ...cropArea };
    }
  };

  // Unified Move handler
  const handleMouseMove = (e: MouseEvent) => {
    handleMoveAction(e.clientX, e.clientY);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      handleMoveAction(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleMoveAction = (clientX: number, clientY: number) => {
    if (isDraggingImg.current) {
      const dx = clientX - dragStart.current.x;
      const dy = clientY - dragStart.current.y;
      setPosition({
        x: initialPos.current.x + dx,
        y: initialPos.current.y + dy
      });
    } else if (isResizingBox.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dxPercent = ((clientX - dragStart.current.x) / rect.width) * 100;
      const dyPercent = ((clientY - dragStart.current.y) / rect.height) * 100;
      const resizeType = isResizingBox.current;

      setCropArea(prev => {
        let newX = prev.x;
        let newY = prev.y;
        let newW = prev.width;
        let newH = prev.height;

        if (resizeType === 'move') {
          newX = Math.max(0, Math.min(100 - prev.width, initialCrop.current.x + dxPercent));
          newY = Math.max(0, Math.min(100 - prev.height, initialCrop.current.y + dyPercent));
        } else {
          // Corner resizing
          if (resizeType.includes('t')) {
            const bottom = prev.y + prev.height;
            newY = Math.max(0, Math.min(bottom - 10, initialCrop.current.y + dyPercent));
            newH = bottom - newY;
          }
          if (resizeType.includes('b')) {
            newH = Math.max(10, Math.min(100 - prev.y, initialCrop.current.height + dyPercent));
          }
          if (resizeType.includes('l')) {
            const right = prev.x + prev.width;
            newX = Math.max(0, Math.min(right - 10, initialCrop.current.x + dxPercent));
            newW = right - newX;
          }
          if (resizeType.includes('r')) {
            newW = Math.max(10, Math.min(100 - prev.x, initialCrop.current.width + dxPercent));
          }
        }

        return { x: newX, y: newY, width: newW, height: newH };
      });
    }
  };

  const handleMouseUp = () => {
    isDraggingImg.current = false;
    isResizingBox.current = null;
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [position, cropArea, zoom]);

  // Execute the Crop on Canvas and deliver Base64
  const handleScanStats = () => {
    if (!containerRef.current) return;

    const details = getImageDisplayDetails();
    if (details.renderedWidth === 0 || details.renderedHeight === 0) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get exact rendered dimensions of the container
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    // Crop coordinates relative to container (percentages mapped back to pixels)
    const cropXPixel = (cropArea.x / 100) * containerWidth;
    const cropYPixel = (cropArea.y / 100) * containerHeight;
    const cropWidthPixel = (cropArea.width / 100) * containerWidth;
    const cropHeightPixel = (cropArea.height / 100) * containerHeight;

    // Map crop box back to the natural unscaled image pixels and clamp boundaries
    const sourceX = Math.max(0, Math.min(details.naturalWidth, ((cropXPixel - details.offsetX) / details.renderedWidth) * details.naturalWidth));
    const sourceY = Math.max(0, Math.min(details.naturalHeight, ((cropYPixel - details.offsetY) / details.renderedHeight) * details.naturalHeight));
    const sourceWidth = Math.max(10, Math.min(details.naturalWidth - sourceX, (cropWidthPixel / details.renderedWidth) * details.naturalWidth));
    const sourceHeight = Math.max(10, Math.min(details.naturalHeight - sourceY, (cropHeightPixel / details.renderedHeight) * details.naturalHeight));

    // Set canvas dimensions directly to the original high-resolution natural crop size
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;

    // Implement processing filters to drastically increase OCR accuracy
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw the cropped portion to canvas
    if (imageRef.current) {
      ctx.drawImage(
        imageRef.current,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height
      );
    }

    // Export clean, un-filtered high-resolution canvas crop directly to preserve pixel fidelity and anti-aliasing
    // This allows modern Vision AI models to distinguish similar numbers (3 vs 8, etc.) perfectly.

    // Export base64 string
    const base64 = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
    onCropCompleted(base64);
  };

  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setCropArea({ x: 10, y: 20, width: 80, height: 60 });
  };

  const details = getImageDisplayDetails();

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black uppercase text-transparent bg-clip-text bg-gradient-to-r from-bsn-neon to-white flex items-center gap-2">
            <Crop className="w-5 h-5 text-bsn-neon" />
            {t[lang].title}
          </h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl font-medium leading-relaxed">
            {t[lang].instructions}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto bg-black/60 border border-white/10 rounded-xl p-1.5 shrink-0">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 px-2">{t[lang].zoom}:</span>
          <button 
            onClick={() => setZoom(z => Math.max(0.5, z - 0.15))}
            className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-bsn-neon w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button 
            onClick={() => setZoom(z => Math.min(3.0, z + 0.15))}
            className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editor Frame */}
      <div 
        ref={containerRef}
        className="relative w-full h-[450px] md:h-[520px] bg-[#030307] border border-white/10 rounded-2xl overflow-hidden select-none cursor-move"
        onMouseDown={handleImageMouseDown}
        onTouchStart={handleImageTouchStart}
      >
        {/* Render Image with absolute positioning & scale */}
        <img
          ref={imageRef}
          src={imageSrc}
          alt="Cropping View"
          onLoad={handleImageLoad}
          className="absolute max-w-none pointer-events-none object-contain transition-transform duration-75"
          style={{
            width: '100%',
            height: '100%',
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            transformOrigin: 'center center'
          }}
        />

        {/* Backdrop Shadow overlay (Outer bounds dark mask) */}
        <div className="absolute inset-0 bg-black/65 pointer-events-none" />

        {/* Exact active Crop Window (transparent middle) */}
        <div 
          className="absolute border-2 border-bsn-neon shadow-[0_0_20px_rgba(56,189,248,0.3)] bg-transparent"
          style={{
            left: `${cropArea.x}%`,
            top: `${cropArea.y}%`,
            width: `${cropArea.width}%`,
            height: `${cropArea.height}%`
          }}
          onMouseDown={(e) => handleCropBoxMouseDown('move', e)}
          onTouchStart={(e) => handleCropBoxTouchStart('move', e)}
        >
          {/* Internal visual guides (Canva / Camera style grid) */}
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30 pointer-events-none">
            <div className="border-r border-b border-white/50" />
            <div className="border-r border-b border-white/50" />
            <div className="border-b border-white/50" />
            <div className="border-r border-b border-white/50" />
            <div className="border-r border-b border-white/50" />
            <div className="border-b border-white/50" />
            <div className="border-r border-white/50" />
            <div className="border-r border-white/50" />
            <div />
          </div>

          {/* DRAGGABLE CORNERS */}
          {/* Top Left */}
          <div 
            className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-white border-2 border-bsn-neon rounded-full cursor-nwse-resize z-20"
            onMouseDown={(e) => handleCropBoxMouseDown('tl', e)}
            onTouchStart={(e) => handleCropBoxTouchStart('tl', e)}
          />
          {/* Top Right */}
          <div 
            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white border-2 border-bsn-neon rounded-full cursor-nesw-resize z-20"
            onMouseDown={(e) => handleCropBoxMouseDown('tr', e)}
            onTouchStart={(e) => handleCropBoxTouchStart('tr', e)}
          />
          {/* Bottom Left */}
          <div 
            className="absolute -bottom-1.5 -left-1.5 w-4 h-4 bg-white border-2 border-bsn-neon rounded-full cursor-nesw-resize z-20"
            onMouseDown={(e) => handleCropBoxMouseDown('bl', e)}
            onTouchStart={(e) => handleCropBoxTouchStart('bl', e)}
          />
          {/* Bottom Right */}
          <div 
            className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-white border-2 border-bsn-neon rounded-full cursor-nwse-resize z-20"
            onMouseDown={(e) => handleCropBoxMouseDown('br', e)}
            onTouchStart={(e) => handleCropBoxTouchStart('br', e)}
          />
        </div>

        {/* Clear Cutout in Overlay (Done via Clip Path hack for premium Google Photos look) */}
        <div 
          className="absolute inset-0 bg-transparent pointer-events-none"
          style={{
            backgroundImage: `url(${imageSrc})`,
            backgroundSize: `${details.renderedWidth}px ${details.renderedHeight}px`,
            backgroundPosition: `${details.offsetX}px ${details.offsetY}px`,
            clipPath: `polygon(
              0% 0%, 0% 100%, 
              ${cropArea.x}% 100%, 
              ${cropArea.x}% ${cropArea.y}%, 
              ${cropArea.x + cropArea.width}% ${cropArea.y}%, 
              ${cropArea.x + cropArea.width}% ${cropArea.y + cropArea.height}%, 
              ${cropArea.x}% ${cropArea.y + cropArea.height}%, 
              ${cropArea.x}% 100%, 
              100% 100%, 100% 0%
            )`
          }}
        />
      </div>

      {/* Control Buttons */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 pt-2">
        <button
          onClick={onCancel}
          className="px-6 py-3.5 border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white rounded-xl text-sm font-bold uppercase tracking-wider transition-colors w-full sm:w-auto"
        >
          {t[lang].cancel}
        </button>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-2 px-6 py-3.5 border border-white/10 hover:border-bsn-neon hover:bg-bsn-neon/5 text-gray-300 rounded-xl text-sm font-bold uppercase tracking-wider transition-colors w-full sm:w-auto"
          >
            <RefreshCw className="w-4 h-4 text-bsn-neon" />
            <span>{t[lang].reset}</span>
          </button>
          <NeonButton 
            onClick={handleScanStats} 
            className="flex items-center justify-center gap-2 text-sm font-black w-full sm:w-auto shadow-[0_0_20px_rgba(56,189,248,0.4)]"
          >
            <span>{t[lang].scan}</span>
            <ArrowRight className="w-4 h-4 text-white" />
          </NeonButton>
        </div>
      </div>
    </div>
  );
}
