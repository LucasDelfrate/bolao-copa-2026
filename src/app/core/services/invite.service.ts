import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, map } from 'rxjs';
import { InviteCode } from '../models';

@Injectable({ providedIn: 'root' })
export class InviteService {
  private readonly TEST_CODE = 'TESTE';

  constructor(private afs: AngularFirestore) {}

  getTestMode(): Observable<boolean> {
    return this.afs
      .collection('config').doc<{ enabled: boolean }>('testMode')
      .valueChanges()
      .pipe(map((d) => !!d?.enabled));
  }

  async setTestMode(enabled: boolean): Promise<void> {
    await this.afs.collection('config').doc('testMode').set({ enabled });
  }

  getAllCodes(): Observable<InviteCode[]> {
    return this.afs
      .collection<InviteCode>('inviteCodes', (ref) =>
        ref.orderBy('createdAt', 'desc'),
      )
      .valueChanges();
  }

  async generateCode(label: string): Promise<string> {
    const code = this.randomCode();
    const doc: InviteCode = {
      code,
      label: label.trim(),
      createdAt: Date.now(),
    };
    await this.afs.collection('inviteCodes').doc(code).set(doc);
    return code;
  }

  async deleteCode(code: string): Promise<void> {
    await this.afs.collection('inviteCodes').doc(code).delete();
  }

  async redeemCode(
    code: string,
    uid: string,
    displayName: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const normalized = code.trim().toUpperCase();

    // Modo teste: código "TESTE" aprovado diretamente se habilitado
    if (normalized === this.TEST_CODE) {
      const testSnap = await this.afs.collection('config').doc('testMode').get().toPromise();
      const testEnabled = !!(testSnap?.data() as any)?.enabled;
      if (!testEnabled) {
        return { ok: false, error: 'Código inválido.' };
      }
      await this.afs.collection('users').doc(uid).update({ isApproved: true });
      return { ok: true };
    }

    const ref = this.afs.collection('inviteCodes').doc<InviteCode>(normalized);
    const snap = await ref.get().toPromise();

    if (!snap || !snap.exists) {
      return { ok: false, error: 'Código inválido.' };
    }

    const data = snap.data() as InviteCode;

    if (data.usedAt) {
      return { ok: false, error: 'Este código já foi utilizado.' };
    }

    await this.afs.firestore.runTransaction(async (tx) => {
      const codeRef = this.afs.firestore.collection('inviteCodes').doc(normalized);
      const userRef = this.afs.firestore.collection('users').doc(uid);
      tx.update(codeRef, {
        usedAt: Date.now(),
        usedByUid: uid,
        usedByName: displayName,
      });
      tx.update(userRef, { isApproved: true });
    });

    return { ok: true };
  }

  private randomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const seg = () =>
      Array.from({ length: 4 }, () =>
        chars[Math.floor(Math.random() * chars.length)],
      ).join('');
    return `${seg()}-${seg()}`;
  }
}
