'use strict';
// Sample data for first start. Edit freely from the Admin panel afterwards.

const categories = [
  { id: 'sparkler', name: 'மத்தாப்பு', nameEn: 'Sparklers', emoji: '✨' },
  { id: 'flowerpot', name: 'புஸ்வாணம்', nameEn: 'Flower Pots', emoji: '🌸' },
  { id: 'chakkar', name: 'சக்கரம்', nameEn: 'Chakkars', emoji: '🌀' },
  { id: 'rocket', name: 'வானவெடி', nameEn: 'Rockets & Aerial', emoji: '🚀' },
  { id: 'garland', name: 'சரவெடி', nameEn: 'Garlands', emoji: '🧨' },
  { id: 'sound', name: 'ஒலி வெடி', nameEn: 'Sound Crackers', emoji: '💥' },
  { id: 'fancy', name: 'பேன்சி வெடி', nameEn: 'Fancy Crackers', emoji: '🎆' },
  { id: 'kids', name: 'சிறுவர் வெடி', nameEn: 'Kids Special', emoji: '🧒' },
  { id: 'gift', name: 'கிஃப்ட் பாக்ஸ்', nameEn: 'Gift Boxes', emoji: '🎁' },
];

// [name, nameEn, category, emoji, mrp, unit, stock, popular]
const rows = [
  ['கம்பி மத்தாப்பு (10 செ.மீ)', 'Sparklers 10cm', 'sparkler', '✨', 60, 'பெட்டி (10)', 200, 1],
  ['கம்பி மத்தாப்பு (15 செ.மீ)', 'Sparklers 15cm', 'sparkler', '✨', 110, 'பெட்டி (10)', 180, 0],
  ['கலர் மத்தாப்பு (30 செ.மீ)', 'Colour Sparklers 30cm', 'sparkler', '🌈', 190, 'பெட்டி (10)', 120, 1],
  ['ஜெயன்ட் மத்தாப்பு (50 செ.மீ)', 'Giant Sparklers 50cm', 'sparkler', '🎇', 340, 'பெட்டி (5)', 80, 0],
  ['புஸ்வாணம் சிறியது', 'Flower Pot Small', 'flowerpot', '🌸', 150, 'பெட்டி (10)', 150, 1],
  ['புஸ்வாணம் பெரியது', 'Flower Pot Big', 'flowerpot', '🌺', 260, 'பெட்டி (5)', 120, 0],
  ['அசோகா புஸ்வாணம்', 'Ashoka Flower Pot', 'flowerpot', '🏵️', 420, 'பெட்டி (5)', 90, 1],
  ['கலர் கோட்டை', 'Colour Koti', 'flowerpot', '🎨', 330, 'பெட்டி (5)', 70, 0],
  ['தரைச்சக்கரம் சிறியது', 'Ground Chakkar Small', 'chakkar', '🌀', 140, 'பெட்டி (10)', 160, 1],
  ['தரைச்சக்கரம் பெரியது', 'Ground Chakkar Big', 'chakkar', '🌪️', 270, 'பெட்டி (10)', 110, 0],
  ['விசில் சக்கரம்', 'Whistling Chakkar', 'chakkar', '🎡', 210, 'பெட்டி (5)', 80, 0],
  ['வானவெடி (ராக்கெட்) சிறியது', 'Rocket Small', 'rocket', '🚀', 180, 'பெட்டி (5)', 100, 1],
  ['வானவெடி (ராக்கெட்) பெரியது', 'Rocket Big', 'rocket', '🚀', 360, 'பெட்டி (3)', 60, 0],
  ['3¼" வண்ண வானவெடி', '3¼" Aerial Shot', 'rocket', '🎆', 520, 'பெட்டி (1)', 40, 1],
  ['சரவெடி 1000 வாலா', 'Garland 1000 Wala', 'garland', '🧨', 480, 'ஒரு சரம்', 60, 1],
  ['சரவெடி 2000 வாலா', 'Garland 2000 Wala', 'garland', '🧨', 920, 'ஒரு சரம்', 40, 0],
  ['சரவெடி 5000 வாலா', 'Garland 5000 Wala', 'garland', '🧨', 2300, 'ஒரு சரம்', 20, 0],
  ['லட்சுமி வெடி', 'Lakshmi Crackers', 'sound', '💥', 90, 'பாக்கெட் (10)', 220, 1],
  ['ஓலை வெடி', 'Oolai Vedi', 'sound', '💥', 70, 'பாக்கெட் (20)', 200, 0],
  ['குருவி வெடி', 'Kuruvi Vedi', 'sound', '🐦', 60, 'பாக்கெட் (20)', 200, 0],
  ['அணுகுண்டு', 'Atom Bomb', 'sound', '💣', 160, 'பாக்கெட் (5)', 100, 0],
  ['பட்டர்ஃபிளை (வண்ணத்துப்பூச்சி)', 'Butterfly Fancy', 'fancy', '🦋', 250, 'பெட்டி (5)', 90, 0],
  ['பீகாக் (மயில்) பேன்சி', 'Peacock Fancy', 'fancy', '🦚', 390, 'பெட்டி (1)', 70, 1],
  ['மேஜிக் பாப்', 'Magic Pop', 'fancy', '🪄', 130, 'பெட்டி (10)', 140, 0],
  ['ரோல் கேப்', 'Roll Cap', 'kids', '🔫', 40, 'பாக்கெட் (10)', 250, 0],
  ['பாம்பு மாத்திரை', 'Snake Tablet', 'kids', '🐍', 30, 'பெட்டி (10)', 250, 0],
  ['பென்சில் மத்தாப்பு', 'Pencil Sparkler', 'kids', '✏️', 50, 'பெட்டி (10)', 200, 0],
  ['குடும்ப கிஃப்ட் பாக்ஸ் (சிறியது)', 'Family Gift Box Small', 'gift', '🎁', 1500, 'பெட்டி', 30, 1],
  ['தீபாவளி ஸ்பெஷல் கிஃப்ட் பாக்ஸ்', 'Diwali Special Gift Box', 'gift', '🎁', 3000, 'பெட்டி', 20, 1],
];

const products = rows.map((r, i) => ({
  id: i + 1,
  name: r[0],
  nameEn: r[1],
  category: r[2],
  emoji: r[3],
  mrp: r[4],
  discount: null, // null = use shop discount
  unit: r[5],
  stock: r[6],
  popular: !!r[7],
  active: true,
}));

module.exports = { categories, products };
