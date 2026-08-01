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
- `backup` — WireGuard verso casa + job vzdump/PBS (lato Proxmox; da definire in fase 7+).

> **Nota:** un ruolo `pipeline` (checkout + systemd timer sul server) era previsto ma è
> **decaduto**: la pipeline gira sulla macchina locale di Stefano con run manuali (vedi
> `docs/decisioni.md`), non sul server. Il server fa solo serving.

## Esecuzione da WSL (trappola nota)

Il repo vive su `/mnt/d/...`, che WSL espone come cartella "world writable": in quel caso
Ansible **ignora** `ansible.cfg`, quindi non carica l'inventory e il playbook non trova host
(`no hosts matched`, `PLAY RECAP` vuoto). Serve indicare la config esplicitamente:

```bash
export ANSIBLE_CONFIG=/mnt/d/AI/Vibe/Claude/NewsForge/infra/ansible.cfg
```

Conviene metterlo in `~/.bashrc` una volta per tutte. Il warning "world writable directory"
resta visibile ma è innocuo.

## Provisioning vs deploy (separati)

Due esigenze diverse, due comandi:

- **Deploy contenuti** (routine): `ansible-playbook deploy.yml -K` — solo il ruolo `deploy`
  (git pull → build → rsync in docroot). **Non tocca base/node/caddy**, quindi è veloce e non
  causa alcun reload/restart di Caddy. La build gira in `/opt/newsforge`: il sito resta servito
  fino allo scambio rsync finale (impatto quasi nullo).
- **Provisioning completo** (prima installazione o modifiche a caddy/node/base):
  `ansible-playbook site.yml -K`. Idempotente: se nulla cambia, Caddy non viene toccato (il
  reload è un handler `state: reloaded` — graduale, zero-downtime — e scatta solo se il
  Caddyfile cambia davvero).

`site.yml` ha anche i tag `provision` e `deploy`: `--tags deploy` equivale a `deploy.yml`,
`--tags provision` fa solo base+node+caddy.

## Convenzioni

- Secrets SOLO in Ansible Vault (`group_vars/*/vault.yml`), mai in chiaro nel repo.
- Variabili d'ambiente specifiche (domini, email Let's Encrypt/interna, IP) in
  `inventory/<env>.yml` + `group_vars/` — i ruoli non contengono valori hardcoded.
- Idempotenza verificata: ogni playbook deve poter girare due volte senza cambiare nulla
  alla seconda esecuzione.
- Testare SEMPRE su `local` prima di toccare `prod`.
