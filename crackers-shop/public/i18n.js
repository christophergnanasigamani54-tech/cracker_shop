/* Storefront language support: Tamil (ta) / English (en) */
const DICT = {
  ta: {
    home: 'முகப்பு', searchPh: 'பட்டாசு தேடுங்கள்… (எ.கா. மத்தாப்பு)', search: 'தேடல்', cart: '🛒 கூடை',
    heroH1: 'வெடிக்கட்டும் <em>கொண்டாட்டம்!</em>',
    heroText: 'MRP விலையில் {d}% வரை தள்ளுபடி! குடும்பத்துடன் மகிழ்ச்சியாக கொண்டாட தரமான, பாதுகாப்பான பட்டாசுகள்.',
    ctaShop: '🎇 பொருட்களைப் பாருங்கள்', ctaSafety: '🛡️ பாதுகாப்பு குறிப்புகள்',
    trust1: 'நேரடி தொழிற்சாலை விலை', trust2: 'தரமான, சோதிக்கப்பட்ட பொருட்கள்', trust3: 'பாதுகாப்பான பேக்கிங்', trust4: 'போனில் ஆர்டர் செய்யலாம்',
    shopTitle: '🎁 எங்கள் பட்டாசுகள்', shopSub: 'குடும்ப கொண்டாட்டத்திற்கான பட்டாசுகளைப் பாருங்கள்.',
    previewAria: '{n} - பார்க்க உள்நுழையவும்',
    previewPrompt: 'வாடிக்கையாளர் கணக்கில் உள்நுழைந்ததும் அனைத்து பொருட்களையும் விலைகளையும் பார்க்கலாம்.',
    navHome: '🏠 முகப்பு', navCart: '🛒 கூடை', navOrders: '📦 எனது ஆர்டர்கள்', navAccount: '👤 கணக்கு',
    ordersPageText: 'உங்கள் முந்தைய ஆர்டர்கள் மற்றும் அவற்றின் நிலையை இங்கே பார்க்கலாம்.',
    customerProfile: 'வாடிக்கையாளர் விவரங்கள்',
    howTitle: '🛍️ ஆர்டர் செய்வது எப்படி?', howSub: 'சில எளிய படிகளில் உங்கள் ஆர்டரை முடிக்கலாம்.',
    how1Title: 'உள்நுழையவும்', how1: 'பொருட்களையும் விலைகளையும் பார்க்க உங்கள் கணக்கில் உள்நுழையவும்.',
    how2Title: 'பொருட்களைத் தேர்ந்தெடுக்கவும்', how2: 'வகையைத் தேர்ந்தெடுத்து பட்டாசுகளை கூடையில் சேர்க்கவும்.',
    how3Title: 'ஆர்டரை அனுப்புங்கள்', how3: 'உங்கள் முகவரியைச் சரிபார்த்து ஆர்டரை உறுதிப்படுத்துங்கள்.',
    how4Title: 'கடை உறுதிப்படுத்தும்', how4: 'கிடைப்பு, விநியோகம், கட்டணம் பற்றி கடை உங்களைத் தொடர்புகொள்ளும்.',
    all: 'அனைத்தும்', sortLbl: 'வரிசை', sortPop: 'பிரபலமானவை', sortLow: 'விலை: குறைந்தது முதல்', sortHigh: 'விலை: அதிகம் முதல்', sortOff: 'அதிக தள்ளுபடி',
    safetyTitle: '🛡️ பாதுகாப்பாக கொண்டாடுவோம்', safetySub: 'மகிழ்ச்சியுடன் பாதுகாப்பும் முக்கியம்.',
    s1t: '👨‍👩‍👧 பெரியவர் கண்காணிப்பு', s1: 'குழந்தைகள் பெரியவர் அருகில் இருக்கும்போது மட்டும் பயன்படுத்தட்டும்.',
    s2t: '🏞️ திறந்த வெளியில்', s2: 'கட்டிடங்கள் மற்றும் வாகனங்களிலிருந்து விலகி வெடிக்கவும்.',
    s3t: '🧥 பருத்தி ஆடை அணியுங்கள்', s3: 'தளர்வான அல்லது செயற்கை இழை ஆடைகளைத் தவிர்க்கவும்.',
    s4t: '🪣 தண்ணீர் அருகில் வையுங்கள்', s4: 'வெடிக்காத பட்டாசுகளைத் தொடாமல் தண்ணீரில் நனைக்கவும்.',
    s5t: '🚫 வெடிக்காததை தொடாதீர்', s5: 'வெடிக்காத பட்டாசை உடனே தண்ணீரில் நனைக்கவும்.',
    s6t: '📏 தூரம் காக்கவும்', s6: 'பற்றவைத்த பின் உடனே விலகிச் செல்லவும்; குனிந்து பார்க்க வேண்டாம்.',
    fAddr: '📍 முகவரி', fContact: '📞 தொடர்புக்கு', fDelivery: '🚚 விநியோகம்', fLic: '📄 உரிமம்',
    licNo: 'உரிமம் எண்: {n}', licDefault: 'அரசு அனுமதி பெற்ற விற்பனையாளர்',
    copy: 'பட்டாசுகள் அரசு விதிமுறைகளின் படி விற்கப்படுகின்றன. 18 வயதுக்கு உட்பட்டோர் பெரியவர் மேற்பார்வையுடன் மட்டுமே.',
    cartTitle: '🛒 உங்கள் கூடை', close: 'மூடு', mrpTotal: 'MRP மொத்தம்', youSave: '🎉 உங்கள் சேமிப்பு', toPay: 'செலுத்த வேண்டியது',
    fName: 'பெயர் *', fPhone: 'மொபைல் எண் *', fAddress: 'முகவரி *', fNote: 'குறிப்பு (விருப்பம்)',
    customerAccount: 'கணக்கு', customerWelcome: 'வணக்கம், {n}', accountTitle: 'வாடிக்கையாளர் கணக்கு',
    customerLogin: 'உள்நுழை', customerRegister: 'புதிய கணக்கு உருவாக்கு', customerRegisterTitle: 'புதிய வாடிக்கையாளர் கணக்கு',
    customerName: 'பெயர் *', customerPhone: 'தொலைபேசி (விருப்பம்)', customerEmail: 'மின்னஞ்சல் (விருப்பம்)',
    customerPassword: 'கடவுச்சொல் (குறைந்தது 8 எழுத்துகள்)', customerIdentifier: 'மின்னஞ்சல் அல்லது தொலைபேசி',
    customerAddress: 'விநியோக முகவரி (விருப்பம்)', customerHaveAccount: 'ஏற்கனவே கணக்கு உள்ளதா? உள்நுழைக',
    customerNeedAccount: 'புதியவரா? கணக்கு உருவாக்கவும்', customerLogout: 'வெளியேறு', customerOrders: 'எனது ஆர்டர்கள்',
    customerNoOrders: 'உங்கள் ஆர்டர்கள் இங்கே காட்டப்படும்.', customerLoginFirst: 'ஆர்டர் செய்ய உங்கள் கணக்கில் உள்நுழையவும்.',
    customerStatusNew: 'புதியது', customerStatusConfirmed: 'உறுதி செய்யப்பட்டது', customerStatusPacked: 'பேக் செய்யப்பட்டது',
    customerStatusDelivered: 'வழங்கப்பட்டது', customerStatusCancelled: 'ரத்து செய்யப்பட்டது',
    customerAccountError: 'கணக்கை ஏற்ற முடியவில்லை', customerPhoneOrEmail: 'தொலைபேசி அல்லது மின்னஞ்சல் ஒன்றை உள்ளிடவும்',
    loading: 'ஏற்றுகிறது…',
    place: '✅ ஆர்டர் செய்', sending: 'அனுப்புகிறது…',
    done: 'ஆர்டர் பெறப்பட்டது!', thanks: 'நன்றி! விரைவில் உங்களை தொடர்பு கொண்டு ஆர்டரை உறுதி செய்வோம்.', wa: '💬 WhatsApp-ல் தெரிவி', ok: 'சரி',
    orderNextTitle: 'அடுத்து என்ன?', orderNext: 'கடை பொருள் கிடைப்பை உறுதிப்படுத்தி, விநியோகக் கட்டணம் (இருந்தால்), மற்றும் பணம் செலுத்தும் முறையைத் தெரிவிக்கும். கடை உறுதிப்படுத்திய கட்டண வழிமுறைகளை மட்டுமே பயன்படுத்துங்கள்.', orderContact: 'கேள்விகளுக்கு அழைக்கவும்: {n}',
    waMsg: 'வணக்கம், நான் {name}. ஆர்டர் {id} (மொத்தம் {total}) செய்துள்ளேன்.',
    off: '{n}% OFF', hot: '🔥 பிரபலம்', add: '🛒 சேர்', signInToAdd: '👤 சேர்க்க உள்நுழைக', inc: 'கூட்டு', dec: 'குறை', del: 'நீக்கு', soldOut: 'இருப்பில் இல்லை', onlyLeft: '⚠️ {n} மட்டுமே உள்ளது',
    added: '🛒 கூடையில் சேர்க்கப்பட்டது', stockOnly: 'இருப்பு {n} மட்டுமே', qtyLimit: 'ஒரு பொருளுக்கு அதிகபட்ச அளவு 9999', nothing: '😕 பொருள் எதுவும் கிடைக்கவில்லை',
    cartEmpty: 'கூடை காலியாக உள்ளது', cartEmptySub: 'பட்டாசுகளைச் சேர்க்கவும்', items: '{n} பொருட்கள்', viewCart: '{t} • கூடையைப் பார் ›',
    minNote: '⚠️ குறைந்தபட்ச ஆர்டர் {m} (இன்னும் {s} சேர்க்கவும்)',
    vName: 'பெயரை உள்ளிடவும்', vPhone: 'சரியான மொபைல் எண்ணை உள்ளிடவும்', vAddr: 'முகவரியை உள்ளிடவும்',
    down: '⚠️ சர்வருடன் இணைக்க முடியவில்லை. start.bat ஓடுகிறதா என சரிபார்க்கவும்.',
    festDefault: 'சிறப்பு விற்பனை', pageTitle: '{n} - பட்டாசு விற்பனை',
    marquee: '🎆 {f} — MRP விலையில் {d}% தள்ளுபடி!  📞 ஆர்டர் செய்ய: {p}  🎇 {n}  ',
  },
  en: {
    home: 'Home', searchPh: 'Search crackers… (e.g. sparklers)', search: 'Search', cart: '🛒 Cart',
    heroH1: 'Let the <em>celebration</em> begin!',
    heroText: 'Up to {d}% off MRP! Quality, safe crackers to celebrate happily with your family.',
    ctaShop: '🎇 Browse products', ctaSafety: '🛡️ Safety Tips',
    trust1: 'Direct factory price', trust2: 'Quality-tested products', trust3: 'Safe packing', trust4: 'Order by phone too',
    shopTitle: '🎁 Our Crackers', shopSub: 'Explore crackers for your family celebrations.',
    previewAria: '{n} - sign in to view',
    previewPrompt: 'Once you are signed in to your customer account, you can see the full product list and prices.',
    navHome: '🏠 Home', navCart: '🛒 Cart', navOrders: '📦 My orders', navAccount: '👤 Account',
    ordersPageText: 'View your previous orders and their current status here.',
    customerProfile: 'Customer details',
    howTitle: '🛍️ How to order', howSub: 'Place an order in a few simple steps.',
    how1Title: 'Sign in', how1: 'Sign in to your account to view products and prices.',
    how2Title: 'Choose products', how2: 'Pick a category and add crackers to your cart.',
    how3Title: 'Send your order', how3: 'Check your delivery address and submit the order.',
    how4Title: 'Shop confirms', how4: 'The shop will contact you about stock, delivery, and payment.',
    all: 'All', sortLbl: 'Sort', sortPop: 'Popular', sortLow: 'Price: Low to High', sortHigh: 'Price: High to Low', sortOff: 'Biggest discount',
    safetyTitle: '🛡️ Celebrate Safely', safetySub: 'Safety matters as much as the fun.',
    s1t: '👨‍👩‍👧 Adult supervision', s1: 'Children should use crackers only with an adult nearby.',
    s2t: '🏞️ Use an open area', s2: 'Keep away from buildings and vehicles.',
    s3t: '🧥 Wear cotton clothes', s3: 'Avoid loose or synthetic clothing.',
    s4t: '🪣 Keep water nearby', s4: 'Do not touch duds; soak them in water.',
    s5t: '🚫 Do not touch duds', s5: 'Soak any unburst cracker in water immediately.',
    s6t: '📏 Keep your distance', s6: 'Move away right after lighting; never lean over a lit cracker.',
    fAddr: '📍 Address', fContact: '📞 Contact', fDelivery: '🚚 Delivery', fLic: '📄 Licence',
    licNo: 'Licence No: {n}', licDefault: 'Government licensed seller',
    copy: 'Crackers are sold as per government regulations. Persons below 18 only under adult supervision.',
    cartTitle: '🛒 Your Cart', close: 'Close', mrpTotal: 'MRP total', youSave: '🎉 You save', toPay: 'Amount to pay',
    fName: 'Name *', fPhone: 'Mobile number *', fAddress: 'Address *', fNote: 'Note (optional)',
    customerAccount: 'Account', customerWelcome: 'Hi, {n}', accountTitle: 'Customer account',
    customerLogin: 'Sign in', customerRegister: 'Create account', customerRegisterTitle: 'Create your customer account',
    customerName: 'Name *', customerPhone: 'Phone (optional)', customerEmail: 'Email (optional)',
    customerPassword: 'Password (at least 8 characters)', customerIdentifier: 'Email or phone number',
    customerAddress: 'Delivery address (optional)', customerHaveAccount: 'Already have an account? Sign in',
    customerNeedAccount: 'New customer? Create an account', customerLogout: 'Sign out', customerOrders: 'My orders',
    customerNoOrders: 'Your orders will appear here.', customerLoginFirst: 'Sign in to your account to place an order.',
    customerStatusNew: 'New', customerStatusConfirmed: 'Confirmed', customerStatusPacked: 'Packed',
    customerStatusDelivered: 'Delivered', customerStatusCancelled: 'Cancelled',
    customerAccountError: 'Could not load your account', customerPhoneOrEmail: 'Enter a phone number or email',
    loading: 'Loading…',
    place: '✅ Place Order', sending: 'Sending…',
    done: 'Order received!', thanks: 'Thank you! We will contact you shortly to confirm your order.', wa: '💬 Tell us on WhatsApp', ok: 'OK',
    orderNextTitle: 'What happens next?', orderNext: 'The shop will confirm availability, any delivery charge, and how to pay. Only use payment instructions confirmed by the shop.', orderContact: 'Questions? Call: {n}',
    signInToAdd: '👤 Sign in to add',
    waMsg: 'Hello, I am {name}. I have placed order {id} (total {total}).',
    off: '{n}% OFF', hot: '🔥 Popular', add: '🛒 Add', inc: 'Increase', dec: 'Decrease', del: 'Remove', soldOut: 'Out of stock', onlyLeft: '⚠️ Only {n} left',
    added: '🛒 Added to cart', stockOnly: 'Only {n} in stock', qtyLimit: 'Maximum quantity per item is 9999', nothing: '😕 No products found',
    cartEmpty: 'Your cart is empty', cartEmptySub: 'Add some crackers', items: '{n} items', viewCart: '{t} • View cart ›',
    minNote: '⚠️ Minimum order is {m} (add {s} more)',
    vName: 'Please enter your name', vPhone: 'Please enter a valid mobile number', vAddr: 'Please enter your address',
    down: '⚠️ Cannot reach the server. Please check that start.bat is running.',
    festDefault: 'Special Sale', pageTitle: '{n} - Crackers Shop',
    marquee: '🎆 {f} — {d}% off MRP!  📞 Call to order: {p}  🎇 {n}  ',
  },
};

let LANG = store.get('lang', 'ta');
if (!DICT[LANG]) LANG = 'ta';

function t(key, vars) {
  let s = (DICT[LANG] && DICT[LANG][key]) || DICT.ta[key] || key;
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}
const isEn = () => LANG === 'en';

// Translate common Tamil unit words when viewing in English
function unitText(u) {
  if (!isEn()) return u;
  return String(u).replace(/பெட்டி/g, 'Box').replace(/பாக்கெட்/g, 'Packet').replace(/ஒரு சரம்/g, '1 Garland').replace(/சரம்/g, 'Garland');
}
const pName = (p) => (isEn() && p.nameEn ? p.nameEn : p.name);
const cName = (c) => (isEn() && c.nameEn ? c.nameEn : c.name);

function applyStatic() {
  document.documentElement.lang = LANG === 'en' ? 'en' : 'ta';
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  $$('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  $$('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  $$('.lang button').forEach((b) => { const on = b.dataset.lang === LANG; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
}
function setLang(l) { LANG = l; store.set('lang', l); applyStatic(); }
