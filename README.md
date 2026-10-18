# Tire Shop System — Frontend

An Angular 19 application for managing a tire workshop: products, stock locations, purchases, sales, quotations, documents, accounting reports and users. The interface uses Tailwind CSS and daisyUI and supports light/dark themes. The UI remains in Spanish. The backend's catalogs and invoice interpretation currently target El Salvador.

This folder is an independent frontend project. The matching backend lives in `../back` in the local workspace; each folder can be published as its own repository. Sibling README links below refer to this local checkout; replace them with the matching repository URLs when publishing separately. Run all commands below from the frontend root. This project is licensed under AGPL-3.0-only; see [LICENSE](LICENSE).

## Requirements before installation

- Node.js **22.12 or newer in the Node 22 line** and pnpm **10.13.1**.
- The matching backend installed, migrated, seeded and running. Follow its [README](../back/README.md) first. The backend setup uses Docker Compose for PostgreSQL and Floci; the frontend itself runs on the host.
- A browser; Chrome/Chromium is also needed for headless unit tests. Optional Playwright browsers are installed separately for end-to-end tests.
- Port `4200` available, with the backend allowing `http://localhost:4200` as `FRONTEND_BASE_URL`.

Use pnpm consistently. The repository currently includes an inherited npm lockfile too; the supplied CI and documented installation use `pnpm-lock.yaml`.

## Development setup

### 1. Install dependencies

```sh
corepack enable
corepack prepare pnpm@10.13.1 --activate
pnpm install --frozen-lockfile
```

### 2. Check the API URL

Development uses `src/environments/environment.development.ts`:

```ts
export const environment = {
  baseUrl: 'http://localhost:3000/api',
};
```

`src/environments/environment.example.ts` is a safe reference. The API URL includes `/api`; do not add another `/api` in services. Keep `localhost` consistent with the backend's CORS origin. Environment files in this Angular application are **public build configuration**, not a secret store: never add database URLs, JWT secrets, Resend keys or AWS credentials.

### 3. Start the application

```sh
pnpm start
```

Open `http://localhost:4200`. Sign in with the administrator email configured during backend seeding and the password used to generate its default hash. There is no universal administrator password in this copy.

The router uses hash navigation, for example `/#/products/list`. The backend must be running for API requests; serving this frontend does not start it.

## Essential commands

```sh
pnpm start
pnpm lint
pnpm exec ngc -p tsconfig.app.json --noEmit --incremental false
pnpm exec tsc -p tsconfig.spec.json --noEmit --incremental false
pnpm exec ng test --no-watch --no-progress --browsers=ChromeHeadless
pnpm run build
```

The production build is generated in **`dist/tire-workshop-frontend/browser`**. Deploy this directory's contents, including PDF.js worker/wasm/font assets. Do not upload `node_modules`, TypeScript sources or the parent `dist` directory as a substitute for the browser output.

For the optional Playwright suite:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

Some end-to-end tests mock backend requests; they do not replace testing a real frontend/backend installation. The Playwright configuration can start a development server; stop or account for an existing server on port 4200 before debugging server-start failures.

## Customize the business identity

Edit `src/app/shared/consts/branding.const.ts`:

```ts
export const APP_BRANDING = {
  name: 'Your Tire Shop',
  lightLogoUrl: '/images/company-logo/logo-light.svg',
  darkLogoUrl: '/images/company-logo/logo-dark.svg',
} as const;
```

Put the matching files under `public/images/company-logo/`. No business logos are supplied. Leaving either logo URL empty shows the configured business name for that theme. Use transparent SVG or PNG assets with the same proportions and comfortable internal spacing; provide a dark-text logo for a light background and a light-text logo for a dark background. Check readability in both themes and at navbar size.

Route titles, footer and the logo fallback use the branding constant. Also update the initial `<title>` in `src/index.html`, which is shown before Angular selects the route title. For a favicon, add your own `public/images/favicon.ico` and replace the empty favicon link in `src/index.html` with:

```html
<link rel="icon" type="image/x-icon" href="images/favicon.ico" />
```

Company contact/tax details used in business documents belong in the backend's company settings, not in frontend source code. The footer's author credit does not replace the license and copyright notices.

## Recommended deployment: Cloudflare Pages

### 1. Configure production before building

Set `src/environments/environment.ts` to the real HTTPS API URL:

```ts
export const environment = {
  baseUrl: 'https://api.example.com/api',
};
```

The default supplied URL points to localhost deliberately; replace it before production deployment. `pnpm run build` uses the production configuration. Changing a Cloudflare dashboard environment variable alone does **not** rewrite this TypeScript object; that would require an explicit build-time generation mechanism, which is not included.

