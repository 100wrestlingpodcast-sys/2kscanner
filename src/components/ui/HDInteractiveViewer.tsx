'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw, X } from 'lucide-react';

interface HDInteractiveViewerProps {
  imageSrc: string;
  lang?: 'es' | 'en';
}

export function HDInteractiveViewer({ imageSrc, lang = 'es' }: HDInteractiveViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // States for fullscreen modal
  const [modalZoom, setModalZoom] = useState(1);
  const [modalOffset, setModalOffset] = useState({ x: 0, y: 0 });
  const [isModalDragging, setIsModalDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const modalImageRef = useRef<HTMLImageElement>(null);

  // Drag variables for reference (mouse & touch)
  const dragStart = useRef({ x: 0, y: 0 });
  const initialOffset = useRef({ x: 0, y: 0 });
  
  // Touch zoom variables
  const initialTouchDistance = useRef<number | null>(null);
  const initialTouchZoom = useRef<number>(1);

  const t = {
    es: {
      expand: "Expandir Imagen",
      zoomIn: "Zoom In",
      zoomOut: "Zoom Out",
      reset: "Restablecer",
      close: "Cerrar",
      instructions: "Usa la rueda del mouse, arrastra la imagen o pellizca (pinch) en celular para hacer zoom interactivo HD."
    },
    en: {
      expand: "Expand Imagen",
      zoomIn: "Zoom In",
      zoomOut: "Zoom Out",
      reset: "Reset Zoom",
      close: "Close",
      instructions: "Use mouse wheel, drag, or pinch zoom on mobile devices to interactively zoom in HD."
    }
  };

  // Reset offset and zoom on image change
  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [imageSrc]);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Math utility for touch distances
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // --- STANDARD VIEWER HANDLERS ---
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomIntensity = 0.12;
    const direction = e.deltaY < 0 ? 1 : -1;
    const nextZoom = Math.max(0.8, Math.min(4.5, zoom + direction * zoomIntensity));
    setZoom(nextZoom);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1 && e.button === 0) return; // Only drag when zoomed in
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    initialOffset.current = { ...offset };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    // Bound panning range based on zoom factor
    const bound = 300 * zoom;
    setOffset({
      x: Math.max(-bound, Math.min(bound, initialOffset.current.x + dx)),
      y: Math.max(-bound, Math.min(bound, initialOffset.current.y + dy))
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleDoubleSelect = () => {
    if (zoom > 1) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    } else {
      setZoom(2.2);
    }
  };

  // Mobile Touch handlers (Pinch to zoom & single finger pan)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Initiate pinch zoom
      const distance = getTouchDistance(e.touches);
      initialTouchDistance.current = distance;
      initialTouchZoom.current = zoom;
    } else if (e.touches.length === 1 && zoom > 1) {
      // Initiate single finger panning
      setIsDragging(true);
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      initialOffset.current = { ...offset };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialTouchDistance.current !== null) {
      // Handle pinch zoom
      const distance = getTouchDistance(e.touches);
      if (distance > 0) {
        const factor = distance / initialTouchDistance.current;
        const nextZoom = Math.max(0.8, Math.min(4.5, initialTouchZoom.current * factor));
        setZoom(nextZoom);
      }
    } else if (e.touches.length === 1 && isDragging) {
      // Handle panning
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      const bound = 300 * zoom;
      setOffset({
        x: Math.max(-bound, Math.min(bound, initialOffset.current.x + dx)),
        y: Math.max(-bound, Math.min(bound, initialOffset.current.y + dy))
      });
    }
  };

  const handleTouchEnd = () => {
    initialTouchDistance.current = null;
    setIsDragging(false);
  };

  // --- FULLSCREEN MODAL VIEWER HANDLERS ---
  const handleModalWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomIntensity = 0.15;
    const direction = e.deltaY < 0 ? 1 : -1;
    const nextZoom = Math.max(1.0, Math.min(5.5, modalZoom + direction * zoomIntensity));
    setModalZoom(nextZoom);
  };

  const handleModalMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsModalDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    initialOffset.current = { ...modalOffset };
  };

  const handleModalMouseMove = (e: React.MouseEvent) => {
    if (!isModalDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const bound = 600 * modalZoom;
    setModalOffset({
      x: Math.max(-bound, Math.min(bound, initialOffset.current.x + dx)),
      y: Math.max(-bound, Math.min(bound, initialOffset.current.y + dy))
    });
  };

  const handleModalDoubleSelect = () => {
    if (modalZoom > 1) {
      setModalZoom(1);
      setModalOffset({ x: 0, y: 0 });
    } else {
      setModalZoom(2.5);
    }
  };

  const handleModalTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = getTouchDistance(e.touches);
      initialTouchDistance.current = distance;
      initialTouchZoom.current = modalZoom;
    } else if (e.touches.length === 1) {
      setIsModalDragging(true);
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      initialOffset.current = { ...modalOffset };
    }
  };

  const handleModalTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialTouchDistance.current !== null) {
      const distance = getTouchDistance(e.touches);
      if (distance > 0) {
        const factor = distance / initialTouchDistance.current;
        const nextZoom = Math.max(1.0, Math.min(5.5, initialTouchZoom.current * factor));
        setModalZoom(nextZoom);
      }
    } else if (e.touches.length === 1 && isModalDragging) {
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      const bound = 600 * modalZoom;
      setModalOffset({
        x: Math.max(-bound, Math.min(bound, initialOffset.current.x + dx)),
        y: Math.max(-bound, Math.min(bound, initialOffset.current.y + dy))
      });
    }
  };

  const handleOpenFullscreen = () => {
    setModalZoom(zoom === 1 ? 1.2 : zoom);
    setModalOffset({ ...offset });
    setIsFullscreen(true);
  };

  const handleCloseFullscreen = () => {
    setIsFullscreen(false);
  };

  return (
    <div className="flex flex-col space-y-3 w-full">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 px-1">
        <span className="text-xs font-black uppercase tracking-widest text-bsn-neon flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-bsn-neon animate-pulse" />
          Previsualización HD Interactiva
        </span>
        <p className="text-[10px] text-neutral-400 font-medium">
          {t[lang].instructions}
        </p>
      </div>

      {/* Main Interactive Screen container */}
      <div 
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onDoubleClick={handleDoubleSelect}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative w-full h-[350px] md:h-[460px] bg-[#020205] border border-white/10 rounded-2xl overflow-hidden select-none cursor-grab active:cursor-grabbing group shadow-2xl flex items-center justify-center"
      >
        {/* Render Image at exact resolution, with CSS sharpness boosters */}
        <img
          ref={imageRef}
          src={imageSrc}
          alt="HD Scoreboard Preview"
          className="max-w-full max-h-full object-contain pointer-events-none transition-transform duration-75 ease-out select-none"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            // Advanced contrast & sharp anti-alias overrides
            imageRendering: 'crisp-edges',
            WebkitImageRendering: 'optimize-contrast'
          } as any}
        />

        {/* Ambient background glow behind image (glassmorphism dashboard pop) */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/40 via-transparent to-black/20" />

        {/* Float Controls Bar Overlay */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-xl flex items-center space-x-2 shadow-lg transition-opacity duration-300 opacity-90 group-hover:opacity-100 z-10">
          <button
            onClick={() => setZoom(z => Math.max(0.8, z - 0.25))}
            title={t[lang].zoomOut}
            className="p-1.5 hover:bg-white/10 text-neutral-300 hover:text-white rounded-lg transition-all"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          
          <span className="text-[11px] font-black text-bsn-neon w-12 text-center select-none tracking-wider">
            {Math.round(zoom * 100)}%
          </span>

          <button
            onClick={() => setZoom(z => Math.min(4.5, z + 0.25))}
            title={t[lang].zoomIn}
            className="p-1.5 hover:bg-white/10 text-neutral-300 hover:text-white rounded-lg transition-all"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-white/10 mx-1" />

          <button
            onClick={() => {
              setZoom(1);
              setOffset({ x: 0, y: 0 });
            }}
            title={t[lang].reset}
            className="p-1.5 hover:bg-white/10 text-neutral-300 hover:text-white rounded-lg transition-all flex items-center"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleOpenFullscreen}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-bsn-neon/15 hover:bg-bsn-neon/25 text-bsn-neon rounded-lg transition-all text-[10px] font-black uppercase tracking-wider"
          >
            <Maximize2 className="w-3 h-3 text-bsn-neon" />
            <span>{t[lang].expand}</span>
          </button>
        </div>
      </div>

      {/* FULLSCREEN IMMERSIVE PORTAL MODAL */}
      {isFullscreen && (
        <div 
          ref={modalContainerRef}
          onWheel={handleModalWheel}
          onMouseDown={handleModalMouseDown}
          onMouseMove={handleModalMouseMove}
          onMouseUp={() => setIsModalDragging(false)}
          onMouseLeave={() => setIsModalDragging(false)}
          onDoubleClick={handleModalDoubleSelect}
          onTouchStart={handleModalTouchStart}
          onTouchMove={handleModalTouchMove}
          onTouchEnd={() => setIsModalDragging(false)}
          className="fixed inset-0 z-50 bg-[#020204]/96 backdrop-blur-xl flex flex-col justify-center items-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
        >
          {/* HD Image in Modal (Supports extreme zoom scale) */}
          <img
            ref={modalImageRef}
            src={imageSrc}
            alt="HD Scoreboard Fullscreen"
            className="max-w-[95vw] max-h-[90vh] object-contain pointer-events-none transition-transform duration-75 ease-out select-none"
            style={{
              transform: `translate(${modalOffset.x}px, ${modalOffset.y}px) scale(${modalZoom})`,
              transformOrigin: 'center center',
              imageRendering: 'crisp-edges',
              WebkitImageRendering: 'optimize-contrast'
            } as any}
          />

          {/* HUD Top Bar controls */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-50 bg-black/60 border border-white/10 px-5 py-3 rounded-2xl backdrop-blur-md">
            <div className="flex flex-col">
              <span className="text-sm font-black text-bsn-neon uppercase tracking-widest">
                Visor de Scoreboard Ultra-HD
              </span>
              <span className="text-[10px] text-neutral-400 font-medium">
                Pellizca para zoom en móvil o usa la rueda del mouse. Doble clic para reiniciar.
              </span>
            </div>
            
            <div className="flex items-center space-x-3">
              <span className="text-xs font-black text-bsn-neon bg-bsn-neon/10 px-3 py-1 border border-bsn-neon/20 rounded-lg">
                Zoom: {Math.round(modalZoom * 100)}%
              </span>
              <button
                onClick={handleCloseFullscreen}
                className="p-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all border border-white/10 flex items-center justify-center cursor-pointer shadow-lg hover:scale-105 active:scale-95"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Bottom HUD controls in Fullscreen */}
          <div className="absolute bottom-6 bg-black/75 backdrop-blur-md border border-white/15 px-4 py-2 rounded-2xl flex items-center space-x-3 shadow-2xl z-50">
            <button
              onClick={() => setModalZoom(z => Math.max(1.0, z - 0.3))}
              className="p-2 hover:bg-white/10 text-neutral-300 hover:text-white rounded-xl transition-all"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => {
                setModalZoom(1);
                setModalOffset({ x: 0, y: 0 });
              }}
              className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t[lang].reset}</span>
            </button>

            <button
              onClick={() => setModalZoom(z => Math.min(5.5, z + 0.3))}
              className="p-2 hover:bg-white/10 text-neutral-300 hover:text-white rounded-xl transition-all"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
