'use client';

import { useRef, useState, useCallback, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
}

/**
 * ★ Pull-to-Refresh wrapper for mobile
 * Wraps content and shows a pull indicator when user drags down from the top.
 */
export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const THRESHOLD = 80; // px to trigger refresh

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling || refreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    if (diff > 0) {
      // Rubber-band effect: diminishing returns past threshold
      setPullDistance(Math.min(diff * 0.5, 120));
    }
  }, [pulling, refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return;
    setPulling(false);

    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPullDistance(0);
  }, [pulling, pullDistance, refreshing, onRefresh]);

  const isActive = pullDistance > 10 || refreshing;
  const indicatorScale = Math.min(pullDistance / THRESHOLD, 1);
  const shouldTrigger = pullDistance >= THRESHOLD;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull indicator */}
      {isActive && (
        <div
          className="flex items-center justify-center transition-all duration-200"
          style={{
            height: refreshing ? 48 : pullDistance,
            opacity: indicatorScale,
          }}
        >
          <div className={`flex items-center gap-2 text-xs font-medium
            ${shouldTrigger || refreshing ? 'text-primary-600 dark:text-primary-400' : 'text-surface-400'}`}>
            {refreshing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                กำลังรีเฟรช...
              </>
            ) : shouldTrigger ? (
              <>↓ ปล่อยเพื่อรีเฟรช</>
            ) : (
              <>↓ ดึงลงเพื่อรีเฟรช</>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {children}
    </div>
  );
}
