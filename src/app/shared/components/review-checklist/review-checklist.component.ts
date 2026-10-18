import { Component, input } from '@angular/core';

export interface ReviewItem {
  label: string;
  complete: boolean;
  touched: boolean;
  optional?: boolean;
}
@Component({
  selector: 'app-review-checklist',
  template: `
    <section class="border-t border-base-300 mt-5 pt-4">
      <h3 class="font-semibold">Datos ingresados</h3>
      <ul class="space-y-3 mt-4">
        @for (item of items(); track item.label) {
          <li class="flex items-start gap-2 text-sm" [class]="item.complete ? 'text-success' : item.touched && !item.optional ? 'text-error' : 'text-base-content/60'">
            <span class="text-lg shrink-0" [class]="item.complete ? 'icon-[tabler--circle-check]' : item.touched && !item.optional ? 'icon-[tabler--circle-x]' : 'icon-[tabler--circle-minus]'" aria-hidden="true"></span>
            <span>{{ item.label }}<span class="sr-only">: {{ item.complete ? 'Completo' : item.optional ? 'Opcional, sin agregar' : item.touched ? 'Requiere revisión' : 'Sin completar' }}</span></span>
          </li>
        }
      </ul>
      <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs text-base-content/60 mt-5" aria-hidden="true"><span class="flex items-center gap-2"><span class="status status-success"></span>Completo</span><span class="flex items-center gap-2"><span class="status status-error"></span>Requiere revisión</span><span class="flex items-center gap-2"><span class="status bg-base-content/30"></span>Sin completar</span></div>
    </section>`,
})
export class ReviewChecklistComponent { readonly items = input.required<readonly ReviewItem[]>(); }
