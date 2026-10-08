// New restaurant: no imported customers, orders, menu, prices or promotions.
const SEED_SETTINGS = {
  name: "El Chingadazo", tagline: "Comida mexicana", phone: "", whatsapp: "",
  email: "elchingadazohn@gmail.com", instagram: "", address: "Plaza Las Casitas, Anillo Periférico, Honduras",
  mapsUrl: "https://maps.app.goo.gl/ucbPaXWA6j4iLGyg9",
  hours: "Lunes cerrado · mar–jue y domingo 1 p. m.–10 p. m. · vie–sáb 1 p. m.–medianoche", taxRate: 0, deliveryFee: 0, minOrder: 0,
  weeklyHours: {
    0:{closed:false,open:'13:00',close:'22:00'}, 1:{closed:true,open:'13:00',close:'22:00'},
    2:{closed:false,open:'13:00',close:'22:00'}, 3:{closed:false,open:'13:00',close:'22:00'},
    4:{closed:false,open:'13:00',close:'22:00'}, 5:{closed:false,open:'13:00',close:'00:00'},
    6:{closed:false,open:'13:00',close:'00:00'}
  },
  deliveryCustomerFee1: 0, deliveryCustomerFee3: 0, deliveryCustomerFee65: 0,
  deliveryCustomerFee8: 0, deliveryCustomerMaxKm: 0,
  deliveryFixedZoneEnabled: false, deliveryFixedZoneName: "", deliveryFixedZoneFee: 0,
  restaurantAddress: "Plaza Las Casitas, Anillo Periférico, Honduras", restaurantLat: null, restaurantLng: null,
  currency: "HNL", timezone: "America/Tegucigalpa",
  soundOn: true, autoWhatsApp: false, deliveryEnabled: false,
  shiftReportEmail: "", open: false, opensAt: "13:00", closeWeek: "22:00", closeSun: "22:00",
  logoImage: "assets/logo.jpg", logoSize: 64, heroHeight: 280,
  waitMin: 25, heroTitle: "El Chingadazo", heroSubtitle: "Comida mexicana, sabor con carácter",
  heroImage: "assets/logo.jpg", coverVer: 4, businessInfoVersion: 112,
  doublePoints: false, welcomeBonus: 0,
  chingadazoAiEnabled: true, foodProfileEnabled: true, familyOrderEnabled: true,
  spicyCopyEnabled: true, deliveryCodeRequired: true
};
const SEED_CATEGORIES = [{"id":"destacados","name":"Destacados","icon":"★"},{"id":"birria","name":"Birria","icon":"🌮"},{"id":"entradas","name":"Entradas","icon":"🥑"},{"id":"gringas","name":"Gringas","icon":"🧀"},{"id":"tacos","name":"Tacos","icon":"🌮"},{"id":"burritos","name":"Burritos","icon":"🌯"},{"id":"tostadas","name":"Tostadas","icon":"🌮"},{"id":"tortas","name":"Tortas","icon":"🥖"},{"id":"micheladas","name":"Micheladas","icon":"🍹"}];
// Prices transcribed and visually checked against the user-supplied menu PDF.
const SEED_PRODUCTS = [
{"id":"tacos-birria","name":"Tacos de Birria","description":"Fotografía ilustrativa del menú de El Chingadazo.","price":189,"category":"birria","image":"assets/menu/birria.png","available":true,"featured":true,"modifiers":[]},
{"id":"combo-birria-2","name":"Combo Birria para 2","description":"","price":379,"category":"birria","image":"","available":true,"featured":false,"modifiers":[]},
{"id":"nachos-birria","name":"Nachos de Birria","description":"","price":199,"category":"birria","image":"","available":true,"featured":false,"modifiers":[]},
{"id":"quesadillas-birria","name":"Quesadillas de Birria","description":"","price":199,"category":"birria","image":"","available":true,"featured":false,"modifiers":[]},
{"id":"combo-quesa-birria","name":"Combo Quesa Birria","description":"","price":379,"category":"birria","image":"","available":true,"featured":false,"modifiers":[]},
{"id":"torta-birria","name":"Torta de Birria","description":"","price":199,"category":"birria","image":"","available":true,"featured":false,"modifiers":[]},
{"id":"ramen-birria","name":"Ramen de Birria + 1 taco de birria","description":"Fotografía ilustrativa del menú de El Chingadazo.","price":199,"category":"birria","image":"assets/menu/ramen.png","available":true,"featured":true,"modifiers":[]},
{"id":"combo-birria-familia","name":"Combo Birria Familia + Coca-Cola 2 L","description":"","price":999,"category":"birria","image":"","available":true,"featured":false,"modifiers":[]},
{"id":"mixto-sinaloa","name":"Mixto Sinaloa","description":"","price":210,"category":"entradas","image":"","available":true,"featured":false,"modifiers":[]},
{"id":"papas-nortenas","name":"Papas Norteñas","description":"","price":189,"category":"entradas","image":"","available":true,"featured":false,"modifiers":[]},
{"id":"papas-chilangas","name":"Papas Chilangas","description":"","price":179,"category":"entradas","image":"","available":true,"featured":false,"modifiers":[]},
{"id":"guacamole","name":"Guacamole","description":"","price":115,"category":"entradas","image":"","available":true,"featured":false,"modifiers":[]},
{"id":"gringas-chingadazo","name":"Gringas El Chingadazo","description":"Fotografía ilustrativa del menú de El Chingadazo.","price":145,"category":"gringas","image":"assets/menu/gringas.png","available":true,"featured":true,"modifiers":[]},
{"id":"gringa-tejana","name":"Gringa Tejana (Bacon)","description":"","price":165,"category":"gringas","image":"","available":true,"featured":false,"modifiers":[]},
{"id":"tacos-suaves","name":"Tacos Suaves","description":"Fotografía ilustrativa del menú de El Chingadazo.","price":159,"category":"tacos","image":"assets/menu/tacos.png","available":true,"featured":true,"modifiers":[]},
{"id":"taquiza-familiar","name":"Taquiza Familiar","description":"","price":699,"category":"tacos","image":"","available":true,"featured":false,"modifiers":[]},
{"id":"bad-burro","name":"Bad Burro","description":"Fotografía ilustrativa del menú de El Chingadazo.","price":189,"category":"burritos","image":"assets/menu/burrito.png","available":true,"featured":true,"modifiers":[]},
{"id":"mega-burro","name":"Mega Burro","description":"","price":189,"category":"burritos","image":"","available":true,"featured":false,"modifiers":[]},
{"id":"burro-azteca","name":"Burro Azteca","description":"","price":169,"category":"burritos","image":"","available":true,"featured":false,"modifiers":[]},
{"id":"tostadas-pastor","name":"Tostadas al Pastor","description":"","price":130,"category":"tostadas","image":"","available":true,"featured":false,"modifiers":[]},
{"id":"tostadas-pollo","name":"Tostadas de Pollo","description":"Fotografía ilustrativa del menú de El Chingadazo.","price":130,"category":"tostadas","image":"assets/menu/tostada.png","available":true,"featured":false,"modifiers":[]},
{"id":"tostadas-res","name":"Tostadas de Res","description":"","price":130,"category":"tostadas","image":"","available":true,"featured":false,"modifiers":[]},
{"id":"mega-torta-chilanga","name":"Mega Torta Chilanga","description":"Fotografía ilustrativa del menú de El Chingadazo.","price":189,"category":"tortas","image":"assets/menu/torta.png","available":true,"featured":true,"modifiers":[]},
{"id":"torta-nortena","name":"Torta Norteña","description":"","price":169,"category":"tortas","image":"","available":true,"featured":false,"modifiers":[]},
{"id":"torta-mixta","name":"Torta Mixta","description":"","price":189,"category":"tortas","image":"","available":true,"featured":false,"modifiers":[]},
{"id":"michelada-base","name":"Michelada (base)","description":"Base para michelada. Adiciona la cerveza de tu preferencia; la cerveza se cobra por separado.","price":55,"category":"micheladas","image":"assets/menu/michelada.png","available":true,"featured":false,"modifiers":[]},
];
const SEED_USERS = [];
