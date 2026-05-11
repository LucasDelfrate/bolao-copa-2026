import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { BracketBonus, Palpite } from '../models';

@Injectable({ providedIn: 'root' })
export class PalpitesService {
  constructor(private afs: AngularFirestore) {}

  getMyPalpites(uid: string): Observable<Palpite[]> {
    return this.afs
      .collection<Palpite>('palpites', (ref) => ref.where('uid', '==', uid))
      .valueChanges();
  }

  getAllPalpitesForMatch(matchId: string): Observable<Palpite[]> {
    return this.afs
      .collection<Palpite>('palpites', (ref) => ref.where('matchId', '==', matchId))
      .valueChanges();
  }

  async savePalpite(palpite: Omit<Palpite, 'id' | 'updatedAt'>): Promise<void> {
    const id = `${palpite.uid}_${palpite.matchId}`;
    const data: Palpite = {
      ...palpite,
      id,
      updatedAt: Date.now(),
    };
    await this.afs.collection('palpites').doc(id).set(data, { merge: true });
  }

  getBracket(uid: string): Observable<BracketBonus | undefined> {
    return this.afs.collection('bracket').doc<BracketBonus>(uid).valueChanges();
  }

  async clearPalpitesByPhase(uid: string, phase: string): Promise<void> {
    const snap = await this.afs
      .collection<Palpite>('palpites', (ref) =>
        ref.where('uid', '==', uid).where('phase', '==', phase),
      )
      .get()
      .toPromise();
    const batch = this.afs.firestore.batch();
    snap?.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  async clearAllPalpites(uid: string): Promise<void> {
    const snap = await this.afs
      .collection<Palpite>('palpites', (ref) => ref.where('uid', '==', uid))
      .get()
      .toPromise();
    const batch = this.afs.firestore.batch();
    snap?.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  async saveBracket(uid: string, bracket: Partial<BracketBonus>): Promise<void> {
    const data: BracketBonus = {
      uid,
      ...bracket,
      updatedAt: Date.now(),
    } as BracketBonus;
    await this.afs.collection('bracket').doc(uid).set(data, { merge: true });
  }
}
