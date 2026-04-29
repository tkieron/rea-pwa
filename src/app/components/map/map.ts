import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import * as L from 'leaflet';

export interface MapRoutePoint {
  lat: number;
  lng: number;
  course?: number | null;
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [],
  templateUrl: './map.html',
  styleUrl: './map.scss',
})
export class Map implements AfterViewInit, OnChanges, OnDestroy {
  @Input() latitude: number | null = null;
  @Input() longitude: number | null = null;
  @Input() petName = 'Pet';
  @Input() live = false;
  @Input() disabled = false;
  @Input() routePoints: MapRoutePoint[] = [];
  @Output() zoomChanged = new EventEmitter<number>();
  @Output() markerClicked = new EventEmitter<void>();

  @ViewChild('mapHost', { static: true }) private mapHostRef!: ElementRef<HTMLDivElement>;

  private mapInstance: L.Map | null = null;
  private tileLayer: L.TileLayer | null = null;
  private petMarker: L.Marker | null = null;
  private positionPulse: L.CircleMarker | null = null;
  private routeLine: L.Polyline | null = null;
  private routeStartMarker: L.CircleMarker | null = null;
  private routeEndMarker: L.CircleMarker | null = null;
  private routeDirectionMarkers: L.Marker[] = [];
  private readonly defaultCenter: L.LatLngExpression = [52.2297, 21.0122];
  private readonly defaultZoom = 12;
  private readonly trackedZoom = 17;
  private readonly minZoom = 3;
  private readonly maxZoom = 19;
  private lastPositionKey: string | null = null;
  private readonly handleMarkerClick = () => this.markerClicked.emit();
  private readonly handleZoomEnd = () => this.emitZoomChanged();

  ngAfterViewInit(): void {
    this.initializeMap();
    this.syncPosition(true);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.mapInstance) {
      return;
    }

