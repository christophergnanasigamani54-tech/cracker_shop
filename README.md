# Crackers Shop Software

Tamil website and counter billing application.

For detailed architecture, feature, API, database, and deployment documentation,
see the [Project Guide](docs/PROJECT_GUIDE.md).

## Project layout

```text
frontend/
  customer/           Customer storefront
  admin/              Admin dashboard
  css/                Application stylesheets
  js/                 Storefront and admin scripts
backend/
  config/             Database connection settings
  middleware/         HTTP error types and request middleware
  models/             Seed data and domain models
  routes/             Static route mappings
  services/           Password services
  utils/              Shared backend helpers
  test/               Backend tests
  app.js              HTTP application and API routes
  server.js           Server startup
data/                 Persistent database configuration, uploads, and backups
package.json          Root install, test, and start commands
```

The `data/` directory remains at the project root so local and hosted deployments
can persist uploads and backups independently from application source files.
The storefront is served at `/` and `/customer/`; the admin dashboard is served at `/admin`.
Keep secrets in environment variables or the private local `data/database-url.txt` file,
not in source control.

Local setup requires: Windows + Node.js 24 LTS + PostgreSQL 17.

FIRST TIME
  1. Install PostgreSQL 17 and use pgAdmin to create a database named  crackers_shop
     (the PostgreSQL installer is available at https://www.postgresql.org/download/windows/)
  2. Double-click  setup.bat. The first run creates and opens
     data\database-url.txt. Replace YOUR_PASSWORD with the password you set during
     PostgreSQL installation, save, then run setup.bat again.
     URL-encode special characters in the password. Keep this file private.
  3. Double-click  start.bat      (browser opens automatically)

  On first start, existing data\db.json is imported into an empty PostgreSQL database.
  The original JSON file is kept unchanged.

DAILY USE
  start.bat  -> starts the server  (http://localhost:5280/)
  stop.bat   -> stops the server

SERVER DEPLOYMENT (LINUX OR MANAGED HOST)
  Use Node.js 24 or newer and a PostgreSQL 17 database. Set DATABASE_URL as a
  private environment variable, then install and start the app:

    npm ci --omit=dev
    npm start

  The server reads PORT from the host environment and defaults to 5280. Set HOST=0.0.0.0
  when the host requires binding to all interfaces. Keep the data folder writable and
  persistent for product images, shop logos, and local backups. PostgreSQL stores the
  shop records. Never commit database credentials or production customer data.
  Customer email verification requires SMTP_HOST and SMTP_FROM; SMTP_PORT defaults to 587.
  Set SMTP_USER and SMTP_PASS if your relay requires authentication, and SMTP_SECURE=true for
  implicit TLS (usually port 465); port 587 defaults to STARTTLS. Admin password recovery
  also requires PUBLIC_BASE_URL and a recovery email saved in Admin > Settings. Do not
  commit SMTP credentials. See `.env.example` for the variable names; it is a reference
  template only and is not loaded automatically.

TESTS
  npm test runs unit tests and skips the PostgreSQL integration test unless
  TEST_DATABASE_URL points to a dedicated test database whose name contains "test".
  The integration test creates and removes an isolated schema and temporary data folder.
  Never point TEST_DATABASE_URL at a production database.

ADDRESSES
  Shop website : http://localhost:5280/
  Admin panel  : http://localhost:5280/admin
  Default admin password: admin123   (CHANGE IT: Admin > Settings)

ADMIN FEATURES
  Dashboard      - today's sales, 7-day chart, top products, low stock
  Billing        - counter bills, extra discount, payment mode, thermal 80mm print
  Online orders  - customer orders from the website, status tracking, auto stock
  Products       - add / edit / delete, stock, per-product discount, product photos, hide/show
  Settings       - shop details, admin recovery email, filtered Excel exports and
                  printable PDF reports, password, and full backup

ONLINE CHECKOUT
  Customers see what happens after placing an order, including that the shop confirms
  availability, any delivery charge, and payment arrangements. Add shop-specific
  instructions in Admin > Settings > Checkout note (Tamil / English).

CUSTOMER ACCOUNTS
  Customers create an account with their name, email, and password, then verify the
  email with a one-time code before signing in. Codes expire after 10 minutes and can
  be resent after a 60-second cooldown. Customers can sign in with their email
  or, after adding it at checkout, their phone number. A phone number and delivery
  address are required at checkout and saved to the customer profile for future orders.
  Customer accounts include an order-history view.

STOREFRONT
  The product list opens with the first category that has available products after
  customer sign-in. Visitors can still see the promotion, ordering steps, and safety tips.
  The sale banner scrolls from right to left.
  Signed-in customers can switch between Home, Cart, My Orders, and Account using
  the customer navigation bar.
  Admin > Settings lets the shop owner edit the Tamil and English seasonal sale titles
  (for example Diwali, Pongal, or Christmas) and the discount percentage.

LANGUAGE
  The shop website AND the Admin panel have a  Tamil | EN  switch (remembered in the browser).
  Bills are printed in the language currently selected in Admin.
  English shop name / tagline / address / festival title are set in Admin > Settings.
  English product names are the "Name (English)" field in Admin > Products.

CHANGE PORT / ALLOW OTHER DEVICES
  Default port is 5280 (not 3000 / 4000). If it is busy, edit config.bat:  PORT=5281
  config.bat:  PORT=5280   HOST=127.0.0.1
  Use HOST=0.0.0.0 to let mobiles/PCs on the same shop WiFi open  http://<this-pc-ip>:5280/
  (Windows Firewall may ask permission - choose Allow for Private network.)

DATA & BACKUP
  Products, customers, orders, bills, and settings are stored in PostgreSQL.
  Product photos and the shop logo are in the  data  folder (product-images and
  shop-images). Images can be uploaded in Admin > Products and Admin > Settings.
  Images must be JPG, PNG, or WebP, no larger than 700 KB or 5000 × 5000 pixels.
  Daily and downloadable JSON backups include images. Back up PostgreSQL as well as
  the data folder; to move to another PC, restore the database and copy the data folder.
  The original data\db.json is only used for the one-time import into an empty database.
  Server log: data\server.log

TIP: Click on the night sky on the website to fire your own firework!
