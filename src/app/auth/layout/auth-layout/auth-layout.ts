import { Component, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { ThemeService } from "../../../shared/services/theme.service";

@Component({
  selector: "app-auth-layout",
  imports: [RouterOutlet],
  templateUrl: "./auth-layout.html",
})
export class AuthLayoutComponent {
  themeService = inject(ThemeService);
}
