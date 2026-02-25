import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { finalize, of, switchMap } from 'rxjs';
import { PetsService, PetResponseDto } from '../../services/pets';
import { DevicesService, DeviceInfoResponseDto } from '../../services/devices';
import { ApiFeedbackService } from '../../services/api-feedback';

@Component({
  selector: 'app-pet-profile-page',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './pet-profile.html',
  styleUrl: './pet-profile.scss',
})
export class PetProfilePage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly petsService = inject(PetsService);
  private readonly devicesService = inject(DevicesService);
  private readonly apiFeedback = inject(ApiFeedbackService);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly pet = signal<PetResponseDto | null>(null);
  readonly deviceInfo = signal<DeviceInfoResponseDto | null>(null);

  readonly petId = this.readPetId();

  readonly photoSrc = computed(() => this.petsService.resolvePhotoUrl(this.pet()?.photoUrl ?? null));

  constructor() {
    if (this.petId === null) {
      this.loading.set(false);
      this.loadError.set('INVALID_ID');
      this.apiFeedback.showError(new Error('invalid-pet-id'), {
        title: 'Bledny adres',
        fallbackMessage: 'Niepoprawny identyfikator zwierzaka.',
      });
      return;
    }

    this.loadData(this.petId);
  }

  onBack(): void {
    void this.router.navigateByUrl('/pets');
  }

  ageLabel(): string {
    const dateOfBirth = this.pet()?.dateOfBirth;
    if (!dateOfBirth) {
      return 'Age unknown';
    }

    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      return 'Age unknown';
    }

    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    const dayDiff = now.getDate() - dob.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      years--;
    }

    if (years <= 0) {
      return '<1 Year';
    }

    return years === 1 ? '1 Year' : `${years} Years`;
  }

  genderLabel(): string {
    const gender = this.pet()?.gender;
    if (!gender) {
      return 'Unknown';
    }

    if (gender === 'MALE') {
      return 'Male';
    }

    if (gender === 'FEMALE') {
      return 'Female';
    }

    return 'Unknown';
  }

  deviceDisplayName(): string {
    const info = this.deviceInfo();
    const pet = this.pet();
    return (
      info?.displayName ||
      info?.businessId ||
      pet?.assignedDevice?.name ||
      pet?.assignedDevice?.businessId ||
      'No tracker'
    );
  }

  deviceBusinessId(): string {
    const info = this.deviceInfo();
    const pet = this.pet();
    return info?.businessId || pet?.assignedDevice?.businessId || 'N/A';
  }

  batteryLabel(): string {
    const battery = this.deviceInfo()?.batteryPercent;
    return battery == null ? 'N/A' : `${battery}%`;
  }

  chargingLabel(): string {
    const charging = this.deviceInfo()?.charging;
    if (charging == null) {
      return 'Unknown';
    }
    return charging ? 'Charging' : 'Not charging';
  }

  liveTrackingEnabled(): boolean {
    return this.deviceInfo()?.liveTrackingEnabled ?? false;
  }

  locationLabel(): string {
    const status = this.deviceInfo()?.locationStatus;
    const address = this.deviceInfo()?.lastPosition?.address;

    if (address) {
      return address;
    }

    return status || 'No location';
  }

  speedLabel(): string {
    const speed = this.deviceInfo()?.lastPosition?.speed;
    if (speed == null) {
      return 'N/A';
    }

    return `${speed.toFixed(1)} km/h`;
  }

  attributesFreshnessClass(): string {
    const minutes = this.attributesAgeMinutes();
    if (minutes == null) {
      return 'freshness-unknown';
    }
    if (minutes <= 15) {
      return 'freshness-green';
    }
    if (minutes <= 60) {
      return 'freshness-yellow';
    }
    return 'freshness-red';
  }

  attributesFreshnessText(): string {
    const timestamp = this.attributesTimestamp();
    if (!timestamp) {
      return 'No telemetry timestamp';
    }
    const minutes = this.attributesAgeMinutes();
    if (minutes == null) {
      return 'Telemetry age unknown';
    }
    if (minutes < 1) {
      return 'Status now';
    }
    return `Status ${minutes} min ago`;
  }

  attributesFreshnessTooltip(): string {
    const timestamp = this.attributesTimestamp();
    if (!timestamp) {
      return 'Status: brak daty odczytu atrybutow';
    }
    return `Status z ${this.formatDateTime(timestamp)}`;
  }

  private loadData(petId: number): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.petsService
      .getById(petId)
      .pipe(
        switchMap((pet) => {
          this.pet.set(pet);

          const deviceId = pet.assignedDevice?.id;
          if (!deviceId) {
            return of(null);
          }

          return this.devicesService.getInfo(deviceId);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (deviceInfo) => {
          this.deviceInfo.set(deviceInfo);
        },
        error: (error: unknown) => {
          this.loadError.set('LOAD_FAILED');
          this.apiFeedback.showError(error, {
            title: 'Nie udalo sie zaladowac profilu zwierzaka',
            fallbackMessage: 'Nie udalo sie pobrac danych profilu.',
            statusMessages: {
              404: 'Nie znaleziono zwierzaka lub urzadzenia.',
            },
          });
        },
      });
  }

  private attributesTimestamp(): string | null {
    const device = this.deviceInfo();
    return (
      device?.attributesReadAt ??
      device?.traccarLastUpdate ??
      device?.lastPosition?.serverTime ??
      device?.lastPosition?.fixTime ??
      null
    );
  }

  private attributesAgeMinutes(): number | null {
    const timestamp = this.attributesTimestamp();
    if (!timestamp) {
      return null;
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  }

  private formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  }

  private readPetId(): number | null {
    const raw = this.route.snapshot.paramMap.get('petId');
    const parsed = Number(raw);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
}
