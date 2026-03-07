'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, X, Loader2, Search } from 'lucide-react';

interface MapPickerProps {
  latitude?: string;
  longitude?: string;
  onSelect: (lat: string, lng: string) => void;
}

declare global {
  interface Window {
    initMapPicker?: () => void;
    google?: {
      maps: typeof google.maps;
    };
  }
}

export default function MapPicker({ latitude, longitude, onSelect }: MapPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchText, setSearchText] = useState('');
  const mapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerInstance = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const autocompleteInstance = useRef<google.maps.places.Autocomplete | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Load Google Maps JavaScript API with Places library
  const loadGoogleMaps = useCallback(() => {
    if (window.google?.maps) {
      setIsLoaded(true);
      return;
    }

    if (!apiKey) {
      console.warn('[MapPicker] No API key');
      return;
    }

    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      window.initMapPicker = () => setIsLoaded(true);
      return;
    }

    window.initMapPicker = () => setIsLoaded(true);
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMapPicker&libraries=marker,places&language=th`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, [apiKey]);

  // Move marker + pan map to a location
  const moveToLocation = useCallback((lat: number, lng: number, zoomLevel?: number) => {
    const pos = { lat, lng };
    if (markerInstance.current) {
      markerInstance.current.position = pos;
    }
    if (mapInstance.current) {
      mapInstance.current.panTo(pos);
      if (zoomLevel) mapInstance.current.setZoom(zoomLevel);
    }
  }, []);

  // Initialize map when open + loaded
  useEffect(() => {
    if (!isOpen || !isLoaded || !mapRef.current) return;

    const defaultLat = latitude ? parseFloat(latitude) : 13.7563;
    const defaultLng = longitude ? parseFloat(longitude) : 100.5018;

    const map = new google.maps.Map(mapRef.current, {
      center: { lat: defaultLat, lng: defaultLng },
      zoom: 15,
      mapId: 'map-picker',
      gestureHandling: 'greedy',
      disableDefaultUI: true,
      zoomControl: true,
      fullscreenControl: true,
    });

    mapInstance.current = map;

    // Create marker
    const marker = new google.maps.marker.AdvancedMarkerElement({
      position: { lat: defaultLat, lng: defaultLng },
      map,
      gmpDraggable: true,
      title: 'ลากเพื่อเลือกตำแหน่ง',
    });

    markerInstance.current = marker;

    // Click on map to move marker
    map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        marker.position = e.latLng;
      }
    });

    // ★ Setup Places Autocomplete on the search input
    if (searchInputRef.current && google.maps.places) {
      const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
        componentRestrictions: { country: 'th' }, // จำกัดประเทศไทย
        fields: ['geometry', 'name', 'formatted_address'],
      });

      autocomplete.bindTo('bounds', map);

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          moveToLocation(lat, lng, 17);
          setSearchText(place.name || place.formatted_address || '');
        }
      });

      autocompleteInstance.current = autocomplete;
    }

    // Cleanup
    return () => {
      if (autocompleteInstance.current) {
        google.maps.event.clearInstanceListeners(autocompleteInstance.current);
        autocompleteInstance.current = null;
      }
    };
  }, [isOpen, isLoaded, latitude, longitude, moveToLocation]);

  const handleOpen = () => {
    if (!apiKey) {
      alert('ยังไม่ได้ตั้งค่า Google Maps API Key');
      return;
    }
    setIsOpen(true);
    setSearchText('');
    loadGoogleMaps();
  };

  const handleConfirm = () => {
    const pos = markerInstance.current?.position;
    if (pos) {
      const lat = typeof pos.lat === 'function' ? pos.lat() : (pos as google.maps.LatLngLiteral).lat;
      const lng = typeof pos.lng === 'function' ? pos.lng() : (pos as google.maps.LatLngLiteral).lng;
      onSelect(lat.toFixed(6), lng.toFixed(6));
    }
    setIsOpen(false);
  };

  return (
    <>
      {/* Open Map Button */}
      <button type="button" onClick={handleOpen}
        className="px-4 py-2.5 rounded-xl text-xs font-semibold
                   border-2 border-dashed border-primary-300 dark:border-primary-700
                   text-primary-600 dark:text-primary-400
                   hover:bg-primary-50 dark:hover:bg-primary-900/20
                   flex items-center gap-2 transition-all cursor-pointer w-full justify-center">
        <MapPin size={16} />
        📍 ปักหมุดบนแผนที่
      </button>

      {/* Map Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-surface-800 rounded-2xl overflow-hidden shadow-2xl w-full max-w-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-700">
              <h3 className="font-semibold text-surface-800 dark:text-white flex items-center gap-2">
                <MapPin size={18} className="text-primary-500" />
                ปักหมุดเลือกตำแหน่ง
              </h3>
              <button onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors cursor-pointer">
                <X size={18} className="text-surface-500" />
              </button>
            </div>

            {/* ★ Search Box */}
            <div className="px-4 py-2 border-b border-surface-200 dark:border-surface-700">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="ค้นหาสถานที่... เช่น สยามพารากอน, สุขุมวิท 21"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700
                             bg-white dark:bg-surface-900 text-surface-800 dark:text-white text-sm
                             placeholder:text-surface-400
                             focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                             transition-all"
                />
              </div>
            </div>

            {/* Map */}
            <div className="relative">
              {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface-100 dark:bg-surface-900 z-10">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={24} className="animate-spin text-primary-500" />
                    <p className="text-xs text-surface-500">กำลังโหลดแผนที่...</p>
                  </div>
                </div>
              )}
              <div ref={mapRef} className="w-full h-80" />
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-700 flex items-center justify-between">
              <p className="text-xs text-surface-500">
                🔍 ค้นหาหรือคลิก/ลากหมุด
              </p>
              <div className="flex gap-2">
                <button onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-surface-600 dark:text-surface-400
                             hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors cursor-pointer">
                  ยกเลิก
                </button>
                <button onClick={handleConfirm}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white
                             bg-gradient-to-r from-primary-600 to-primary-700
                             hover:from-primary-700 hover:to-primary-800
                             shadow-md transition-all cursor-pointer">
                  ✓ ยืนยันตำแหน่ง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
