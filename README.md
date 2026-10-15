# Team Dashboard

Internal task, attendance and delivery-tracking dashboard. Product spec: `docs/SPEC.md`. Backend: Firebase (Auth + Firestore), rules in `firestore.rules`.

## One-time Firebase setup (about 10 minutes, free plan)
1. Go to <https://console.firebase.google.com> -> **Add project** (turn Google Analytics off).
2. **Build -> Authentication -> Get started -> Email/Password -> Enable.**
3. **Build -> Firestore Database -> Create database** (production mode, any region near you).
4. **Project settings -> Your apps -> Web (`</>`)** -> register an app. Copy the config values.
5. Locally: `cp .env.example .env.local` and fill in the four values.
6. Install the Firebase CLI and publish the security rules (nothing works without them):
   ```bash
   npm install
   npx firebase login
   npx firebase use --add          # pick your project
   npx firebase deploy --only firestore:rules
   ```

## Run it locally
```bash
npm run dev      # http://localhost:3000
```
1. **Create an account** on the login page. New accounts start inactive.
2. Make yourself the first admin: Firebase console -> Firestore -> `users` -> your document -> set `role` to `admin` and `active` to `true`. The app updates immediately.
3. Use **Team** to approve everyone else, **Clients** to add clients and projects, then **Tasks -> New task**.

## Deploy (Firebase Hosting)
```bash
npm run build                          # static site in ./out
npx firebase deploy --only hosting,firestore:rules
```
Your site is at `https://<project-id>.web.app`.

## Tests
```bash
npm test                 # security rules, against the Firestore emulator (needs Java)
npm run dev:emulator     # terminal 1: app wired to local emulators
npm run test:e2e         # terminal 2: full browser test (sign-up -> tasks -> review -> attendance -> Excel)
```
