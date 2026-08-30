import { useEffect, useRef, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { Belt } from '../../data/types';
import { HEALTH_STATUS_COLORS, HEALTH_STATUS_LABELS } from '../../data/beltStatus';
import { useOnlineStatus } from '../../../context/OfflineContext';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function makeMyLocationIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:18px;height:18px;">
        <div style="position:absolute;inset:-10px;border-radius:50%;background:#2563eb33;animation:pulse 2s ease-out infinite;"></div>
        <div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 1px 5px rgba(0,0,0,0.5);"></div>
      </div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

interface BeltMapComponentProps {
  belts: Belt[];
  onBeltClick?: (belt: Belt) => void;
}

const FALLBACK_CENTER: L.LatLngTuple = [-9.67346741500018, -36.74303453562654];

export function BeltMapComponent({ belts, onBeltClick }: BeltMapComponentProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const myLocationMarkerRef = useRef<L.Marker | null>(null);
  const beltsRef = useRef(belts);
  const onBeltClickRef = useRef(onBeltClick);
  const { location } = useOnlineStatus();

  useEffect(() => { beltsRef.current = belts; }, [belts]);
  useEffect(() => { onBeltClickRef.current = onBeltClick; }, [onBeltClick]);

  const renderLayers = useCallback((map: L.Map, belts: Belt[]) => {
    layersRef.current.forEach((l) => l.remove());
    layersRef.current = [];

    const validPoints: L.LatLngTuple[] = [];

    belts.forEach((belt) => {
      const color = HEALTH_STATUS_COLORS[belt.healthStatus] || '#6b7280';
      const path = (belt.path || []).filter(
        (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && !(p.lat === 0 && p.lng === 0)
      );

      if (path.length >= 2) {
        const latlngs: L.LatLngTuple[] = path.map((p) => [p.lat, p.lng]);
        const line = L.polyline(latlngs, { color, weight: 5, opacity: 0.85 });
        line.bindPopup(`
          <div style="font-family:sans-serif;min-width:150px;">
            <div style="font-weight:600;color:#193A2A;font-size:13px;margin-bottom:4px;">${belt.tag} — ${belt.name}</div>
            <div style="font-size:11px;color:#555;margin-bottom:6px;">${belt.area || '—'}</div>
            <div style="display:inline-block;font-size:10px;padding:2px 8px;border-radius:12px;background:${color};color:white;">
              ${HEALTH_STATUS_LABELS[belt.healthStatus]}
            </div>
          </div>
        `);
        line.on('click', () => onBeltClickRef.current?.(belt));
        line.addTo(map);
        layersRef.current.push(line);
        validPoints.push(...latlngs);
      }
    });

    if (validPoints.length > 0) {
      if (validPoints.length === 1) {
        map.setView(validPoints[0], 16);
      } else {
        map.fitBounds(L.latLngBounds(validPoints), { padding: [40, 40], maxZoom: 17 });
      }
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { center: FALLBACK_CENTER, zoom: 15, zoomControl: true });

    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics', maxZoom: 19 }
    );
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    });

    satelliteLayer.addTo(map);
    L.control.layers({ Satélite: satelliteLayer, Ruas: streetLayer }, undefined, { position: 'topright', collapsed: true }).addTo(map);

    mapRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
      renderLayers(map, beltsRef.current);
    }, 50);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    renderLayers(map, belts);
  }, [belts, renderLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !location) return;
    if (myLocationMarkerRef.current) {
      myLocationMarkerRef.current.setLatLng([location.latitude, location.longitude]);
    } else {
      myLocationMarkerRef.current = L.marker([location.latitude, location.longitude], {
        icon: makeMyLocationIcon(),
        zIndexOffset: 1000,
      })
        .bindTooltip('Você está aqui', { direction: 'right', offset: [10, 0] })
        .addTo(map);
    }
  }, [location]);

  const hasAnyCoords = belts.some((b) => (b.path || []).length >= 2);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden" />

      {!hasAnyCoords && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[999]">
          <div className="bg-white/95 backdrop-blur rounded-xl px-5 py-3 shadow-lg text-xs text-gray-500 text-center max-w-[220px]">
            Nenhuma correia com coordenadas cadastradas ainda. O traçado da planta aparece aqui assim que for cadastrado.
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 bg-white rounded-xl shadow-lg p-3 z-[1000]">
        <div className="text-xs font-medium mb-2" style={{ color: '#193A2A' }}>Saúde da Correia</div>
        <div className="space-y-1">
          {(Object.keys(HEALTH_STATUS_LABELS) as Array<keyof typeof HEALTH_STATUS_LABELS>).map((key) => (
            <div key={key} className="flex items-center gap-2">
              <div className="w-3 h-1.5 rounded-full" style={{ backgroundColor: HEALTH_STATUS_COLORS[key] }} />
              <span className="text-xs text-gray-600">{HEALTH_STATUS_LABELS[key]}</span>
            </div>
          ))}
        </div>
        {location && (
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#2563eb' }} />
            <span className="text-xs text-gray-600">Sua localização</span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
