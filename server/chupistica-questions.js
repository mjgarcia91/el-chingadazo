// Banco cerrado del servidor. Las respuestas correctas nunca se envían al cliente
// mientras la pregunta está activa. Todas son deliberadamente fáciles y aptas
// para jugar en familia.
const RAW = [
  // Honduras: cultura, geografía y comida
  ["hn01","Honduras","¿Cuál es la capital de Honduras?",["Tegucigalpa","San Pedro Sula","La Ceiba","Comayagua"],0,"Tegucigalpa es la capital de Honduras."],
  ["hn02","Honduras","¿Cómo se llama la moneda de Honduras?",["Peso","Quetzal","Lempira","Colón"],2,"La moneda hondureña es el lempira."],
  ["hn03","Honduras","¿Qué colores tiene la bandera de Honduras?",["Azul y blanco","Rojo y negro","Verde y amarillo","Morado y blanco"],0,"La bandera hondureña es azul y blanca."],
  ["hn04","Honduras","¿Cuántas estrellas tiene la bandera de Honduras?",["Tres","Cuatro","Cinco","Siete"],2,"Tiene cinco estrellas."],
  ["hn05","Honduras","¿Qué ave aparece como símbolo nacional de Honduras?",["Guacamaya roja","Águila calva","Tucán","Quetzal"],0,"La guacamaya roja es el ave nacional."],
  ["hn06","Honduras","¿Cuál es el árbol nacional de Honduras?",["Ceiba","Pino","Roble","Mango"],1,"El pino es el árbol nacional."],
  ["hn07","Honduras","¿Qué animal es el mamífero nacional de Honduras?",["Venado cola blanca","Jaguar","Manatí","Mono araña"],0,"Es el venado cola blanca."],
  ["hn08","Honduras","¿En qué mes se celebra la independencia de Honduras?",["Enero","Mayo","Septiembre","Diciembre"],2,"Se celebra el 15 de septiembre."],
  ["hn09","Honduras","¿Qué héroe centroamericano nació en Honduras?",["Francisco Morazán","Rubén Darío","Óscar Romero","Miguel Ángel Asturias"],0,"Francisco Morazán nació en Tegucigalpa."],
  ["hn10","Honduras","¿En qué lugar están las famosas ruinas mayas hondureñas?",["Copán","Tela","Danlí","Trujillo"],0,"Las Ruinas de Copán son uno de los grandes sitios mayas."],
  ["hn11","Honduras","¿Cuál es el lago natural más grande de Honduras?",["Lago de Yojoa","Lago de Atitlán","Lago Cocibolca","Lago de Güija"],0,"Es el Lago de Yojoa."],
  ["hn12","Honduras","¿Cuál de estas islas pertenece a Honduras?",["Roatán","Cozumel","Cuba","Margarita"],0,"Roatán forma parte de Islas de la Bahía."],
  ["hn13","Honduras","¿En qué ciudad está la fortaleza de San Fernando de Omoa?",["Omoa","Choluteca","Gracias","Juticalpa"],0,"La fortaleza está en Omoa."],
  ["hn14","Honduras","¿Qué ciudad hondureña es conocida por su feria Isidra y el Carnaval de la Amistad?",["La Ceiba","Danlí","Santa Rosa","Nacaome"],0,"La Ceiba celebra estas fiestas en mayo."],
  ["hn15","Honduras","¿Cuántos departamentos tiene Honduras?",["12","14","18","21"],2,"Honduras tiene 18 departamentos."],
  ["hn16","Honduras","¿Qué ciudad es conocida como la capital industrial de Honduras?",["San Pedro Sula","Gracias","Tela","Yuscarán"],0,"San Pedro Sula es conocida como la capital industrial."],
  ["hn17","Honduras","¿Qué mar baña la costa norte de Honduras?",["Mar Caribe","Mar Mediterráneo","Mar Rojo","Mar Negro"],0,"La costa norte da al mar Caribe."],
  ["hn18","Honduras","¿Por qué golfo llega Honduras al océano Pacífico?",["Golfo de Fonseca","Golfo de México","Golfo Dulce","Golfo de Nicoya"],0,"Honduras tiene costa pacífica en el golfo de Fonseca."],
  ["hn19","Honduras","¿Qué danza y ritmo identifica especialmente al pueblo garífuna?",["Punta","Tango","Flamenco","Samba"],0,"La punta es una expresión musical y dancística garífuna."],
  ["hn20","Honduras","¿Dónde se encuentra la catarata de Pulhapanzak?",["Cortés","Islas de la Bahía","Valle","Gracias a Dios"],0,"Pulhapanzak está en el departamento de Cortés."],
  ["hn21","Comida catracha","¿Con qué tipo de tortilla se prepara normalmente una baleada?",["Tortilla de harina","Tortilla de arroz","Pan pita","Tostada"],0,"La baleada se prepara con tortilla de harina."],
  ["hn22","Comida catracha","¿Qué ingrediente no puede faltar en una baleada sencilla?",["Frijoles","Atún","Pepino","Chocolate"],0,"La baleada sencilla lleva frijoles, crema y queso."],
  ["hn23","Comida catracha","¿Qué marisco da nombre a una famosa sopa hondureña?",["Caracol","Pulpo","Langosta","Calamar"],0,"La sopa de caracol es uno de los platos hondureños más conocidos."],
  ["hn24","Comida catracha","¿En qué se envuelve normalmente un nacatamal hondureño?",["Hoja de plátano","Papel aluminio","Hoja de lechuga","Tortilla"],0,"El nacatamal se cocina envuelto en hoja de plátano."],
  ["hn25","Comida catracha","¿De qué grano se hacen las montucas?",["Maíz tierno","Arroz","Trigo","Avena"],0,"Las montucas se preparan con maíz tierno."],
  ["hn26","Comida catracha","¿Qué son las tajadas en un plato típico hondureño?",["Plátano frito en rebanadas","Pan tostado","Queso rallado","Yuca hervida"],0,"Las tajadas son rebanadas de plátano fritas."],
  ["hn27","Comida catracha","¿Qué llevan las catrachas sobre la tortilla frita?",["Frijoles y queso","Helado y miel","Pescado crudo","Pollo con pasta"],0,"Las catrachas llevan frijoles y queso sobre tortilla frita."],
  ["hn28","Comida catracha","¿Qué ingrediente da su nombre al atol de elote?",["Maíz","Cacao","Café","Arroz"],0,"El elote es maíz tierno."],
  ["hn29","Comida catracha","¿Cuál de estos es un acompañamiento común de un desayuno catracho?",["Frijoles fritos","Sushi","Croissant","Cuscús"],0,"Los frijoles fritos son clásicos del desayuno catracho."],
  ["hn30","Comida catracha","¿Qué fruta se usa para hacer torrejas de plátano?",["Plátano","Manzana","Piña","Sandía"],0,"Se preparan con plátano maduro."],
  ["hn31","Comida catracha","¿Qué bebida hondureña se prepara tradicionalmente con maíz?",["Pinol","Té chai","Limoncello","Mate"],0,"El pinol se elabora a base de maíz tostado."],
  ["hn32","Comida catracha","¿Qué ingrediente es protagonista en una sopa de frijoles?",["Frijoles","Uvas","Pasta","Yogur"],0,"La respuesta estaba servida en el nombre: frijoles."],
  ["hn33","Comida catracha","¿Cuál de estos platos suele llevar carne asada, frijoles, queso y tajadas?",["Plato típico","Paella","Ramen","Lasaña"],0,"Es la combinación clásica de un plato típico hondureño."],
  ["hn34","Comida catracha","¿Qué producto hondureño suele tener forma de aro y textura crujiente?",["Rosquilla","Pupusa","Baleada","Montuca"],0,"Las rosquillas suelen ser crujientes y con forma de aro."],
  ["hn35","Comida catracha","¿Con qué se acompaña frecuentemente el pescado frito en la costa hondureña?",["Tajadas","Puré de manzana","Fideos","Pan dulce"],0,"El pescado frito suele acompañarse con tajadas."],

  // El Salvador
  ["sv01","El Salvador","¿Cuál es la capital de El Salvador?",["San Salvador","Santa Ana","San Miguel","Sonsonate"],0,"San Salvador es la capital."],
  ["sv02","El Salvador","¿Cuál es el plato más emblemático de El Salvador?",["Pupusa","Taco","Ceviche","Empanada"],0,"La pupusa es el plato salvadoreño más representativo."],
  ["sv03","El Salvador","¿Cómo se llama la ensalada de repollo que acompaña las pupusas?",["Curtido","Chimol","Guacamole","Pico de gallo"],0,"Se llama curtido."],
  ["sv04","El Salvador","¿En qué se cocinan las pupusas?",["Comal","Olla a presión","Horno de barro","Vaporera"],0,"Las pupusas se cocinan sobre un comal."],
  ["sv05","El Salvador","¿Qué flor comestible se usa mucho como relleno de pupusa?",["Loroco","Rosa","Tulipán","Girasol"],0,"El loroco es un relleno tradicional."],
  ["sv06","El Salvador","¿De qué cereal pueden hacerse las pupusas tradicionales?",["Maíz o arroz","Avena o cebada","Centeno","Quinoa"],0,"Pueden hacerse con masa de maíz o de arroz."],
  ["sv07","El Salvador","¿Qué preparación salvadoreña combina yuca con chicharrón?",["Yuca frita o sancochada","Riguas","Quesadilla","Atol"],0,"La yuca suele servirse con chicharrón y curtido."],
  ["sv08","El Salvador","¿Qué son las riguas?",["Tortitas de maíz tierno","Sopa de res","Dulce de coco","Pan con pollo"],0,"Las riguas se elaboran con maíz tierno."],
  ["sv09","El Salvador","¿Cuál de estos es un pan dulce salvadoreño?",["Quesadilla salvadoreña","Baguette","Pretzel","Bagel"],0,"La quesadilla salvadoreña es un pan dulce con queso."],
  ["sv10","El Salvador","¿Qué ciudad salvadoreña es famosa por sus pupusas de arroz?",["Olocuilta","La Unión","Metapán","Acajutla"],0,"Olocuilta es conocida por las pupusas de arroz."],
  ["sv11","El Salvador","¿Cómo se llama el ave nacional de El Salvador?",["Torogoz","Guacamaya","Cóndor","Flamenco"],0,"El torogoz es el ave nacional."],
  ["sv12","El Salvador","¿Cuál de estos es uno de los árboles nacionales de El Salvador?",["Maquilishuat","Pino","Ceiba","Cocotero"],0,"El maquilishuat es uno de los árboles nacionales de El Salvador."],
  ["sv13","El Salvador","¿Cuántos departamentos tiene El Salvador?",["10","12","14","18"],2,"El Salvador tiene 14 departamentos."],
  ["sv14","El Salvador","¿Qué océano baña la costa de El Salvador?",["Pacífico","Atlántico","Índico","Ártico"],0,"Su costa está sobre el océano Pacífico."],
  ["sv15","El Salvador","¿Qué ciudad colonial salvadoreña es conocida por su lago y su festival cultural?",["Suchitoto","Soyapango","Mejicanos","Ilopango"],0,"Suchitoto es un importante destino colonial y cultural."],
  ["sv16","El Salvador","¿Qué volcán está junto a la ciudad de Santa Ana?",["Ilamatepec","Masaya","Arenal","Tajumulco"],0,"El volcán de Santa Ana también se llama Ilamatepec."],
  ["sv17","El Salvador","¿Qué bebida espesa salvadoreña se sirve caliente y puede llevar maíz morado?",["Atol shuco","Horchata española","Sangría","Café irlandés"],0,"El atol shuco es una bebida tradicional caliente."],
  ["sv18","El Salvador","¿Qué postre salvadoreño suele servirse con miel?",["Nuegados","Tiramisú","Flan napolitano","Macaron"],0,"Los nuegados suelen acompañarse con miel."],
  ["sv19","El Salvador","¿Qué plato salvadoreño lleva pan relleno de pollo y verduras?",["Panes con pollo","Baleadas","Enchiladas suizas","Arepas"],0,"Se conoce sencillamente como panes con pollo."],
  ["sv20","El Salvador","¿En qué mes celebra El Salvador su independencia?",["Marzo","Junio","Septiembre","Noviembre"],2,"La independencia centroamericana se celebra el 15 de septiembre."],

  // Centroamérica
  ["ca01","Centroamérica","¿Cuántos países forman Centroamérica?",["Cinco","Seis","Siete","Nueve"],2,"Centroamérica está formada por siete países."],
  ["ca02","Centroamérica","¿Cuál es la capital de Guatemala?",["Ciudad de Guatemala","Antigua Guatemala","Quetzaltenango","Escuintla"],0,"La capital es Ciudad de Guatemala."],
  ["ca03","Centroamérica","¿Cuál es la capital de Nicaragua?",["León","Granada","Managua","Masaya"],2,"Managua es la capital nicaragüense."],
  ["ca04","Centroamérica","¿Cuál es la capital de Costa Rica?",["San José","Liberia","Cartago","Limón"],0,"San José es la capital costarricense."],
  ["ca05","Centroamérica","¿Cuál es la capital de Panamá?",["Colón","David","Ciudad de Panamá","Boquete"],2,"La capital es Ciudad de Panamá."],
  ["ca06","Centroamérica","¿Cuál es la capital de Belice?",["Belmopán","Ciudad de Belice","Orange Walk","San Ignacio"],0,"Belmopán es la capital de Belice."],
  ["ca07","Centroamérica","¿Qué país centroamericano no tiene costa en el mar Caribe?",["El Salvador","Honduras","Belice","Nicaragua"],0,"El Salvador solo tiene costa sobre el Pacífico."],
  ["ca08","Centroamérica","¿Qué país une Centroamérica con América del Sur?",["Panamá","Guatemala","Belice","Honduras"],0,"Panamá conecta ambas regiones."],
  ["ca09","Centroamérica","¿En qué país está el canal que conecta Atlántico y Pacífico?",["Panamá","Costa Rica","Nicaragua","Guatemala"],0,"El Canal de Panamá conecta ambos océanos."],
  ["ca10","Centroamérica","¿En qué país está el volcán Arenal?",["Costa Rica","Honduras","El Salvador","Belice"],0,"El Arenal está en Costa Rica."],
  ["ca11","Centroamérica","¿En qué país está la ciudad colonial de Antigua Guatemala?",["Guatemala","Nicaragua","Panamá","Honduras"],0,"Antigua Guatemala está en Guatemala."],
  ["ca12","Centroamérica","¿En qué país está la ciudad de Granada junto al lago Cocibolca?",["Nicaragua","Costa Rica","Belice","El Salvador"],0,"Granada está en Nicaragua."],
  ["ca13","Centroamérica","¿En qué país está la ciudad de San Pedro Sula?",["Honduras","Guatemala","Panamá","Costa Rica"],0,"San Pedro Sula está en Honduras."],
  ["ca14","Centroamérica","¿En qué país está la ciudad de Santa Ana?",["El Salvador","Belice","Nicaragua","Panamá"],0,"Santa Ana está en El Salvador."],
  ["ca15","Centroamérica","¿En qué país está la ciudad de Quetzaltenango?",["Guatemala","Honduras","Costa Rica","Panamá"],0,"Quetzaltenango está en Guatemala."],
  ["ca16","Centroamérica","¿En qué país está la ciudad de Limón?",["Costa Rica","El Salvador","Guatemala","Belice"],0,"Limón está en la costa caribeña de Costa Rica."],
  ["ca17","Centroamérica","¿En qué país está la ciudad de Colón?",["Panamá","Honduras","Nicaragua","Guatemala"],0,"Colón está en Panamá."],
  ["ca18","Centroamérica","¿Qué dos países comparten el golfo de Fonseca con Honduras?",["El Salvador y Nicaragua","Guatemala y Belice","Costa Rica y Panamá","México y Guatemala"],0,"El golfo es compartido por Honduras, El Salvador y Nicaragua."],
  ["ca19","Centroamérica","¿Cuál es el país más al norte de Centroamérica?",["Guatemala","Panamá","Costa Rica","Nicaragua"],0,"Guatemala ocupa el extremo norte de la región junto con Belice."],
  ["ca20","Centroamérica","¿Qué idioma oficial distingue a Belice de la mayoría de Centroamérica?",["Inglés","Italiano","Francés","Portugués"],0,"El idioma oficial de Belice es el inglés."],
  ["ca21","Centroamérica","¿Qué gran lago está en Nicaragua?",["Lago Cocibolca","Lago Titicaca","Lago Erie","Lago de Maracaibo"],0,"El lago Cocibolca también se conoce como lago de Nicaragua."],
  ["ca22","Centroamérica","¿Qué país es famoso por la frase 'pura vida'?",["Costa Rica","Belice","Guatemala","Honduras"],0,"La expresión se asocia especialmente con Costa Rica."],
  ["ca23","Centroamérica","¿Qué país tiene forma alargada y un famoso canal?",["Panamá","El Salvador","Belice","Guatemala"],0,"Panamá es estrecho y alargado de oeste a este."],
  ["ca24","Centroamérica","¿Qué civilización dejó ciudades como Tikal y Copán?",["Maya","Romana","Inca","Vikinga"],0,"Tikal y Copán fueron importantes ciudades mayas."],
  ["ca25","Centroamérica","¿Qué país comparte frontera terrestre con Honduras al oeste?",["Guatemala","Costa Rica","Panamá","Belice"],0,"Guatemala limita con Honduras al oeste."],
  ["ca26","Centroamérica","¿Qué país comparte frontera con Honduras al sureste?",["Nicaragua","Panamá","Costa Rica","México"],0,"Nicaragua limita con Honduras al sureste."],
  ["ca27","Centroamérica","¿Qué país está entre Nicaragua y Panamá?",["Costa Rica","Honduras","Guatemala","Belice"],0,"Costa Rica está entre ambos países."],
  ["ca28","Centroamérica","¿Cuál de estas ciudades está en Costa Rica?",["Cartago","Copán Ruinas","Omoa","Suchitoto"],0,"Cartago está en Costa Rica."],
  ["ca29","Centroamérica","¿Cuál de estas ciudades está en Nicaragua?",["León","La Ceiba","Santa Ana","Belmopán"],0,"León está en Nicaragua."],
  ["ca30","Centroamérica","¿Cuál de estas ciudades está en Guatemala?",["Flores","Choluteca","San Miguel","David"],0,"Flores está en Guatemala."],

  // Música en español: reconocer canciones y artistas
  ["mu01","Música","¿Quién canta “Tusa”?",["Karol G","Shakira","Becky G","Natti Natasha"],0,"Karol G canta “Tusa” junto a Nicki Minaj."],
  ["mu02","Música","¿Quién canta “Gasolina”?",["Daddy Yankee","Don Omar","Nicky Jam","Wisin"],0,"“Gasolina” es uno de los grandes éxitos de Daddy Yankee."],
  ["mu03","Música","¿Quién canta “Despacito”?",["Luis Fonsi","Enrique Iglesias","Carlos Vives","Chayanne"],0,"Luis Fonsi interpreta “Despacito” junto a Daddy Yankee."],
  ["mu04","Música","¿Quién canta “La Camisa Negra”?",["Juanes","Maná","Ricardo Arjona","Alejandro Sanz"],0,"“La Camisa Negra” es de Juanes."],
  ["mu05","Música","¿Quién canta “Vivir Mi Vida”?",["Marc Anthony","Víctor Manuelle","Romeo Santos","Prince Royce"],0,"Marc Anthony canta “Vivir Mi Vida”."],
  ["mu06","Música","¿Quién canta “Amor Prohibido”?",["Selena","Thalía","Paulina Rubio","Gloria Trevi"],0,"“Amor Prohibido” es uno de los temas más conocidos de Selena."],
  ["mu07","Música","¿Quién canta “Querida”?",["Juan Gabriel","José José","Marco Antonio Solís","Cristian Castro"],0,"Juan Gabriel interpreta “Querida”."],
  ["mu08","Música","¿Quién canta “El Rey”?",["Vicente Fernández","Pedro Infante","Luis Miguel","Joan Sebastian"],0,"Vicente Fernández hizo famosa su interpretación de “El Rey”."],
  ["mu09","Música","¿Quién canta “Ahora Te Puedes Marchar”?",["Luis Miguel","Chayanne","Emmanuel","Ricardo Montaner"],0,"Luis Miguel canta “Ahora Te Puedes Marchar”."],
  ["mu10","Música","¿Quién canta “Todos Me Miran”?",["Gloria Trevi","Alejandra Guzmán","Yuri","Lucero"],0,"“Todos Me Miran” es de Gloria Trevi."],
  ["mu11","Música","¿Quién canta “Rosas”?",["La Oreja de Van Gogh","Amaral","Mecano","Ha*Ash"],0,"La Oreja de Van Gogh canta “Rosas”."],
  ["mu12","Música","¿Quién canta “Color Esperanza”?",["Diego Torres","Juanes","Andrés Calamaro","Fito Páez"],0,"Diego Torres interpreta “Color Esperanza”."],
  ["mu13","Música","¿Quién canta “Rayando el Sol”?",["Maná","Café Tacvba","Enanitos Verdes","Los Prisioneros"],0,"“Rayando el Sol” es un clásico de Maná."],
  ["mu14","Música","¿Quién canta “Hasta el Amanecer”?",["Nicky Jam","Ozuna","Maluma","J Balvin"],0,"Nicky Jam canta “Hasta el Amanecer”."],
  ["mu15","Música","¿Quién canta “Me Rehúso”?",["Danny Ocean","Sebastián Yatra","Camilo","Manuel Turizo"],0,"“Me Rehúso” es de Danny Ocean."],
  ["mu16","Música","¿Quién canta “Felices los 4”?",["Maluma","J Balvin","Feid","Ozuna"],0,"Maluma canta “Felices los 4”."],
  ["mu17","Música","¿Quién canta “Provenza”?",["Karol G","Rosalía","Shakira","Becky G"],0,"“Provenza” es de Karol G."],
  ["mu18","Música","¿Quién canta “Danza Kuduro”?",["Don Omar","Daddy Yankee","Pitbull","Wisin y Yandel"],0,"Don Omar interpreta “Danza Kuduro” junto a Lucenzo."],
  ["mu19","Música","¿Quién canta “La Vida Es un Carnaval”?",["Celia Cruz","Gloria Estefan","Olga Tañón","La India"],0,"Celia Cruz canta “La Vida Es un Carnaval”."],
  ["mu20","Música","¿Quién canta “Bachata en Fukuoka”?",["Juan Luis Guerra","Romeo Santos","Prince Royce","Aventura"],0,"Juan Luis Guerra interpreta “Bachata en Fukuoka”."],

  // Ronda relámpago, deliberadamente obvia y divertida
  ["rr01","Relámpago","¿Qué usás para comer una sopa?",["Cuchara","Peine","Martillo","Control remoto"],0,"La cuchara salva la sopa."],
  ["rr02","Relámpago","¿Qué bebida suele servirse fría y con burbujas?",["Refresco","Caldo","Atol","Sopa"],0,"El refresco tiene gas y suele servirse frío."],
  ["rr03","Relámpago","¿Qué comida tiene pan arriba y abajo?",["Hamburguesa","Sopa","Tamal","Helado"],0,"Una hamburguesa clásica va entre dos panes."],
  ["rr04","Relámpago","¿Qué ingrediente hace llorar al cortarlo?",["Cebolla","Arroz","Queso","Frijol"],0,"La cebolla se lleva unas cuantas lágrimas."],
  ["rr05","Relámpago","¿Qué va primero para hacer un pedido en la app?",["Elegir la comida","Lavar el carro","Dormirse","Apagar el teléfono"],0,"Primero hay que escoger el antojo."],
  ["rr06","Relámpago","¿Cuál de estos sabores suele picar?",["Chile","Vainilla","Leche","Agua"],0,"El chile es el sospechoso habitual."],
  ["rr07","Relámpago","¿Qué se usa para brindar sin derramar la bebida?",["Vaso","Zapato","Sombrero","Almohada"],0,"El vaso es la opción más segura."],
  ["rr08","Relámpago","¿Qué número viene después del nueve?",["Diez","Ocho","Doce","Seis"],0,"Después de nueve viene diez."],
  ["rr09","Relámpago","¿Qué día viene después del viernes?",["Sábado","Lunes","Jueves","Martes"],0,"Después del viernes viene el sábado."],
  ["rr10","Relámpago","Si somos cuatro y llegan cuatro platos, ¿cuántos toca por persona?",["Uno","Dos","Tres","Ninguno"],0,"Uno para cada persona."],
];

export const CHUPISTICA_QUESTIONS = RAW.map(([id,category,prompt,options,correct,explanation]) => ({id,category,prompt,options,correct,explanation}));

export function validateChupisticaQuestions() {
  const ids=new Set();
  for(const q of CHUPISTICA_QUESTIONS){
    if(!/^[a-z]{2}\d{2}$/.test(q.id)||ids.has(q.id)) throw new Error('ID de pregunta inválido: '+q.id);
    ids.add(q.id);
    if(!q.category||!q.prompt||!q.explanation||q.options.length!==4||q.correct<0||q.correct>3) throw new Error('Pregunta incompleta: '+q.id);
    if(new Set(q.options).size!==4) throw new Error('Opciones repetidas: '+q.id);
  }
  if(CHUPISTICA_QUESTIONS.length<100) throw new Error('Se requieren al menos 100 preguntas.');
  return true;
}
