# Claude Code Enterprise Proxy

Proxy + CLI wrapper pour Claude Code qui remplace les clés API Anthropic par une authentification Auth0/Okta JWT. Le proxy détient les clés API côté serveur, valide les tokens JWT, route les requêtes vers des clés API basées sur les rôles (developer/tech-lead/po), et tracke la consommation par utilisateur dans SQLite.

## Architecture

```
Developer                      Enterprise Infra                    Anthropic
┌──────────────┐          ┌─────────────────────┐          ┌──────────────────┐
│ CLI Wrapper  │──JWT──►  │  Proxy Server       │──API──►  │ api.anthropic.com│
│ (claude-ent) │◄─resp──  │  • Auth0 JWT valid.  │◄─resp──  │                  │
│              │          │  • Role-based keys   │          │                  │
│ Auth0 Device │          │  • Usage tracking    │          │                  │
│ Flow Login   │          │  • Rate limiting     │          │                  │
└──────────────┘          └─────────────────────┘          └──────────────────┘
       │                         │
       │                         ▼
       ▼                  ┌──────────────┐
  Auth0/Okta              │ SQLite DB    │
  (JWT issuer)            │ (usage logs) │
                          └──────────────┘
```

Claude Code supporte nativement ce pattern via :
- `ANTHROPIC_BASE_URL` — redirige les appels API vers le proxy
- `ANTHROPIC_AUTH_TOKEN` — envoyé comme `Authorization: Bearer` sur chaque requête

## Composants

| Package | Description |
|---------|-------------|
| `packages/proxy` | Serveur Fastify — valide JWT, route par rôle, forward vers Anthropic, log usage |
| `packages/cli` | CLI wrapper — Auth0 device flow login, cache JWT, spawne `claude` |

## Prérequis

- Node.js 22+
- Un tenant Auth0 avec une application Native (device flow) et une API configurée
- Une ou plusieurs clés API Anthropic (Console)

## Installation

```bash
npm install
npm run build
```

## Configuration du proxy

Créer un fichier `.env` à la racine (voir `.env.example`) :

```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://claude-proxy.corp.example.com/api
ROLE_KEYS_CONFIG=./role-keys.json
```

Créer le fichier `role-keys.json` :

```json
{
  "role_keys": {
    "developer":  { "api_key": "sk-ant-...", "description": "Quota standard" },
    "tech-lead":  { "api_key": "sk-ant-...", "description": "Quota élevé" },
    "po":         { "api_key": "sk-ant-...", "description": "Quota limité" },
    "default":    { "api_key": "sk-ant-...", "description": "Fallback" }
  }
}
```

Chaque rôle correspond à une clé API Anthropic avec ses propres limites configurées dans la Console Anthropic.

### Lancer le proxy

```bash
npm run dev:proxy          # Dev avec hot reload
npm start -w packages/proxy  # Production
```

### Docker

```bash
docker build -f packages/proxy/Dockerfile -t claude-enterprise-proxy .
docker run -p 8080:8080 \
  -e AUTH0_DOMAIN=your-tenant.auth0.com \
  -e AUTH0_AUDIENCE=https://claude-proxy.corp.example.com/api \
  -e ROLE_KEYS_CONFIG='{"role_keys":{"default":{"api_key":"sk-ant-...","description":"default"}}}' \
  claude-enterprise-proxy
```

## Configuration du CLI (côté développeur)

```bash
# Installer globalement
npm install -g @claude-enterprise/cli

# Configurer (une seule fois)
claude-enterprise configure \
  --auth0-domain your-tenant.auth0.com \
  --auth0-client-id YOUR_CLIENT_ID \
  --auth0-audience https://claude-proxy.corp.example.com/api \
  --proxy-url https://proxy.corp.example.com

# Utiliser Claude Code à travers le proxy
claude-enterprise            # lance claude en mode interactif
claude-enterprise -p "hello" # mode headless
```

