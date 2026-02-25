import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api.tokens';
import { PetBreedDto } from './pet-breeds';

export type PetGender = 'MALE' | 'FEMALE' | 'UNKNOWN';

export interface AssignedDeviceDto {
  id: number;
  businessId: string;
  name: string;
}

export interface PetResponseDto {
  id: number;
  name: string;
  breed: PetBreedDto;
  gender: PetGender;
  dateOfBirth: string | null;
  photoUrl: string | null;
  assignedDevice: AssignedDeviceDto | null;
}

export interface PetsListResponseDto {
  items: PetResponseDto[];
}

export interface SavePetRequestDto {
  name: string;
  breedId: number;
  gender: PetGender;
  dateOfBirth?: string | null;
  assignedDeviceId?: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class PetsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  list(): Observable<PetsListResponseDto> {
    return this.http.get<PetsListResponseDto>(`${this.apiBaseUrl}/api/v1/pets`);
  }

  getById(petId: number): Observable<PetResponseDto> {
    return this.http.get<PetResponseDto>(`${this.apiBaseUrl}/api/v1/pets/${petId}`);
  }

  create(payload: SavePetRequestDto): Observable<PetResponseDto> {
    return this.http.post<PetResponseDto>(`${this.apiBaseUrl}/api/v1/pets`, payload);
  }

  update(petId: number, payload: SavePetRequestDto): Observable<PetResponseDto> {
    return this.http.put<PetResponseDto>(`${this.apiBaseUrl}/api/v1/pets/${petId}`, payload);
  }

  delete(petId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiBaseUrl}/api/v1/pets/${petId}`);
  }

  uploadPhoto(petId: number, file: File): Observable<PetResponseDto> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<PetResponseDto>(`${this.apiBaseUrl}/api/v1/pets/${petId}/photo`, formData);
  }

  getPhoto(petId: number): Observable<Blob> {
    return this.http.get(`${this.apiBaseUrl}/api/v1/pets/${petId}/photo`, {
      responseType: 'blob',
    });
  }

  resolvePhotoUrl(photoUrl: string | null): string | null {
    if (!photoUrl) {
      return null;
    }

    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
      return photoUrl;
    }

    return `${this.apiBaseUrl}${photoUrl}`;
  }
}
