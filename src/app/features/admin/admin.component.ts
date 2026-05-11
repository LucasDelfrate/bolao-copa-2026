import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AppUser, InviteCode } from '../../core/models';
import { InviteService } from '../../core/services/invite.service';
import { PalpitesService } from '../../core/services/palpites.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css'],
})
export class AdminComponent implements OnInit {
  codes: InviteCode[] = [];
  newLabel = '';
  generatedCode = '';
  loading = false;
  error = '';

  users: AppUser[] = [];
  removeTarget: AppUser | null = null;
  removeLoading = false;

  constructor(
    private invite: InviteService,
    private afs: AngularFirestore,
    private palpites: PalpitesService,
  ) {}

  ngOnInit(): void {
    this.invite.getAllCodes().subscribe((codes) => (this.codes = codes));
    this.afs
      .collection<AppUser>('users', (ref) => ref.orderBy('displayName'))
      .valueChanges()
      .subscribe((users) => (this.users = users));
  }

  async generate(): Promise<void> {
    if (!this.newLabel.trim()) {
      this.error = 'Informe um nome/rótulo para o código.';
      return;
    }
    this.loading = true;
    this.error = '';
    this.generatedCode = '';
    try {
      this.generatedCode = await this.invite.generateCode(this.newLabel);
      this.newLabel = '';
    } catch (e: any) {
      this.error = e?.message ?? 'Erro ao gerar código.';
    } finally {
      this.loading = false;
    }
  }

  async revoke(code: string): Promise<void> {
    if (!confirm(`Revogar o código ${code}?`)) return;
    await this.invite.deleteCode(code);
  }

  copyCode(code: string): void {
    navigator.clipboard.writeText(code);
  }

  trackCode(_i: number, c: InviteCode): string {
    return c.code;
  }

  openRemoveModal(user: AppUser): void {
    this.removeTarget = user;
  }

  closeRemoveModal(): void {
    if (this.removeLoading) return;
    this.removeTarget = null;
  }

  async confirmRemove(): Promise<void> {
    if (!this.removeTarget) return;
    this.removeLoading = true;
    const uid = this.removeTarget.uid;
    try {
      await this.palpites.clearAllDataForUser(uid);
      await this.afs.collection('users').doc(uid).delete();
      this.removeTarget = null;
    } finally {
      this.removeLoading = false;
    }
  }
}
