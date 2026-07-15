# Infra — provisioning e deploy con Ansible

## Principio

Nessuna configurazione a mano sui server. Tutto ciò che rende funzionante una macchina
deve essere riproducibile con `ansible-playbook`. La VM locale di sviluppo e la VM di
produzione condividono gli stessi ruoli: differiscono solo per `host_vars`/`group_vars`.

## Target

- `local` — VM Debian 12 sul PC di Stefano (Hyper-V/VirtualBox). Banco di prova dei playbook.
- `prod` — VM Debian 12 "prod" su Proxmox VE (server SeFlow QA-2124.2, ZFS mirror).
  Un solo IP pubblico: Caddy sull'host o port-forward dall'hypervisor alla VM (decisione
  da registrare in docs/decisioni.md quando presa).

## Ruoli previsti

- `base` — utenti, chiavi SSH, hardening sshd (no password, no root login), firewall
  nftables (solo 22/80/443), fail2ban, unattended-upgrades, timezone/NTP.
- `caddy` — installazione, Caddyfile templato da lista domini in group_vars, reload idempotente.
- `node` — Node.js LTS (per le build Astro) + pnpm/npm.
- `deploy` — utente deploy, repo git bare + hook post-receive: build Astro + pagefind →
  docroot per dominio.
- `pipeline` — checkout pipeline, .env da vault, systemd timer per i run schedulati.
- `backup` — WireGuard verso casa + job vzdump/PBS (lato Proxmox; da definire in fase 7+).

## Convenzioni

- Secrets SOLO in Ansible Vault (`group_vars/*/vault.yml`), mai in chiaro nel repo.
- Variabili d'ambiente specifiche (domini, email Let's Encrypt/interna, IP) in
  `inventory/<env>.yml` + `group_vars/` — i ruoli non contengono valori hardcoded.
- Idempotenza verificata: ogni playbook deve poter girare due volte senza cambiare nulla
  alla seconda esecuzione.
- Testare SEMPRE su `local` prima di toccare `prod`.