### Commandes CLI

| Commande | Description |
|----------|-------------|
| `claude-enterprise` | Lance Claude Code à travers le proxy (défaut) |
| `claude-enterprise configure` | Configure Auth0 et proxy URL |
| `claude-enterprise login` | S'authentifier via Auth0 device flow |
| `claude-enterprise logout` | Effacer les tokens locaux |
| `claude-enterprise status` | Afficher la configuration actuelle |

## Configuration Auth0

### 1. Créer une API

APIs → Create API :
- Identifier (audience) : `https://claude-proxy.corp.example.com/api`
- Signing Algorithm : RS256
- Activer "Allow Offline Access"

### 2. Créer une Application Native

Applications → Create Application → Native :
- Activer le grant type **Device Code** (Settings → Advanced → Grant Types)
- Noter le **Client ID** (sera distribué aux développeurs)

### 3. Créer les rôles RBAC

User Management → Roles → Create Role :

| Rôle | Description | Quota Anthropic |
|------|-------------|-----------------|
| `developer` | Développeurs | Standard |
| `tech-lead` | Tech leads | Élevé |
| `po` | Product owners | Limité |

Assigner les rôles aux utilisateurs : User Management → Users → sélectionner → Roles → Assign Roles

### 4. Connecter Okta (si applicable)

Authentication → Enterprise → Okta Workforce Identity Cloud.
Les groupes Okta peuvent être mappés vers les rôles Auth0 via des Actions.

### 5. Ajouter une Action Post-Login

Actions → Flows → Login → Add Action → Custom :

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const ns = 'https://claude-proxy.corp.example.com/api';

  api.accessToken.setCustomClaim(`${ns}/email`, event.user.email);

  // Utilise les rôles RBAC natifs d'Auth0
  const roles = event.authorization?.roles || [];
  let claudeRole = 'default';
  if (roles.includes('tech-lead')) claudeRole = 'tech-lead';
  else if (roles.includes('developer')) claudeRole = 'developer';
  else if (roles.includes('po')) claudeRole = 'po';

  api.accessToken.setCustomClaim(`${ns}/role`, claudeRole);
};
```

### 6. Token TTL

APIs → votre API → Settings :
- Access Token Lifetime : 3600s (1h)
- Refresh Token Lifetime : 2592000s (30j), avec rotation activée

## Développement

```bash
npm run build              # Build tous les workspaces
npm run dev:proxy          # Proxy avec hot reload
npm run dev:cli            # CLI en dev
npm test                   # Tests (vitest)
npm run lint               # ESLint
```

## Variables d'environnement du proxy

| Variable | Requis | Défaut | Description |
|----------|--------|--------|-------------|
| `AUTH0_DOMAIN` | Oui | — | Domaine Auth0 |
| `AUTH0_AUDIENCE` | Oui | — | Identifiant de l'API Auth0 |
| `ROLE_KEYS_CONFIG` | Oui | — | Chemin vers JSON ou JSON inline (mapping rôle → clé API) |
| `PORT` | Non | `8080` | Port du serveur |
| `DATABASE_PATH` | Non | `./data/usage.db` | Chemin de la base SQLite |
| `RATE_LIMIT_RPM` | Non | `60` | Requêtes/min par utilisateur |
| `ANTHROPIC_UPSTREAM_URL` | Non | `https://api.anthropic.com` | URL upstream (utile pour les tests) |
| `LOG_LEVEL` | Non | `info` | Niveau de log (fatal/error/warn/info/debug/trace) |

## Endpoints du proxy

| Méthode | Path | Auth | Description |
|---------|------|------|-------------|
| `POST` | `/v1/messages` | JWT | Proxy vers Anthropic Messages API (streaming + non-streaming) |
| `POST` | `/v1/messages/count_tokens` | JWT | Proxy vers token counting |
| `GET` | `/health` | Non | Health check |

## Licence

MIT
