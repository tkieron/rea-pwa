import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api.tokens';

export type PetSpecies = 'DOG' | 'CAT' | 'OTHER';

export interface PetBreedDto {
  id: number;
  code: string;
  name: string;
  species: PetSpecies;
}

export interface PetBreedListResponseDto {
  items: PetBreedDto[];
}

@Injectable({
  providedIn: 'root',
})
export class PetBreedsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  list(species?: PetSpecies): Observable<PetBreedListResponseDto> {
    let params = new HttpParams();

    if (species) {
      params = params.set('species', species);
    }

    return this.http.get<PetBreedListResponseDto>(`${this.apiBaseUrl}/api/v1/pet-breeds`, {
      params,
    });
  }
}
