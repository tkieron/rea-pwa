import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class RegisterPage {}
