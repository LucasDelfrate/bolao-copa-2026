import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';
import { Observable, of } from 'rxjs';
import { distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { AppUser } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user$: Observable<AppUser | null>;

  constructor(
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore,
  ) {
    this.user$ = this.afAuth.authState.pipe(
      switchMap((firebaseUser) => {
        if (!firebaseUser) return of(null);
        return this.getOrCreateUser(firebaseUser);
      }),
    );
  }

  get isAdmin$(): Observable<boolean> {
    return this.user$.pipe(
      map((u) => !!u?.isAdmin),
      distinctUntilChanged(),
    );
  }

  get isApproved$(): Observable<boolean> {
    return this.user$.pipe(
      map((u) => !!u?.isApproved || !!u?.isAdmin),
      distinctUntilChanged(),
    );
  }

  async signInWithGoogle(): Promise<void> {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await this.afAuth.signInWithPopup(provider);
  }

  signOut(): Promise<void> {
    return this.afAuth.signOut();
  }

  private getOrCreateUser(firebaseUser: firebase.User): Observable<AppUser | null> {
    const ref = this.afs.collection('users').doc<AppUser>(firebaseUser.uid);

    // Escuta em tempo real — reage a isApproved / isAdmin mudando no Firestore
    return ref.valueChanges().pipe(
      switchMap(async (existing) => {
        if (existing) return existing;

        // Primeiro acesso: cria o documento (não aprovado por padrão)
        const newUser: AppUser = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName ?? 'Sem nome',
          email: firebaseUser.email ?? '',
          photoURL: firebaseUser.photoURL ?? '',
          createdAt: Date.now(),
          isAdmin: false,
          isApproved: false,
        };
        await ref.set(newUser);
        return newUser;
      }),
    );
  }
}
