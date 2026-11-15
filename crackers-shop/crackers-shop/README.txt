CRACKERS SHOP SOFTWARE  (Tamil website + counter billing)
=========================================================
Requires: Windows + Node.js 24 LTS (setup.bat installs it for you using winget).
No npm install needed - the app has zero dependencies.

FIRST TIME
  1. Double-click  setup.bat
  2. Double-click  start.bat      (browser opens automatically)

DAILY USE
  start.bat  -> starts the server  (http://localhost:5280/)
  stop.bat   -> stops the server

ADDRESSES
  Shop website : http://localhost:5280/
  Admin panel  : http://localhost:5280/admin
  Default admin password: admin123   (CHANGE IT: Admin > Settings)

ADMIN FEATURES
  Dashboard      - today's sales, 7-day chart, top products, low stock
  Billing        - counter bills, extra discount, payment mode, thermal 80mm print
  Online orders  - customer orders from the website, status tracking, auto stock
  Products       - add / edit / delete, stock, per-product discount, product photos, hide/show
  Settings       - shop logo, name, phone, address, delivery areas/information, licence no, discount %, password, backup

ONLINE CHECKOUT
  Customers see what happens after placing an order, including that the shop confirms
  availability, any delivery charge, and payment arrangements. Add shop-specific
  instructions in Admin > Settings > Checkout note (Tamil / English).

CUSTOMER ACCOUNTS
  Customers must create an account or sign in using either their phone number or email
  and a password before the product list and prices are shown. An account is also
  required to add products and place orders.
  Customer accounts include an order-history view. Email and phone are not verified
  by OTP or confirmation email; customers must provide a phone number at checkout.

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
  All data is in the  data  folder (db.json, product-images, and shop-images). Product
  photos can be uploaded in Admin > Products, and the shop logo in Admin > Settings.
  Images must be JPG, PNG, or WebP, no larger than 700 KB or 5000 × 5000 pixels.
  Daily and downloadable backups include images. To move to another PC, copy the whole
  data folder.
  Server log: data\server.log

TIP: Click on the night sky on the website to fire your own firework!
