import { Component, input } from '@angular/core';

export interface ErrorBanner{
    message:string;
    error: string;
}

@Component({
  selector: 'app-error-banner',
  imports: [],
  templateUrl: './error-banner.component.html',
})
export class ErrorBannerComponent {
    errorBanner = input.required<ErrorBanner>();
}
