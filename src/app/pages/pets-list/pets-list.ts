import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { DevicesService } from '../../services/devices';
import { PetsService, PetResponseDto } from '../../services/pets';
import { ApiFeedbackService } from '../../services/api-feedback';

@Component({
  selector: 'app-pets-list-page',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './pets-list.html',
  styleUrl: './pets-list.scss',
})
export class PetsListPage {
  private readonly petsService = inject(PetsService);
  private readonly devicesService = inject(DevicesService);
  private readonly apiFeedback = inject(ApiFeedbackService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly pets = signal<PetResponseDto[]>([]);
  readonly devicesCount = signal<number | null>(null);

  readonly assignedCount = computed(
    () => this.pets().filter((pet) => pet.assignedDevice !== null).length,
  );

  constructor() {
    this.loadData();
  }

  trackPet(_index: number, pet: PetResponseDto): number {
    return pet.id;
  }

  photoSrc(pet: PetResponseDto): string | null {
    return this.petsService.resolvePhotoUrl(pet.photoUrl);
  }

  speciesLabel(pet: PetResponseDto): string {
    return pet.breed?.species ?? 'OTHER';
  }

  private loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      petsResponse: this.petsService.list(),
      devicesResponse: this.devicesService.list(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ petsResponse, devicesResponse }) => {
          this.pets.set(petsResponse.items ?? []);
          this.devicesCount.set(devicesResponse.items?.length ?? 0);
        },
        error: (error: unknown) => {
          this.error.set('LOAD_FAILED');
          this.apiFeedback.showError(error, {
            title: 'Nie udalo sie pobrac listy zwierzakow',
            fallbackMessage: 'Nie udalo sie pobrac listy zwierzakow.',
          });
        },
      });
  }
}
