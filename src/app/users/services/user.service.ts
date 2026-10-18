import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { User, UserResponse } from '../interfaces/user.interface';
import { environment } from '../../../environments/environment';
import { catchError, Observable, of, throwError } from 'rxjs';

const baseUrl = environment.baseUrl;
const emptyUser: User = {
  id: 0,
  name: '',
  email: '',
  password: '',
  role: 'ADMIN',
  createdAt: new Date(),
  refreshToken: [],
};
@Injectable({
  providedIn: 'root',
})
export class UserService {
  http = inject(HttpClient);
  userIdSelected = signal<number>(0);

  getUsers(
    page: number,
    limit: number,
    name: string,
  ): Observable<UserResponse> {
    return this.http
      .get<UserResponse>(`${baseUrl}/users`, {
        params: { page, limit, name },
      })
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }

  getUserById(id: number): Observable<User> {
    if (id === 0) {
      return of(emptyUser);
    }

    return this.http.get<User>(`${baseUrl}/users/${id}`).pipe(
      catchError((exception) => {
        return throwError(() => ({
          message: exception['error'].message,
          status: exception['error'].statusCode,
        }));
      }),
    );
  }

  createUser(userLike: Partial<User>): Observable<User> {
    return this.http
      .post<User>(`${baseUrl}/users`, {
        name: userLike.name,
        email: userLike.email,
        role: userLike.role,
      })
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }

  updateUser(id: number, userLike: Partial<User>): Observable<User> {
    return this.http
      .patch<User>(`${baseUrl}/users/${id}`, {
        ...userLike,
      })
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }

  deleteUser(id: number): Observable<User> {
    return this.http.delete<User>(`${baseUrl}/users/${id}`).pipe(
      catchError((exception) => {
        return throwError(() => ({
          message: exception['error'].message,
          status: exception['error'].statusCode,
        }));
      }),
    );
  }

  revokeSession(tokenId: string): Observable<void> {
    return this.http
      .delete<void>(`${baseUrl}/users/revoke-sessions/${tokenId}`)
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }
}
