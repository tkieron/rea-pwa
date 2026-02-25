import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, forkJoin, switchMap } from 'rxjs';
import { PetsService, PetGender, PetResponseDto, SavePetRequestDto } from '../../services/pets';
import { PetBreedsService, PetBreedDto } from '../../services/pet-breeds';
import { ApiFeedbackService } from '../../services/api-feedback';
import { DeviceListItemDto, DevicesService } from '../../services/devices';

@Component({
  selector: 'app-pet-edit-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './pet-edit.html',
  styleUrl: './pet-edit.scss',
})
export class PetEditPage {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly petsService = inject(PetsService);
  private readonly petBreedsService = inject(PetBreedsService);
  private readonly devicesService = inject(DevicesService);
  private readonly apiFeedback = inject(ApiFeedbackService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly uploadingPhoto = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly breeds = signal<PetBreedDto[]>([]);
  readonly devices = signal<DeviceListItemDto[]>([]);
  readonly currentPet = signal<PetResponseDto | null>(null);
  readonly photoSrc = signal<string | null>(null);
  readonly deviceSelectLocked = signal(true);
  readonly isCreateMode = signal(false);
  readonly hasUnsavedChanges = signal(false);
  private initialPayloadSnapshot: string | null = null;

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    breedId: [0, [Validators.required, Validators.min(1)]],
    gender: ['UNKNOWN' as PetGender, [Validators.required]],
    dateOfBirth: [''],
    assignedDeviceId: [null as number | null],
  });

  readonly petId = this.readPetId();

  constructor() {
    this.form.valueChanges.subscribe(() => this.updateUnsavedChangesState());
    this.isCreateMode.set(this.route.snapshot.routeConfig?.path === 'pet-add');

    if (this.isCreateMode()) {
      this.initializeCreateMode();
      return;
    }

    if (this.petId === null) {
      this.loading.set(false);
      this.loadError.set('Niepoprawny identyfikator zwierzaka.');
      this.apiFeedback.showError(new Error('invalid-pet-id'), {
        title: 'Bledny adres',
        fallbackMessage: 'Niepoprawny identyfikator zwierzaka.',
      });
      return;
    }

    this.loadPetEditorData(this.petId);
  }

  onBack(): void {
    void this.router.navigateByUrl('/pets');
  }

  onSelectGender(gender: PetGender): void {
    this.form.controls.gender.setValue(gender);
    this.form.controls.gender.markAsDirty();
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || this.petId === null || this.isCreateMode()) {
      return;
    }

    this.uploadingPhoto.set(true);
    this.petsService
      .uploadPhoto(this.petId, file)
      .pipe(finalize(() => this.uploadingPhoto.set(false)))
      .subscribe({
        next: (pet) => {
          this.applyLoadedPet(pet, false);
          this.apiFeedback.showSuccess('Zdjecie zaktualizowane');
        },
        error: (error: unknown) => {
          this.apiFeedback.showError(error, {
            title: 'Upload zdjecia nieudany',
            fallbackMessage: 'Nie udalo sie wgrac zdjecia.',
            statusMessages: {
              400: 'Plik zdjecia jest niepoprawny lub za duzy.',
              404: 'Nie znaleziono zwierzaka.',
              500: 'Backend nie mogl odczytac pliku zdjecia.',
            },
          });
        },
      });

    input.value = '';
  }

  onSave(): void {
    if (!this.isCreateMode() && this.petId === null) {
      this.apiFeedback.showError(new Error('invalid-pet-id'), {
        title: 'Nie mozna zapisac',
        fallbackMessage: 'Brak poprawnego identyfikatora zwierzaka.',
      });
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload = this.buildPayload();

    this.saving.set(true);
    const request$ = this.isCreateMode()
      ? this.petsService.create(payload)
      : this.petsService.update(this.petId as number, payload);

    request$
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (pet) => {
          this.applyLoadedPet(pet, true);
          if (this.isCreateMode()) {
            this.apiFeedback.showSuccess('Zwierzak dodany', 'Profil zwierzaka zostal utworzony.');
            void this.router.navigateByUrl(`/pet-edit/${pet.id}`);
            return;
          }

          this.apiFeedback.showSuccess('Zmiany zapisane', 'Profil zwierzaka zostal zaktualizowany.');
        },
        error: (error: unknown) => {
          this.apiFeedback.showError(error, {
            title: this.isCreateMode() ? 'Tworzenie nieudane' : 'Zapis nieudany',
            fallbackMessage: 'Nie udalo sie zapisac zmian.',
            statusMessages: {
              404: 'Nie znaleziono zwierzaka, rasy lub urzadzenia.',
              409: 'Wybrane urzadzenie jest przypisane do innego uzytkownika.',
            },
          });
        },
      });
  }

  onDelete(): void {
    if (this.isCreateMode()) {
      return;
    }

    if (this.petId === null || this.deleting()) {
      return;
    }

    const confirmed = globalThis.confirm('Usunac profil zwierzaka?');
    if (!confirmed) {
      return;
    }

    this.deleting.set(true);
    this.petsService
      .delete(this.petId)
      .pipe(finalize(() => this.deleting.set(false)))
      .subscribe({
        next: () => {
          this.apiFeedback.showSuccess('Profil usuniety');
          void this.router.navigateByUrl('/main-view-map');
        },
        error: (error: unknown) => {
          this.apiFeedback.showError(error, {
            title: 'Usuwanie nieudane',
            fallbackMessage: 'Nie udalo sie usunac zwierzaka.',
            statusMessages: {
              404: 'Nie znaleziono zwierzaka.',
            },
          });
        },
      });
  }

  isInvalid(control: 'name' | 'breedId'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.touched || c.dirty);
  }

  private loadPetEditorData(petId: number): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.petsService
      .getById(petId)
      .pipe(
        switchMap((pet) =>
          forkJoin({
            pet: [pet],
            breedsResponse: this.petBreedsService.list(pet.breed.species),
            devicesResponse: this.devicesService.list({ petId }),
          }),
        ),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: ({ pet, breedsResponse, devicesResponse }) => {
          this.breeds.set(breedsResponse.items);
          this.devices.set(this.mergeDevices(devicesResponse.items ?? [], pet));
          this.applyLoadedPet(pet, true);
        },
        error: (error: unknown) => {
          this.loadError.set('LOAD_FAILED');
          this.apiFeedback.showError(error, {
            title: 'Nie udalo sie zaladowac danych zwierzaka',
            fallbackMessage: 'Operacja nie powiodla sie.',
            statusMessages: {
              404: 'Nie znaleziono zwierzaka lub danych slownikowych.',
            },
          });
        },
      });
  }

  private initializeCreateMode(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.deviceSelectLocked.set(false);
    this.currentPet.set(null);
    this.photoSrc.set(null);

    this.form.reset({
      name: '',
      breedId: 0,
      gender: 'UNKNOWN',
      dateOfBirth: '',
      assignedDeviceId: null,
    });

    this.petBreedsService
      .list('DOG')
      .pipe(
        switchMap((breedsResponse) =>
          forkJoin({
            breedsResponse: [breedsResponse],
            devicesResponse: this.devicesService.list(),
          }),
        ),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: ({ breedsResponse, devicesResponse }) => {
          this.breeds.set(breedsResponse.items);
          this.devices.set(devicesResponse.items ?? []);
          const firstBreedId = breedsResponse.items[0]?.id ?? 0;
          if (firstBreedId > 0) {
            this.form.patchValue({ breedId: firstBreedId });
          }
          this.resetFormTrackingBaseline();
        },
        error: (error: unknown) => {
          this.loadError.set('LOAD_FAILED');
          this.apiFeedback.showError(error, {
            title: 'Nie udalo sie zaladowac formularza dodawania',
            fallbackMessage: 'Nie udalo sie pobrac slownika ras.',
          });
        },
      });
  }

  private applyLoadedPet(pet: PetResponseDto, resetFormState: boolean): void {
    this.currentPet.set(pet);
    this.photoSrc.set(this.petsService.resolvePhotoUrl(pet.photoUrl));

    this.form.patchValue({
      name: pet.name,
      breedId: pet.breed.id,
      gender: pet.gender,
      dateOfBirth: pet.dateOfBirth ?? '',
      assignedDeviceId: pet.assignedDevice?.id ?? null,
    });

    if (resetFormState) {
      this.resetFormTrackingBaseline();
    }

    this.deviceSelectLocked.set(false);
  }

  deviceOptionLabel(device: DeviceListItemDto): string {
    return device.name || device.businessId || `Device #${device.id}`;
  }

  canSubmitSave(): boolean {
    return !this.loading() && !this.saving() && !this.deleting() && this.form.valid && this.hasUnsavedChanges();
  }

  private mergeDevices(items: DeviceListItemDto[], pet: PetResponseDto): DeviceListItemDto[] {
    const map = new Map<number, DeviceListItemDto>();

    for (const item of items) {
      map.set(item.id, item);
    }

    if (pet.assignedDevice && !map.has(pet.assignedDevice.id)) {
      map.set(pet.assignedDevice.id, {
        id: pet.assignedDevice.id,
        businessId: pet.assignedDevice.businessId,
        name: pet.assignedDevice.name,
      });
    }

    return [...map.values()];
  }

  private readPetId(): number | null {
    const raw = this.route.snapshot.paramMap.get('petId');
    const parsed = Number(raw);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private buildPayload(): SavePetRequestDto {
    const value = this.form.getRawValue();
    return {
      name: value.name.trim(),
      breedId: value.breedId,
      gender: value.gender,
      dateOfBirth: value.dateOfBirth || null,
      assignedDeviceId: value.assignedDeviceId ?? null,
    };
  }

  private resetFormTrackingBaseline(): void {
    this.initialPayloadSnapshot = this.snapshotPayload(this.buildPayload());
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.updateUnsavedChangesState();
  }

  private updateUnsavedChangesState(): void {
    if (this.initialPayloadSnapshot === null) {
      this.hasUnsavedChanges.set(this.form.dirty);
      return;
    }

    this.hasUnsavedChanges.set(this.snapshotPayload(this.buildPayload()) !== this.initialPayloadSnapshot);
  }

  private snapshotPayload(payload: SavePetRequestDto): string {
    return JSON.stringify(payload);
  }
}
