# Crackers Shop Project Guide

## 1. Project overview

Crackers Shop is a Tamil/English storefront and shop-management application. It
uses static HTML, CSS, and browser JavaScript for the interface, a Node.js HTTP
server for its API, and PostgreSQL for persistent records.

The customer storefront and admin dashboard are single-page interfaces: each
has one HTML entry point, while JavaScript renders the different views and
interactions. They are served by the same Node.js process and deployment.

## 2. Project structure

```text
crackers-shop/
├── frontend/
│   ├── customer/
│   │   └── index.html
│   ├── admin/
│   │   └── dashboard.html
│   ├── css/
│   │   ├── style.css
│   │   ├── admin.css
│   │   └── theme.css
│   └── js/
│       ├── shop.js
│       ├── admin.js
│       ├── common.js
│       ├── i18n.js
│       ├── admin-i18n.js
│       └── fireworks.js
├── backend/
│   ├── config/
│   │   └── database.js
│   ├── middleware/
│   │   └── http-error.js
│   ├── models/
│   │   └── seed.js
│   ├── routes/
│   │   └── static-routes.js
│   ├── services/
│   │   └── password-service.js
│   ├── utils/
│   │   └── data-utils.js
│   ├── test/
│   │   ├── data-utils.test.js
│   │   ├── static-routes.test.js
│   │   └── database.integration.test.js
│   ├── app.js
│   └── server.js
├── data/                 Runtime data, local DB URL, uploads, and backups
├── docs/
│   └── PROJECT_GUIDE.md
├── .gitignore
├── config.bat             Local Windows settings
├── setup.bat              Local dependency/setup helper
├── start.bat              Local Windows launcher
├── stop.bat               Local Windows shutdown helper
├── package.json
├── package-lock.json
└── README.md
```

The project is a **modular monolith**: it runs as one application, with some
shared responsibilities separated into modules. It is not full MVC yet. Most
API handlers and business operations still live in `backend/app.js`; the
folders for controllers, repositories, or validators have not been added as
empty placeholders.

## 3. Frontend code

### Entry pages

- `frontend/customer/index.html` is the storefront shell. It contains the
  customer-facing page regions, account and checkout interfaces, and references
  the shared CSS and JavaScript.
- `frontend/admin/dashboard.html` contains the admin login, password recovery,
  and dashboard shell. Product management, billing, orders, and settings are
  views rendered inside this page.
- The server maps `/` and `/customer/` to the storefront and `/admin` to the
  admin dashboard. Existing root-relative CSS and JavaScript URLs therefore
  continue to work after the files were moved.

### Stylesheets

- `frontend/css/style.css` styles the storefront, product views, cart, account,
  and checkout.
- `frontend/css/admin.css` styles the admin login and management interface.
- `frontend/css/theme.css` contains shared theme elements, including password
  visibility controls and common presentation rules.

### Browser JavaScript

- `frontend/js/common.js` provides shared DOM helpers, API requests, toast
  notifications, password visibility controls, and date/currency formatting.
- `frontend/js/shop.js` loads storefront data and handles customer login,
  registration, email-code verification, cart, checkout, and order history.
- `frontend/js/admin.js` handles admin login, dashboard data, billing, order
  status changes, product and stock management, settings, exports, and backup
  interactions.
- `frontend/js/i18n.js` and `frontend/js/admin-i18n.js` provide Tamil/English
  text for the customer and admin interfaces.
- `frontend/js/fireworks.js` provides the decorative fireworks effect.

The browser calls the backend API using `fetch`. Session cookies are sent by
the browser, and JSON API errors are displayed through the shared UI helpers.

## 4. Backend code

- `backend/server.js` is the process entry point. It calls `startServer()` and
  reports startup failures.
- `backend/app.js` creates the HTTP server, maps static URLs, handles API
  routes, performs business operations, initializes PostgreSQL, and creates
  backups. This is currently the main application module.
- `backend/config/database.js` reads `DATABASE_URL`, or falls back to the
  private `data/database-url.txt` file for local development, and creates the
  PostgreSQL connection pool.
- `backend/models/seed.js` contains initial categories and sample products.
- `backend/services/password-service.js` hashes and checks passwords with
  Node.js `crypto.scrypt`.
- `backend/middleware/http-error.js` represents an HTTP error with a response
  status. The server translates it into an API error response.
- `backend/routes/static-routes.js` maps storefront and admin URL aliases to
  their HTML files.
- `backend/utils/data-utils.js` contains reusable date, category-ordering, and
  stock-adjustment helpers.

