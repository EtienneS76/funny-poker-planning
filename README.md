# Connexion GitHub

React, Vite, TypeScript et Convex avec Better Auth. GitHub est le seul
fournisseur de connexion. Aucun acces aux depots ou aux issues n'est demande.

## Demarrage

Prerequis : Node.js 24 ou plus recent et Yarn.

```sh
yarn install
yarn dev:convex
```

Garder Convex actif et lancer Vite dans un autre terminal :

```sh
yarn dev --host 127.0.0.1
```

## Configuration OAuth

1. Creer une OAuth App sur https://github.com/settings/applications/new.
2. En local, utiliser `http://127.0.0.1:5173` comme Homepage URL et
   `http://127.0.0.1:3211/api/auth/callback/github` comme callback URL.
3. Dans le dashboard du deploiement Convex, renseigner `GITHUB_CLIENT_ID`
   et `GITHUB_CLIENT_SECRET`. Ne jamais les placer dans une variable `VITE_*`
   ni les commiter.
4. Configurer l'origine du frontend et un secret Better Auth unique :

```sh
yarn convex env set SITE_URL http://127.0.0.1:5173
yarn convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
```

Generer le secret une seule fois : le changer invalide les sessions et affecte
les tokens OAuth chiffres. Ne pas remplacer un secret deja configure.

Dans `.env.local`, verifier les URL publiques :

```dotenv
VITE_CONVEX_URL=http://127.0.0.1:3210
VITE_CONVEX_SITE_URL=http://127.0.0.1:3211
```

Ces ports sont ceux du backend local actuel. Pour un deploiement cloud,
utiliser l'URL `.convex.cloud` pour `VITE_CONVEX_URL` et l'URL
`.convex.site` pour `VITE_CONVEX_SITE_URL`. Le callback GitHub doit pointer
vers `<VITE_CONVEX_SITE_URL>/api/auth/callback/github`, pas vers Vite.

En production, configurer aussi `SITE_URL` avec l'origine HTTPS exacte du
frontend. Utiliser des configurations GitHub et des secrets distincts entre
developpement et production. Garder la meme origine dans le navigateur et
`SITE_URL` : `localhost` et `127.0.0.1` ne sont pas interchangeables.

Une fois configure, ouvrir la page, cliquer sur `Se connecter` et autoriser
GitHub. La page affiche le login GitHub et l'avatar, puis permet de se
deconnecter. La session est geree par Better Auth, pas par un etat React local.

## Organisation

- `src/features/auth/auth-client.ts` : client Better Auth.
- `src/features/auth/Account.tsx` : interface de connexion et compte.
- `src/Home.tsx` : composition de la page.
- `convex/auth.ts` : fournisseur GitHub, session et profil expose.
- `convex/auth.config.ts` et `convex/convex.config.ts` : integration Convex.
- `convex/http.ts` : routes OAuth avec CORS.

Le pseudo provient du champ GitHub `login`, pas du nom complet. La query
`currentUser` verifie la session et ne renvoie que le pseudo et l'avatar.
Les tokens OAuth sont chiffres cote serveur. Les nouvelles fonctions
applicatives protegees doivent verifier l'identite et les droits cote serveur :
afficher une page uniquement aux utilisateurs connectes ne suffit pas.

Les fonctions de demonstration `convex/message.ts` restent publiques ; elles
ne sont plus appelees par la page de connexion.

Integration documentee : https://labs.convex.dev/better-auth/framework-guides/react.
Les versions Better Auth et de son integration sont epinglees pour conserver
leur compatibilite ; les mettre a jour ensemble.

## Verification

```sh
yarn gen
yarn typecheck
yarn build
```

## Docker

```sh
docker build --build-arg VITE_CONVEX_URL=https://VOTRE-DEPLOIEMENT.convex.cloud --build-arg VITE_CONVEX_SITE_URL=https://VOTRE-DEPLOIEMENT.convex.site -t github-auth .
docker run --rm -p 8080:80 github-auth
```

Le backend Convex doit etre accessible depuis le navigateur. Sa configuration
locale et les fichiers `.env` ne sont pas inclus dans l'image.
