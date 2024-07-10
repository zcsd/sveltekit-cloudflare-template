# Just In Case: A SvelteKit & Cloudflare Template

If you are looking for a SvelteKit template that perfectly integrates Cloudflare Pages & KV & D1 database & Workers & Queues & R2 storage, then you are in the right place.

## Tech Stack

- Web Framework: SvelteKit
- CSS / Styling
  - Framework: TailwindCSS
  - Component library: DaisyUI
- Hosting Stack (Everything in Cloudflare)
  - Host + CDN: Cloudflare Pages
  - Database: Cloudflare D1
  - KV: Cloudflare KV
  - Storage: Cloudflare R2
  - Queue: Cloudflare Queues
  - Serverless compute: Cloudflare Workers
  - CAPTCHA: Cloudflare Turnstile
- Payments
  - Stripe Checkout
  - Stripe Portal
  - Stripe Webhooks
- Email
  - Resend Email API

## Demo

You can explore all the features using the fully functional demo [justincase.top](https://justincase.top).

[![Try it Now](https://img.shields.io/badge/Try_it_Now-37a779?style=for-the-badge "Try it Now")](https://justincase.top)

## Quick Start

### Get Started (Local Development)

Firstly, prepare the project files and install the dependencies:

```
# clone or download the repository before accessing it
$ cd sveltekit-cloudflare-template
# install dependencies
$ npm install
# all the dependencies will be installed including wrangler tool
```

Then, prepare and create the necessary services:

- Create [Resend](https://resend.com/) email service and get the API key (for `RESEND_API_KEY`).
- Create [Stripe](https://stripe.com/) account and get the API key (for `PRIVATE_STRIPE_API_KEY`).
- Prepare a local Cloudflare D1 database and tables:
  
  ```
  # create a new D1 database named example_db
  $ npx wrangler d1 create example_db
  # create all the necessary tables in the local D1 database
  # read all comments explained in example-wrangler.toml file
  $ npx wrangler d1 execute example_db --local --file=./db_schema/schema.sql
  ```

Next, prepare the environment variables and configuration files:

```
# create an env file from the example
$ cp example.dev.vars .dev.vars
# manually change the values in the .dev.vars file
# JWT secret should be at least 32 characters long and randomly generated
# LARK_BOT_URL and STRIPE_WH_SECRET can be empty or anything for development

# create a wrangler.toml file from the example
$ cp example.wrangler.toml wrangler.toml
# manually change the values in the wrangler.toml file

# change configuration in /src/config.js
# you may want to change WEBSITE_NAME, APP_DOMAIN variables
```

Finally, there are two methods to run the project locally:

```
# Method 1 (recommended and sufficient):
# start the vite development server
$ npm run dev -- --host
# access it at http://localhost:5173 in local machine
# or access it at http://<machine-ip>:5173 in local network
# dev = true in this method (import { dev } from "$app/environment";)
# local ENV, KV, D1 will be used
# it's good to use this method for development in most cases

# Method 2:
# build the project
$ npm run build
# .svelte-kit/cloudflare/ will be generated after the build
# start the wrangler pages dev server
$ npx wrangler pages dev --ip 0.0.0.0 --port 8787 --live-reload .\.svelte-kit\cloudflare\
# access the website at http://localhost:8787 or http://<machine-ip>:8787
# dev = false in this method (import { dev } from "$app/environment";)
# local ENV, KV, D1 will be used
```