On startup, `startServer()` checks the database configuration, ensures the
schema exists, loads the saved state, and creates a backup. It also schedules
regular backups. Each request is routed to the API, an uploaded image, or a
static page. Known `HttpError` instances become localized HTTP responses;
unexpected errors are logged and returned as server errors. During shutdown,
the app closes the HTTP server, saves pending state, and closes the database
pool.

Static routes are:

| URL | Page |
| --- | --- |
| `/` or `/customer/` | Customer storefront |
| `/admin` | Admin dashboard and login |
| `/product-images/<file>` | Uploaded product image |
| `/shop-images/<file>` | Uploaded shop logo |

The API routes are currently dispatched inside `backend/app.js`, rather than
being split into separate feature route/controller files.

## 5. Main features and workflows

### Customer storefront

Visitors can view the shop promotion, ordering instructions, and safety
information. Signed-in customers can browse active products, choose categories,
manage a cart, view previous orders, and view their account/contact information.
Customers provide or update their phone number and delivery address at checkout.

The interface supports Tamil and English. Shop names, product names, seasonal
titles, prices, and discount display use the language and settings configured
for the shop.

### Customer accounts

1. A customer submits their name, email, password, and password confirmation.
2. The server validates the fields, hashes the password, and sends a six-digit
   email verification code.
3. The code expires after 10 minutes, can be resent after a 60-second cooldown,
   and has a limited number of verification attempts.
4. After verification, the customer can sign in with email. A phone number can
   also be used after it has been added at checkout.

Customer OTP state and web sessions are held in server memory. Pending OTPs and
sessions are therefore lost on server restart.

### Checkout and online orders

Checkout requires the customer's mobile number and delivery address. The server
checks the customer session, validates the contact details and cart, checks
current product stock and the minimum order amount, then creates the order and
reduces stock. The customer profile is updated with the checkout contact
details for later orders.

Order statuses used by the admin interface are `new`, `confirmed`, `packed`,
`delivered`, and `cancelled`. Cancelling an order restores stock; reopening a
cancelled order checks that stock is available before reducing it again.

### Admin and counter billing

The admin portal is available at `/admin`; it is not linked from the public
storefront footer. Admin functions include:

- Dashboard metrics, recent sales, popular products, and low-stock information.
- Counter/POS bills with payment type and optional extra discount.
- Online order review and status updates.
- Product creation, editing, hiding, deletion, photos, and stock adjustments.
- Stock movement history.
- Shop settings, admin password changes, and password recovery by email link.
- Filtered Excel export and downloadable JSON backup.

The default initial admin password is `admin123`. Change it immediately after
the first setup.

## 6. API overview

All API routes use JSON for request bodies unless they return a file or backup.

| Route | Purpose |
| --- | --- |
| `GET /api/public` | Public shop settings, categories, and active products |
| `POST /api/orders` | Submit a signed-in customer's order |
| `POST /api/customer/register` | Start customer registration and send OTP |
| `POST /api/customer/register/resend` | Resend registration OTP |
| `POST /api/customer/register/verify` | Verify OTP and create/sign in customer |
| `POST /api/customer/login` | Customer sign-in |
| `POST /api/customer/logout` | Customer sign-out |
| `GET /api/customer/me` | Current customer session/profile |
| `GET /api/customer/orders` | Current customer's order history |
| `POST /api/login`, `POST /api/logout`, `GET /api/me` | Admin session operations |
| `GET /api/admin/data` | Admin dashboard data |
| `GET /api/admin/stock-movements` | Paginated stock movement history |
| `/api/admin/products` | Create, update, delete, or adjust product stock |
| `POST /api/admin/bills` | Create a counter sale |
| `PUT /api/admin/orders/<id>` | Change an online order status |
| `PUT /api/admin/settings` | Update shop settings |
| `POST /api/admin/password` | Change admin password |
| `GET /api/admin/export` | Download filtered Excel report |
| `GET /api/admin/backup` | Download JSON backup |
| `/api/admin/password-reset/*` | Request or complete admin password recovery |

Most admin API routes require an admin session. Customer order routes require a
customer session.

## 7. PostgreSQL and data flow

### Tables

The application creates its schema in `ensureSchema()` in `backend/app.js`:

- `shop_state`: settings, counters, and category ordering.
- `shop_categories`, `shop_products`, `shop_customers`, `shop_orders`,
  `shop_bills`, and `shop_stock_movements`: records with JSONB data and selected
  indexed columns.
- `admin_password_resets`: hashed reset tokens and expiration times.

