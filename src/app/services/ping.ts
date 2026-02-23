import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api.tokens';

export interface PingResponseDto {
  service: string;
  status: string;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class PingService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  ping(): Observable<PingResponseDto> {
    return this.http.get<PingResponseDto>(`${this.apiBaseUrl}/api/v1/ping`);
  }
}
