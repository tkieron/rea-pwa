import { Component, ViewChild, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { finalize, of, switchMap } from 'rxjs';
import { Map as AppMapComponent, MapRoutePoint } from '../../components/map/map';
import { ApiFeedbackService } from '../../services/api-feedback';
import { AuthSessionService } from '../../services/auth-session';
import { DeviceInfoResponseDto, DevicesService } from '../../services/devices';
import { PetResponseDto, PetsService } from '../../services/pets';

interface TrackerDetailItem {
  label: string;
  value: string;
}

interface TrackerDetailSection {
  title: string;
  items: TrackerDetailItem[];
}

@Component({
  selector: 'app-main-view-map-page',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, AppMapComponent],
  templateUrl: './main-view-map.html',
  styleUrl: './main-view-map.scss',
})
export class MainViewMapPage {
  private readonly petsService = inject(PetsService);
  private readonly devicesService = inject(DevicesService);
  private readonly apiFeedback = inject(ApiFeedbackService);
  private readonly authSession = inject(AuthSessionService);

  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly pets = signal<PetResponseDto[]>([]);
  readonly currentPet = signal<PetResponseDto | null>(null);
  readonly currentDeviceInfo = signal<DeviceInfoResponseDto | null>(null);
  readonly currentPhotoSrc = signal<string | null>(null);
  readonly sheetCollapsed = signal(false);
  readonly zoomPanelCollapsed = signal(false);
  readonly drawerOpen = signal(false);
  readonly trackerDetailsOpen = signal(false);
  readonly routeHistoryLoading = signal(false);
  readonly routeHistoryPoints = signal<MapRoutePoint[]>([]);
  readonly detailSnapshotAt = signal(Date.now());
  readonly mapZoom = signal(12);
  readonly mapMinZoom = signal(3);
  readonly mapMaxZoom = signal(19);

  @ViewChild(AppMapComponent) private mapComponent?: AppMapComponent;

  constructor() {
    this.loadMainViewData();
  }

  profileLink(): string {
    const pet = this.currentPet();
    return pet ? `/pet-profile/${pet.id}` : '/pets';
  }

  openDrawer(): void {
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  logout(): void {
    this.closeDrawer();
    this.authSession.logout();
  }

  toggleSheetCollapse(): void {
    this.sheetCollapsed.update((value) => !value);
  }

  collapseSheet(): void {
    this.sheetCollapsed.set(true);
  }

  expandSheet(): void {
    this.sheetCollapsed.set(false);
  }

  collapseZoomPanel(): void {
    this.zoomPanelCollapsed.set(true);
  }

  expandZoomPanel(): void {
    this.zoomPanelCollapsed.set(false);
  }

  openTrackerDetails(): void {
    if (!this.currentDeviceInfo()) {
      return;
    }

    this.detailSnapshotAt.set(Date.now());
    this.trackerDetailsOpen.set(true);
  }

  closeTrackerDetails(): void {
    this.trackerDetailsOpen.set(false);
  }

  showTodayRouteHistory(): void {
    const pet = this.currentPet();
    if (!pet) {
      return;
    }

    this.routeHistoryLoading.set(true);
    this.petsService
      .getRoute(pet.id, { preset: 'today', timezone: this.routeTimezone() })
      .pipe(finalize(() => this.routeHistoryLoading.set(false)))
      .subscribe({
        next: (route) => {
          this.routeHistoryPoints.set(
            route.points
              .filter((point) => point.gps && Number.isFinite(point.lat) && Number.isFinite(point.lng))
              .map((point) => ({ lat: point.lat, lng: point.lng, course: point.course })),
          );
          this.trackerDetailsOpen.set(false);
        },
        error: (error: unknown) => {
          this.apiFeedback.showError(error, {
            title: 'Nie udalo sie zaladowac historii pozycji',
            fallbackMessage: 'Nie udalo sie pobrac trasy zwierzaka.',
          });
        },
      });
  }

  private routeTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }

  zoomMapIn(): void {
    this.mapComponent?.zoomIn();
  }

  zoomMapOut(): void {
    this.mapComponent?.zoomOut();
  }

  recenterMap(): void {
    this.mapComponent?.recenterToTrackedPosition();
  }

  onMapZoomChanged(zoom: number): void {
    if (!Number.isFinite(zoom)) {
      return;
    }

    this.mapZoom.set(Math.round(zoom));
  }

  onZoomTrackClick(event: MouseEvent): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const rect = target.getBoundingClientRect();
    if (rect.height <= 0) {
      return;
    }

    const y = event.clientY - rect.top;
    const clamped = Math.max(0, Math.min(rect.height, y));
    const ratioFromTop = clamped / rect.height;
    const zoomRange = this.mapMaxZoom() - this.mapMinZoom();
    const nextZoom = this.mapMaxZoom() - ratioFromTop * zoomRange;

