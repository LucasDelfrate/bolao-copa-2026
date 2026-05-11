import { Component, OnInit } from '@angular/core';
import { InviteCode } from '../../core/models';
import { InviteService } from '../../core/services/invite.service';

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

  constructor(private invite: InviteService) {}

  ngOnInit(): void {
    this.invite.getAllCodes().subscribe((codes) => (this.codes = codes));
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
}