Configure the backend's `FRONTEND_BASE_URL` to your final frontend origin, such as `https://app.example.com`. Use HTTPS for both applications. Related subdomains (`app.example.com` and `api.example.com`) are preferable for cookie sessions; unrelated `pages.dev` and API Gateway domains can encounter browser cross-site-cookie restrictions. CORS and cookie storage are separate concerns. See the backend [deployment guide](../back/README.md#recommended-production-deployment-aws-lambda--http-api) for API Gateway, IAM, S3 and domain setup.

### 2. Verify the release

```sh
pnpm lint
pnpm exec ng test --no-watch --no-progress --browsers=ChromeHeadless
pnpm run build
```

The current build may report existing initial-budget, CSS-selector and icon warnings. Review them; do not treat a successful build as proof that every screen was tested. Check sign-in, session refresh, a product image, a PDF/JSON preview, and document downloads after the deployment.

### 3. Publish the browser output

For Cloudflare Pages **Git integration**, create a Pages project from the frontend repository, choose your production branch, use Node 22 and pnpm 10.13.1, set the build command to `pnpm install --frozen-lockfile && pnpm run build`, and set the build output directory to **`dist/tire-workshop-frontend/browser`**. If publishing both projects in one repository, set the Pages root directory to `front`; otherwise the frontend repository root is already correct.

For a separate **Direct Upload** Pages project, you can build locally and use Wrangler:

```sh
pnpm dlx wrangler login
pnpm dlx wrangler pages project create YOUR_PAGES_PROJECT --production-branch main
pnpm dlx wrangler pages deploy dist/tire-workshop-frontend/browser --project-name YOUR_PAGES_PROJECT
```

Replace the project name and branch. Choose Git integration or Direct Upload when creating the project; Cloudflare documents restrictions on switching between the two afterward. Wrangler is the CLI for the Pages commands above; installing an AWS SDK or adding cloud credentials to Angular is unnecessary.

After the initial deployment, attach your frontend custom domain in Pages and complete its DNS setup. Coordinate the final origin with backend CORS and, for direct signed document previews, the sales-document bucket's read CORS configuration. Frontend hosting does not create or authorize access to AWS resources.

### 4. Understand the supplied workflow

`.github/workflows/ci.yml` installs dependencies, runs lint/tests and builds the frontend. It does **not** deploy to Cloudflare. Git-integrated Pages can handle deployment itself. If adding a GitHub Actions deployment later, use a Cloudflare token scoped to Pages access for the intended account, plus the account ID and actual Pages project name, in repository secrets/variables; never expose that token in the application.

The supplied workflow assumes the frontend is at the root of its own repository. If both folders are published in one repository, move workflows into the root `.github/workflows` and adapt paths/working directories. GitHub does not discover workflows under `front/.github/workflows` from the parent repository.

## Troubleshooting

- **Blank page or login loop:** confirm the compiled API URL, backend availability, exact CORS origin, HTTPS and cookie behavior. Inspect the browser Network panel.
- **Requests go to localhost after deployment:** update `environment.ts`, rebuild and redeploy. Runtime hosting variables do not change an already generated bundle.
- **Product images return AccessDenied:** consult the backend image-access policy; the browser does not inherit the Lambda execution role.
- **PDF viewer keeps loading:** verify that the complete build output was deployed, including `assets/pdfjs-6.4.299-legacy/`, and inspect the document request and browser CORS errors. Restart `pnpm start` after changing Angular's asset configuration.
- **Tests cannot find Chrome:** install Chrome/Chromium or set `CHROME_BIN` to the local executable.
- **Port 4200 is in use:** stop the other development server, or change the port and the backend's allowed frontend origin together.
- **Old favicon remains:** inspect the generated icon URL, redeploy the new asset and refresh the browser cache.

## License

Copyright (c) 2026 josers77j.

The original code in this project is licensed under the **GNU Affero General Public License, version 3 only** (`AGPL-3.0-only`). You may use, modify and redistribute it, including commercially, under that license. See the complete [LICENSE](LICENSE) text for the terms and the absence of warranty.

When distributing covered versions, comply with the applicable corresponding-source and license-notice requirements. If you deploy a modified version that users interact with over a network, offer those users access to the corresponding source for the deployed version as required by section 13. A link to an unrelated or outdated source snapshot does not describe the version they are using. Source availability does not mean publishing application secrets or customer data.

Third-party dependencies and bundled assets retain their own licenses and notices; this project license does not replace them.

## Official references

- [Angular local setup](https://angular.dev/tools/cli/setup-local)
- [Cloudflare Pages: Angular](https://developers.cloudflare.com/pages/framework-guides/deploy-an-angular-site/)
- [Cloudflare Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Cloudflare Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [GitHub workflow location and syntax](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions)