Indexes support order and bill dates, customer order lookup, stock movement
queries, and customer email/phone uniqueness.

### Startup and persistence

At startup the application creates missing tables and loads PostgreSQL data
into an in-memory application state. If the database has not yet been
initialized, the app imports `data/db.json` when present; otherwise it starts
from the seed data.

When data changes, `saveDb()` takes a snapshot. A save queue serializes snapshot
writes within this Node.js process. `persistSnapshot()` compares the snapshot
with the previous saved state and writes the changed rows inside a PostgreSQL
`BEGIN` / `COMMIT` transaction, rolling back if a database write fails. The
password-reset token consumption flow also uses a transaction and an advisory
lock.

The snapshot transaction makes each database save atomic, but the application
still uses in-memory state as its working copy. It is designed for a
single-server process; multiple app instances do not share the same current
state or sessions and can make conflicting inventory decisions.

There are no business-data triggers or foreign keys in the current schema.
Inventory movements are written by application code. The app keeps a recent
movement list in memory, while historical movement rows remain in PostgreSQL;
plan storage and retention as the history grows.

### Images and backups

Uploaded product photos and shop logos are stored as files under `data/`, not
inside PostgreSQL. Database records refer to those image paths. Daily JSON
backups include the database snapshot and image data; the admin portal also
offers a downloadable backup. Keep the database and `data/` directory together
when restoring or moving the shop.

The downloadable admin backup omits password hashes. Local daily backups retain
the application snapshot, including password hashes required for account
restoration. Restrict access to local backups and protect them like other
customer/shop data.
Do not commit live customer data, database URLs, or backup files to source
control.

## 8. Configuration and deployment

### Local Windows setup

Requirements: Windows, Node.js 24 or newer, and PostgreSQL 17.

1. Create a PostgreSQL database named `crackers_shop`.
2. Run `setup.bat`. On first setup, it copies the example connection string to
   `data/database-url.txt`; replace the placeholder password with your local
   PostgreSQL password.
3. Run `start.bat` to start the server; `stop.bat` stops it.
4. Open `http://localhost:5280/`; use `http://localhost:5280/admin` for admin.

`data/database-url.txt` is private and ignored by Git. It is a local alternative
to setting `DATABASE_URL`.

### Hosted deployment

The hosting platform should provide Node.js 24+, PostgreSQL, and environment
variables. Install with `npm ci --omit=dev` and start with `npm start`.

Important environment variables:

| Variable | Use |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Port supplied by the hosting platform; defaults to `5280` |
| `HOST` | Bind address; set to `0.0.0.0` if required by the host |
| `RESEND_API_KEY`, `EMAIL_FROM` | Preferred hosted email provider; uses Resend over HTTPS |
| `SMTP_HOST`, `SMTP_FROM` | Optional SMTP email configuration |
| `SMTP_PORT`, `SMTP_SECURE` | SMTP connection settings; port defaults to `587` |
| `SMTP_USER`, `SMTP_PASS` | Optional SMTP authentication pair |
| `PUBLIC_BASE_URL` | Required for admin password recovery links |
| `DATA_DIR` | Optional path for uploads, backups, PID file, and local DB URL fallback |

The app reads `process.env`; it does not automatically load a `.env` file.
Configure secrets in the hosting dashboard or set them in the shell that starts
the app. Use a persistent writable volume for `DATA_DIR`. The Windows batch
launcher redirects console output to `data/server.log`.

## 9. Testing

Run the unit tests with:

```text
npm test
```

The PostgreSQL integration test is skipped unless `TEST_DATABASE_URL` is set
to a dedicated test database whose name contains `test` as a separate
underscore/hyphen-delimited word, such as `crackers_shop_test`. It creates an
isolated schema and temporary data directory, starts the actual server, checks
that concurrent sales cannot sell the last unit twice, and forces a database
failure to verify transaction rollback. It then removes the schema and temp
files.

For PowerShell, set the test URL before running the suite:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://user:password@localhost:5432/crackers_shop_test'
npm test
```

Never use a production database URL for the integration test.

## 10. Current limitations to keep in mind

- The backend is a modular monolith, not a fully split controller/service/
  repository design. API handling remains in `backend/app.js`.
- The in-memory data model and sessions make the app single-instance oriented.
  Shared sessions and database-level stock locking are needed before scaling
  horizontally.
- PostgreSQL writes are transactional at snapshot-persistence time, but the
  app is not yet a normalized, database-first transaction model for each
  business operation.
- Stock-movement history is not currently pruned in PostgreSQL.
- Customer OTPs and sessions are lost when the process restarts.
