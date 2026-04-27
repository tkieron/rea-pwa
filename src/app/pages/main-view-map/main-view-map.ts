import { Component, ViewChild, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { finalize, of, switchMap } from 'rxjs';
import { Map as AppMapComponent } from '../../components/map/map';
import { ApiFeedbackService } from '../../services/api-feedback';
import { DeviceInfoResponseDto, DevicesService } from '../../services/devices';
import { PetResponseDto, PetsService } from '../../services/pets';

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

  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly pets = signal<PetResponseDto[]>([]);
  readonly currentPet = signal<PetResponseDto | null>(null);
  readonly currentDeviceInfo = signal<DeviceInfoResponseDto | null>(null);
  readonly currentPhotoSrc = signal<string | null>(null);
  readonly sheetCollapsed = signal(false);
  readonly zoomPanelCollapsed = signal(false);
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

  currentPetNameUpper(): string {
    return this.currentPetName().toUpperCase();
  }

  petSubtitle(): string {
    const pet = this.currentPet();
    if (!pet) {
      return 'Dodaj zwierzaka, aby zobaczyc szczegoly';
    }

    const parts = [pet.breed?.name].filter(Boolean) as string[];
    const age = this.petAgeLabel(pet.dateOfBirth);
    if (age) {
      parts.push(age);
    }

    return parts.join(' • ') || 'Profil zwierzaka';
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
    const alarmTime = this.currentDeviceInfo()?.alarmTime;
    if (!alarmTime) {
      return 'No active alarm';
    }

    const date = new Date(alarmTime);
    if (Number.isNaN(date.getTime())) {
      return 'Alarm active';
    }

    const diffMs = Date.now() - date.getTime();
    if (!Number.isFinite(diffMs) || diffMs < 0) {
      return 'Alarm active';
    }

    const duration = this.formatElapsedDuration(Math.floor(diffMs / 60000));
    return duration === 'Now' ? 'Alarm active' : duration;
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
    const ts = this.currentDeviceInfo()?.traccarLastUpdate ?? this.currentDeviceInfo()?.lastPosition?.serverTime;
    if (!ts) {
      return '—';
    }

    const date = new Date(ts);
    const diffMs = Date.now() - date.getTime();
    if (!Number.isFinite(diffMs) || diffMs < 0) {
      return 'Now';
    }

    return this.formatElapsedDuration(Math.floor(diffMs / 60000));
  }

  detailTitle(): string {
    const pos = this.currentDeviceInfo()?.lastPosition;
    if (pos?.address) {
      return pos.address;
    }
    if (pos?.latitude != null && pos?.longitude != null) {
      return 'Tracked position';
    }
    return this.currentPet()?.assignedDevice ? 'No recent position' : 'No tracker assigned';
  }

  detailCoordsLabel(): string {
    const pos = this.currentDeviceInfo()?.lastPosition;
    if (pos?.latitude == null || pos.longitude == null) {
      return this.currentPet()?.assignedDevice ? 'Waiting for tracker position...' : 'Assign tracker to enable location';
    }

    return `Lat: ${pos.latitude.toFixed(4)} • Long: ${pos.longitude.toFixed(4)}`;
  }

  speedLabel(): string {
    const speed = this.currentDeviceInfo()?.lastPosition?.speed;
    if (typeof speed !== 'number') {
      return '—';
    }

    return `${speed.toFixed(speed >= 10 ? 0 : 1)} km/h`;
  }

  petAvatarLetter(): string {
    return this.currentPetName().trim().charAt(0).toUpperCase() || 'P';
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

  private petAgeLabel(dateOfBirth: string | null): string | null {
    if (!dateOfBirth) {
      return null;
    }

    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      return null;
    }

    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    const dayDiff = now.getDate() - dob.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      years -= 1;
    }

    if (years <= 0) {
      return '<1 yr';
    }

    return `${years} yr${years === 1 ? '' : 's'}`;
  }

  private titleize(value: string): string {
    return value
      .toLowerCase()
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
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