    this.mapComponent?.setZoomLevel(nextZoom);
  }

  zoomThumbTopPercent(): number {
    const min = this.mapMinZoom();
    const max = this.mapMaxZoom();
    const current = this.mapZoom();
    if (max <= min) {
      return 50;
    }

    const ratio = (current - min) / (max - min);
    return (1 - ratio) * 100;
  }

  mapLatitude(): number | null {
    return this.currentDeviceInfo()?.lastPosition?.latitude ?? null;
  }

  mapLongitude(): number | null {
    return this.currentDeviceInfo()?.lastPosition?.longitude ?? null;
  }

  hasMapPosition(): boolean {
    return this.mapLatitude() != null && this.mapLongitude() != null;
  }

  currentPetName(): string {
    return this.currentPet()?.name ?? 'No pet';
  }

  markerCaption(): string {
    const pet = this.currentPet();
    if (!pet) {
      return 'No pets available';
    }

    const device = this.currentDeviceInfo();
    const positionAddress = device?.lastPosition?.address?.trim();
    const locationStatus = device?.locationStatus || device?.connectivityStatus;

    if (positionAddress) {
      return `${pet.name.toUpperCase()} • ${positionAddress}`;
    }

    if (locationStatus) {
      return `${pet.name.toUpperCase()} • ${locationStatus}`;
    }

    return `${pet.name.toUpperCase()} • tracker status unknown`;
  }

  isLive(): boolean {
    const device = this.currentDeviceInfo();
    return Boolean(device?.locationLive || device?.sensorLive);
  }

  alarmActive(): boolean {
    return this.currentDeviceInfo()?.alarmTime != null;
  }

  alarmTitle(): string {
    const type = this.currentDeviceInfo()?.alarmType;
    if (!this.alarmActive()) {
      return 'No alarm';
    }

    return type ? this.titleize(type) : 'Alarm';
  }

  alarmMetaLabel(): string {
    return this.formatTimestampDelta(this.currentDeviceInfo()?.alarmTime, 'No active alarm');
  }

  liveLabel(): string {
    return this.isLive() ? 'Live' : 'Offline';
  }

  batteryLabel(): string {
    const battery = this.currentDeviceInfo()?.batteryPercent;
    return typeof battery === 'number' ? `${Math.round(battery)}%` : '—';
  }

  gpsLabel(): string {
    const device = this.currentDeviceInfo();
    if (!device) {
      return this.currentPet()?.assignedDevice ? 'Tracker' : 'No tracker';
    }

    if (device.locationLive) {
      return 'Live GPS';
    }

    if (device.locationStatus) {
      return this.titleize(device.locationStatus);
    }

    if (device.connectivityStatus) {
      return this.titleize(device.connectivityStatus);
    }

    return 'Unknown';
  }

  gpsMetaLabel(): string {
    const device = this.currentDeviceInfo();
    if (!device) {
      return 'No device info';
    }

    if (device.sensorLive) {
      return 'Sensor live';
    }

    if (device.connectivityStatus) {
      return this.titleize(device.connectivityStatus);
    }

    return 'No connectivity data';
  }

  updatedLabel(): string {
    return this.formatTimestampDelta(
      this.currentDeviceInfo()?.traccarLastUpdate ?? this.currentDeviceInfo()?.lastPosition?.serverTime,
      '—',
    );
  }

  petAvatarLetter(): string {
    return this.currentPetName().trim().charAt(0).toUpperCase() || 'P';
  }

  trackerDetailSections(): TrackerDetailSection[] {
    const device = this.currentDeviceInfo();
    if (!device) {
      return [];
    }

    const pet = this.currentPet();
    const position = device.lastPosition;

    return [
      {
        title: 'Identity',
        items: [
          { label: 'Pet', value: pet?.name ?? '—' },
          { label: 'Device', value: device.displayName || '—' },
          { label: 'Business ID', value: device.businessId || '—' },
          { label: 'Traccar Device ID', value: this.formatMaybeNumber(device.traccarDeviceId) },
          { label: 'Assigned Pet', value: device.assignedPet?.name ?? pet?.name ?? '—' },
        ],
      },
      {
        title: 'Status',
        items: [
          { label: 'Connectivity', value: this.formatText(device.connectivityStatus) },
          { label: 'Sensor live', value: this.formatBoolean(device.sensorLive) },
          { label: 'Location status', value: this.formatText(device.locationStatus) },
          { label: 'Location live', value: this.formatBoolean(device.locationLive) },
          { label: 'Live tracking', value: this.formatBoolean(device.liveTrackingEnabled) },
          { label: 'Alarm type', value: this.formatText(device.alarmType) },
          { label: 'Alarm time', value: this.formatTimestampDelta(device.alarmTime, '—') },
          { label: 'Traccar last update', value: this.formatTimestampDelta(device.traccarLastUpdate, '—') },
          { label: 'Attributes read at', value: this.formatTimestampDelta(device.attributesReadAt ?? null, '—') },
        ],
      },
      {
        title: 'Power & telemetry',
        items: [
          { label: 'Battery', value: this.formatBattery(device.batteryPercent) },
          { label: 'Charging', value: this.formatBoolean(device.charging) },
          { label: 'RSSI', value: this.formatMaybeNumber(device.rssi) },
          { label: 'Motion', value: this.formatBoolean(device.motion) },
          { label: 'Sat', value: this.formatMaybeNumber(device.sat) },
          { label: 'Heart rate', value: this.formatMaybeNumber(device.heartRate) },
          { label: 'Distance', value: this.formatDistance(device.distance) },
          { label: 'Total distance', value: this.formatDistance(device.totalDistance) },
          { label: 'Hours', value: this.formatHours(device.hours) },
          { label: 'IP', value: device.ip || '—' },
        ],
      },
      {
        title: 'Location',
        items: [
          { label: 'Position ID', value: this.formatMaybeNumber(position?.traccarPositionId ?? null) },
          { label: 'Address', value: position?.address || '—' },
          { label: 'Latitude', value: this.formatCoordinate(position?.latitude) },
          { label: 'Longitude', value: this.formatCoordinate(position?.longitude) },
          { label: 'Speed', value: this.formatSpeed(position?.speed) },
          { label: 'Course', value: this.formatCourse(position?.course) },
          { label: 'Device time', value: this.formatDateTime(position?.deviceTime ?? null) },
          { label: 'Fix time', value: this.formatDateTime(position?.fixTime ?? null) },
          { label: 'Server time', value: this.formatDateTime(position?.serverTime ?? null) },
        ],
      },
    ];
  }

  private loadMainViewData(): void {
    this.loading.set(true);
    this.loadError.set(false);

    this.petsService
      .list()
      .pipe(
        switchMap((response) => {
          const pets = response.items ?? [];
          const selectedPet =
            pets.find((pet) => pet.assignedDevice?.id) ??
            pets[0] ??
            null;

          if (!selectedPet?.assignedDevice?.id) {
            return of({ pets, pet: selectedPet, deviceInfo: null as DeviceInfoResponseDto | null });
          }

          return this.devicesService.getInfo(selectedPet.assignedDevice.id).pipe(
            switchMap((deviceInfo) =>
              of({
                pets,
                pet: selectedPet,
                deviceInfo,
              }),
            ),
          );
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: ({ pets, pet, deviceInfo }) => {
          this.pets.set(pets);
          this.currentPet.set(pet);
          this.currentDeviceInfo.set(deviceInfo);
          this.currentPhotoSrc.set(this.petsService.resolvePhotoUrl(pet?.photoUrl ?? null));
          this.detailSnapshotAt.set(Date.now());
        },
        error: (error: unknown) => {
          this.loadError.set(true);
          this.apiFeedback.showError(error, {
            title: 'Nie udalo sie zaladowac ekranu mapy',
            fallbackMessage: 'Nie udalo sie pobrac danych zwierzat lub trackera.',
          });
        },
      });
  }

  private titleize(value: string): string {
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private formatText(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }

    return this.titleize(value);
  }

  private formatBoolean(value: boolean | null | undefined): string {
    if (value == null) {
      return 'Unknown';
    }

    return value ? 'Yes' : 'No';
  }

  private formatMaybeNumber(value: number | null | undefined): string {
    if (value == null) {
      return '—';
    }

    return `${value}`;
  }

  private formatBattery(value: number | null | undefined): string {
    if (value == null) {
      return '—';
    }

    return `${Math.round(value)}%`;
  }

  private formatDistance(value: number | null | undefined): string {
    if (value == null) {
      return '—';
    }

    return `${value.toFixed(value >= 10 ? 0 : 1)} km`;
  }

  private formatHours(value: number | null | undefined): string {
    if (value == null) {
      return '—';
    }

    return `${value} h`;
  }

  private formatCoordinate(value: number | null | undefined): string {
    if (value == null) {
      return '—';
    }

    return value.toFixed(4);
  }

  private formatSpeed(value: number | null | undefined): string {
    if (value == null) {
      return '—';
    }

    return `${value.toFixed(value >= 10 ? 0 : 1)} km/h`;
  }

  private formatCourse(value: number | null | undefined): string {
    if (value == null) {
      return '—';
    }

    return `${Math.round(value)}°`;
  }

  private formatTimestampDelta(value: string | null | undefined, emptyLabel: string): string {
    if (!value) {
      return emptyLabel;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const diffMs = this.detailSnapshotAt() - date.getTime();
    if (!Number.isFinite(diffMs) || diffMs < 0) {
      return this.formatDateTime(value);
    }

    const elapsed = this.formatElapsedDuration(Math.floor(diffMs / 60000));
    return elapsed === 'Now' ? this.formatDateTime(value) : `${elapsed} ago • ${this.formatDateTime(value)}`;
  }

  private formatDateTime(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  }

  private formatElapsedDuration(totalMinutes: number): string {
    if (totalMinutes <= 0) {
      return 'Now';
    }

    if (totalMinutes < 60) {
      return `${totalMinutes} min`;
    }

    if (totalMinutes <= 1440) {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const hourParts = [`${hours} h`];
      if (minutes > 0) {
        hourParts.push(`${minutes} min`);
      }
      return hourParts.join(' ');
    }

    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const parts = [`${days} d`];
    if (hours > 0) {
      parts.push(`${hours} h`);
    }
    if (minutes > 0) {
      parts.push(`${minutes} min`);
    }
    return parts.join(' ');
  }
}
