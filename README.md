# Funny Poker Planning

<img width="1512" height="834" alt="image" src="https://github.com/user-attachments/assets/1f190786-6c20-4832-a12c-93c6be97bfa8" />

Application collaborative de planning poker, avec React, TypeScript, Vite et
Convex. La connexion se fait avec GitHub via Better Auth.

## Demarrage local

Prerequis : Node.js 24+ et Yarn.

```sh
yarn install
yarn dev:convex
```

Dans un second terminal :

```sh
yarn dev
```

## Connexion GitHub

Creer une [OAuth App GitHub](https://github.com/settings/applications/new) avec :

- Homepage : `http://127.0.0.1:5173`
- Callback : `http://127.0.0.1:3211/api/auth/callback/github`

Configurer ces variables dans l'environnement Convex :

```sh
yarn convex env set SITE_URL http://127.0.0.1:5173
yarn convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
yarn convex env set GITHUB_CLIENT_ID "..."
yarn convex env set GITHUB_CLIENT_SECRET "..."
```

Creer le secret Better Auth une seule fois et ne jamais commiter les identifiants
GitHub. Dans `.env.local`, definir les URL du backend local :

```dotenv
VITE_CONVEX_URL=http://127.0.0.1:3210
VITE_CONVEX_SITE_URL=http://127.0.0.1:3211
```

En production, remplacer ces URL par celles du deploiement Convex (`.convex.cloud`
et `.convex.site`) et utiliser l'origine HTTPS du site pour `SITE_URL` et la
configuration OAuth.

## Commandes utiles

```sh
yarn gen         # regenerer les types Convex
yarn typecheck   # verifier les types
yarn build       # compiler l'application
```
