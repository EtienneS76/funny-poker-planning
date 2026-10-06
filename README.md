# Ping / Pong

Socle minimal React 19, Vite 8, TypeScript 7 et Convex.

## Demarrage

Prerequis : Node.js 24 ou plus recent et Yarn.

```sh
yarn install
yarn dev:convex
```

Au premier lancement, suivre la configuration Convex. La CLI cree
`.env.local` avec `VITE_CONVEX_URL` et deploie la fonction `ping`.
Garder cette commande active pour synchroniser le backend.

Dans un autre terminal :

```sh
yarn dev
```

Ouvrir l'URL affichee par Vite. Le bouton `Ping` appelle la query Convex
`ping:ping` et affiche `pong` lorsque le backend repond. Sans
`VITE_CONVEX_URL`, le bouton reste desactive.

## Verification

```sh
yarn typecheck
yarn build
```

## Docker

```sh
docker build --build-arg VITE_CONVEX_URL=https://VOTRE-DEPLOIEMENT.convex.cloud -t ping-pong .
docker run --rm -p 8080:80 ping-pong
```

Le backend Convex doit etre accessible depuis le navigateur. Sa configuration
locale et les fichiers `.env` ne sont pas inclus dans l'image.
