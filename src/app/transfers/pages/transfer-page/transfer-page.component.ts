import { Component, inject } from '@angular/core';
import { TransferService } from '../../services/transfer.service';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { TransferDetailComponent } from './transfer-detail/transfer-detail.component';
import { FormSkeletonComponent } from '../../../shared/components/form-skeleton/form-skeleton.component';

@Component({
  selector: 'app-transfer-page',
  imports: [TransferDetailComponent, FormSkeletonComponent],
  templateUrl: './transfer-page.component.html',
})
export class TransferPageComponent {
  transferService = inject(TransferService);

  activatedRoute = inject(ActivatedRoute);
  route = inject(Router);

  transferId = toSignal(
    this.activatedRoute.params.pipe(map((params) => params['id'])),
  );

  transferResource = rxResource({
    request: () => ({ id: +this.transferId() }),
    loader: ({ request }) => {
      return this.transferService.getTransferById(request.id);
    },
  });
}