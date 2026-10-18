import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import {  UserDetailComponent } from './user-detail/user-detail.component';
import { UserService } from '../../services/user.service';
import { FormSkeletonComponent } from '../../../shared/components/form-skeleton/form-skeleton.component';

@Component({
  selector: 'app-user-page.component',
  imports: [UserDetailComponent, FormSkeletonComponent],
  templateUrl: './user-page.component.html',
})
export class UserPageComponent {
  userService = inject(UserService);
  router = inject(Router)
  activatedRoute = inject(ActivatedRoute);

  providerId = toSignal(this.activatedRoute.params.pipe(
    map((param) => param['id'])
  ));

  userResource = rxResource({
    request: () => ({id: +this.providerId()}),
    loader: ({request}) => {
      return this.userService.getUserById(request.id)
    }
  })

}
