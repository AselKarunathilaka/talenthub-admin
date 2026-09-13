import { useState, useEffect } from "react";

export const useMapScale = (mapWidth, mapHeight, viewportRef, trigger) => {
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let observer;
    
    const updateScale = () => {
      if (!viewportRef.current) return;
      const rect = viewportRef.current.getBoundingClientRect();
      if (rect.width === 0) return;

      const isMobile = window.innerWidth < 768;
      let fitScale;

      if (isMobile) {
        // On mobile, scale so it fits nicely on the screen, but use window width to avoid feedback loops
        // The container uses overflow-x-auto so users can scroll horizontally. 
        // We scale it so the height fits roughly half the screen height
        fitScale = (window.innerHeight * 0.6 / mapHeight);
      } else {
        // Desktop: scale to fit width
        fitScale = (rect.width / mapWidth) * 0.98;
      }
      
      // Clamp scale
      fitScale = Math.min(Math.max(fitScale, 0.4), 1);

      setScale(prev => {
        // Only update if difference is significant to prevent infinite resize loops
        if (Math.abs(prev - fitScale) < 0.02) {
            setReady(true);
            return prev;
        }
        return fitScale;
      });
      setReady(true);
    };

    updateScale();
    
    if (viewportRef.current) {
      observer = new ResizeObserver(() => {
        requestAnimationFrame(updateScale);
      });
      observer.observe(viewportRef.current);
    }

    return () => {
      if (observer) observer.disconnect();
    };
  }, [mapWidth, mapHeight, viewportRef, trigger]);

  return { scale, ready };
};