    if (
      changes['latitude'] ||
      changes['longitude'] ||
      changes['petName'] ||
      changes['live'] ||
      changes['disabled'] ||
      changes['routePoints']
    ) {
      this.syncPosition(false);
      this.syncRoute();
    }
  }

  ngOnDestroy(): void {
    if (this.mapInstance) {
      this.mapInstance.off('zoomend', this.handleZoomEnd);
    }
    this.mapInstance?.remove();
    this.mapInstance = null;
    this.tileLayer = null;
    this.petMarker = null;
    this.positionPulse = null;
    this.routeLine = null;
    this.routeStartMarker = null;
    this.routeEndMarker = null;
    this.routeDirectionMarkers = [];
  }

  zoomIn(): void {
    this.mapInstance?.zoomIn();
  }

  zoomOut(): void {
    this.mapInstance?.zoomOut();
  }

  recenterToTrackedPosition(): void {
    const map = this.mapInstance;
    if (!map) {
      return;
    }

    if (this.latitude != null && this.longitude != null) {
      map.setView([this.latitude, this.longitude], Math.max(map.getZoom(), this.trackedZoom), {
        animate: true,
      });
      return;
    }

    map.setView(this.defaultCenter, this.defaultZoom, { animate: true });
  }

  setZoomLevel(zoom: number): void {
    const map = this.mapInstance;
    if (!map || !Number.isFinite(zoom)) {
      return;
    }

    const nextZoom = Math.max(this.minZoom, Math.min(this.maxZoom, Math.round(zoom)));
    map.setZoom(nextZoom, { animate: false });
  }

  private initializeMap(): void {
    const map = L.map(this.mapHostRef.nativeElement, {
      zoomControl: false,
      attributionControl: false,
      dragging: !this.disabled,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
      scrollWheelZoom: true,
      touchZoom: true,
      doubleClickZoom: true,
      boxZoom: false,
      keyboard: false,
      tapHold: false,
    }).setView(this.defaultCenter, this.defaultZoom);

    this.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: this.maxZoom,
      minZoom: this.minZoom,
      crossOrigin: true,
    }).addTo(map);
    map.on('zoomend', this.handleZoomEnd);

    this.mapInstance = map;
    this.emitZoomChanged();
    this.syncRoute();
  }

  private syncPosition(forceRecenter: boolean): void {
    const map = this.mapInstance;
    if (!map) {
      return;
    }

    map.dragging[this.disabled ? 'disable' : 'enable']();

    if (this.latitude == null || this.longitude == null) {
      this.clearTrackedLayers();
      if (forceRecenter) {
        map.setView(this.defaultCenter, this.defaultZoom, { animate: false });
      }
      this.lastPositionKey = null;
      return;
    }

    const latLng = L.latLng(this.latitude, this.longitude);
    if (!Number.isFinite(latLng.lat) || !Number.isFinite(latLng.lng)) {
      return;
    }

    if (!this.positionPulse) {
      this.positionPulse = L.circleMarker(latLng, {
        radius: 22,
        color: 'rgba(19,236,19,0.18)',
        fillColor: 'rgba(19,236,19,0.18)',
        fillOpacity: 0.6,
        weight: 0,
        interactive: false,
      }).addTo(map);
    } else {
      this.positionPulse.setLatLng(latLng);
    }

    if (!this.petMarker) {
      this.petMarker = L.marker(latLng, {
        icon: this.createPetIcon(),
        keyboard: false,
      }).addTo(map);
      this.petMarker.on('click', this.handleMarkerClick);
    } else {
      this.petMarker.setLatLng(latLng);
      this.petMarker.setIcon(this.createPetIcon());
    }

    this.petMarker.bindTooltip(this.petName || 'Pet', {
      direction: 'top',
      offset: [0, -18],
      opacity: 0.95,
    });

    const positionKey = `${latLng.lat.toFixed(6)}:${latLng.lng.toFixed(6)}`;
    const shouldRecenter = forceRecenter || this.lastPositionKey !== positionKey;
    if (shouldRecenter) {
      map.setView(latLng, this.trackedZoom, { animate: true });
      this.lastPositionKey = positionKey;
    }
  }

  private clearTrackedLayers(): void {
    if (this.petMarker) {
      this.petMarker.remove();
      this.petMarker = null;
    }

    if (this.positionPulse) {
      this.positionPulse.remove();
      this.positionPulse = null;
    }
  }

  private syncRoute(): void {
    const map = this.mapInstance;
    if (!map) {
      return;
    }

    const latLngs = this.routePoints
      .map((point) => L.latLng(point.lat, point.lng))
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));

    if (latLngs.length < 2) {
      this.clearRouteLayers();
      return;
    }

    if (!this.routeLine) {
      this.routeLine = L.polyline(latLngs, {
        color: '#13ec13',
        opacity: 0.88,
        weight: 5,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
    } else {
      this.routeLine.setLatLngs(latLngs);
    }

    const start = latLngs[0];
    const end = latLngs[latLngs.length - 1];
    if (!this.routeStartMarker) {
      this.routeStartMarker = L.circleMarker(start, {
        radius: 6,
        color: '#0f1710',
        fillColor: '#a2b2a2',
        fillOpacity: 1,
        weight: 2,
      }).addTo(map);
    } else {
      this.routeStartMarker.setLatLng(start);
    }

    if (!this.routeEndMarker) {
      this.routeEndMarker = L.circleMarker(end, {
        radius: 7,
        color: '#0f1710',
        fillColor: '#13ec13',
        fillOpacity: 1,
        weight: 2,
      }).addTo(map);
    } else {
      this.routeEndMarker.setLatLng(end);
    }

    this.syncRouteDirectionMarkers();

    map.fitBounds(L.latLngBounds(latLngs), {
      animate: true,
      padding: [40, 120],
      maxZoom: this.trackedZoom,
    });
  }

  private clearRouteLayers(): void {
    this.routeLine?.remove();
    this.routeStartMarker?.remove();
    this.routeEndMarker?.remove();
    for (const marker of this.routeDirectionMarkers) {
      marker.remove();
    }
    this.routeLine = null;
    this.routeStartMarker = null;
    this.routeEndMarker = null;
    this.routeDirectionMarkers = [];
  }

  private syncRouteDirectionMarkers(): void {
    const map = this.mapInstance;
    if (!map) {
      return;
    }

    for (const marker of this.routeDirectionMarkers) {
      marker.remove();
    }

    const directionalPoints = this.routePoints.filter(
      (point) =>
        Number.isFinite(point.lat) &&
        Number.isFinite(point.lng) &&
        typeof point.course === 'number' &&
        Number.isFinite(point.course),
    );
    const maxDirectionMarkers = 24;
    const stride = Math.max(1, Math.ceil(directionalPoints.length / maxDirectionMarkers));

    this.routeDirectionMarkers = directionalPoints
      .filter((_, index) => index % stride === 0)
      .map((point) =>
        L.marker([point.lat, point.lng], {
          icon: this.createRouteDirectionIcon(point.course as number),
          interactive: false,
          keyboard: false,
        }).addTo(map),
      );
  }

  private createRouteDirectionIcon(course: number): L.DivIcon {
    const normalizedCourse = Math.round((((course % 360) + 360) % 360) * 10) / 10;

    return L.divIcon({
      className: 'rea-route-direction-host',
      html: `<span class="rea-route-direction" style="--course:${normalizedCourse}deg" aria-hidden="true"></span>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }

  private createPetIcon(): L.DivIcon {
    const stateClass = this.live ? 'is-live' : 'is-offline';
    const label = this.escapeHtml(this.petName?.trim().slice(0, 1).toUpperCase() || 'P');

    return L.divIcon({
      className: 'rea-map-marker-host',
      html: `<div class="rea-map-marker ${stateClass}" aria-hidden="true"><span>${label}</span></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return char;
      }
    });
  }

  private emitZoomChanged(): void {
    if (!this.mapInstance) {
      return;
    }

    this.zoomChanged.emit(this.mapInstance.getZoom());
  }
}
