// OiMira Toppers — 12 modelos profesionales de partida (3 colecciones)
// Cada modelo es un punto de partida completo: texto, tipografía, placa, figura, adorno y paleta.
// Se personaliza todo después; los nombres de motivo/adorno apuntan a la biblioteca (motivos-data / adornos-data / motivos-pro-data).
var MODELOS = [
  /* ===== ELEGANTE · Caligrafía botánica ===== */
  { id:"mariposas-boutique", col:"elegante", nombre:"Mariposas boutique", ocasion:"15 años",
    campos:{ l1:"Mis 15", l2:"Valentina", l3:"", fuente:"greatvibes", arco:"0", placa:"contorno",
             estiloMot:"detalles", motPos:"arriba", motTam:"85", adPos:"abajo", adTam:"100",
             ancho:"150", grosor:"3", relieve:"1.2", palLen:"45" },
    palitos:true, bordeOn:false, motivo:"Mariposa", adorno:"Volutas con corazón",
    colores:["#fdf6ee","#b44f61","#b44f61","#d9a066","#1c1c1c"] },

  { id:"rosa-clasica", col:"elegante", nombre:"Rosa clásica", ocasion:"Día de la Madre",
    campos:{ l1:"Feliz Día", l2:"Mamá", l3:"", fuente:"greatvibes", arco:"0", placa:"contorno",
             estiloMot:"detalles", motPos:"arriba", motTam:"80", adPos:"abajo", adTam:"110",
             ancho:"140", grosor:"3", relieve:"1.2", palLen:"45" },
    palitos:true, bordeOn:false, motivo:"Flor ♀", adorno:"Divisor suave",
    colores:["#ffffff","#1c1c1c","#d32f2f","#b44f61","#1c1c1c"] },

  { id:"corona-real", col:"elegante", nombre:"Corona real", ocasion:"15 años",
    campos:{ l1:"Felices 15", l2:"Camila", l3:"", fuente:"greatvibes", arco:"0", placa:"aro",
             estiloMot:"detalles", motPos:"arriba", motTam:"75", adPos:"abajo", adTam:"90",
             ancho:"150", grosor:"3", relieve:"1.2", palLen:"45" },
    palitos:true, bordeOn:false, motivo:"Tiara ♀", adorno:"Volutas clásicas",
    colores:["#f5f5f5","#d9a066","#d9a066","#d9a066","#1c1c1c"] },

  { id:"boda-infinita", col:"elegante", nombre:"Boda infinita", ocasion:"Boda",
    campos:{ l1:"Ana & Luis", l2:"Felicidades", l3:"", fuente:"greatvibes", arco:"0", placa:"contorno",
             estiloMot:"detalles", motPos:"arriba", motTam:"70", adPos:"abajo", adTam:"110",
             ancho:"160", grosor:"3", relieve:"1.2", palLen:"45" },
    palitos:true, bordeOn:false, motivo:"Anillos", adorno:"Infinito con corazón",
    colores:["#ffffff","#1c1c1c","#d9a066","#d9a066","#1c1c1c"] },

  /* ===== MODERNA · Geometría contemporánea ===== */
  { id:"cumple-editorial", col:"moderna", nombre:"Cumple editorial", ocasion:"Cumpleaños",
    campos:{ l1:"Feliz Cumpleaños", l2:"Sofía", l3:"", fuente:"poppins", arco:"0", placa:"rect",
             estiloMot:"detalles", motPos:"arriba", motTam:"70", adPos:"abajo", adTam:"100",
             ancho:"150", grosor:"3", relieve:"1.2", palLen:"45" },
    palitos:true, bordeOn:true, motivo:"Estrella", adorno:null,
    colores:["#1c1c1c","#f5f5f5","#fbc02d","#f48fb1","#d9a066"] },

  { id:"letras-acrilico", col:"moderna", nombre:"Letras acrílico", ocasion:"Cumpleaños",
    campos:{ l1:"Cumple", l2:"Mateo", l3:"", fuente:"poppins", arco:"0", placa:"letras",
             estiloMot:"detalles", motPos:"arriba", motTam:"80", adPos:"abajo", adTam:"100",
             ancho:"140", grosor:"3", relieve:"1.2", palLen:"45" },
    palitos:true, bordeOn:false, motivo:"Globos", adorno:null,
    colores:["#1c1c1c","#f5f5f5","#1565c0","#f48fb1","#1c1c1c"] },

  { id:"graduacion", col:"moderna", nombre:"Graduación", ocasion:"Graduación",
    campos:{ l1:"Lo lograste", l2:"Andrea", l3:"", fuente:"poppins", arco:"0", placa:"contorno",
             estiloMot:"detalles", motPos:"arriba", motTam:"80", adPos:"abajo", adTam:"110",
             ancho:"150", grosor:"3", relieve:"1.2", palLen:"45" },
    palitos:true, bordeOn:false, motivo:"Birrete", adorno:"Laurel",
    colores:["#f5f5f5","#1c3a6b","#1c3a6b","#d9a066","#1c1c1c"] },

  { id:"amor-minimal", col:"moderna", nombre:"Amor minimal", ocasion:"San Valentín",
    campos:{ l1:"Te amo", l2:"", l3:"", fuente:"poppins", arco:"0", placa:"aro",
             estiloMot:"detalles", motPos:"arriba", motTam:"90", adPos:"abajo", adTam:"100",
             ancho:"130", grosor:"3", relieve:"1.2", palLen:"45" },
    palitos:true, bordeOn:false, motivo:"Corazones ♀", adorno:"Flecha boho",
    colores:["#f5f5f5","#1c1c1c","#d32f2f","#1c1c1c","#1c1c1c"] },

  /* ===== CREATIVA · Personajes con encanto ===== */
  { id:"osito-corazon", col:"creativa", nombre:"Osito con corazón", ocasion:"Baby shower",
    campos:{ l1:"Bienvenido", l2:"Thiago", l3:"", fuente:"fredoka", arco:"0", placa:"contorno",
             estiloMot:"detalles", motPos:"arriba", motTam:"110", adPos:"abajo", adTam:"100",
             ancho:"150", grosor:"3", relieve:"1.2", palLen:"45" },
    palitos:true, bordeOn:false, motivo:"Osito Pro", adorno:"Guirnalda de corazones",
    colores:["#dbeaf7","#1565c0","#bc7459","#f48fb1","#1c1c1c"] },

  { id:"fiesta-globos", col:"creativa", nombre:"Fiesta de globos", ocasion:"Cumpleaños",
    campos:{ l1:"Feliz Cumple", l2:"Lucía", l3:"", fuente:"baloo", arco:"35", placa:"contorno",
             estiloMot:"detalles", motPos:"arriba", motTam:"100", adPos:"abajo", adTam:"100",
             ancho:"150", grosor:"3", relieve:"1.2", palLen:"45" },
    palitos:true, bordeOn:false, motivo:"Globos", adorno:"Cinta",
    colores:["#fbc02d","#1c1c1c","#f48fb1","#1565c0","#1c1c1c"] },

  { id:"flork-fiesta", col:"creativa", nombre:"Flork de fiesta", ocasion:"Cumpleaños",
    campos:{ l1:"Feliz cumple", l2:"Diego", l3:"", fuente:"fredoka", arco:"0", placa:"contorno",
             estiloMot:"detalles", motPos:"arriba", motTam:"115", adPos:"abajo", adTam:"100",
             ancho:"140", grosor:"3", relieve:"1.2", palLen:"45" },
    palitos:true, bordeOn:false, motivo:"Flork fiesta", adorno:null,
    colores:["#f5f5f5","#d32f2f","#1c1c1c","#f48fb1","#1c1c1c"] },

  { id:"tortita-dulce", col:"creativa", nombre:"Tortita dulce", ocasion:"Cumpleaños",
    campos:{ l1:"Feliz Cumpleaños", l2:"Emma", l3:"", fuente:"pacifico", arco:"0", placa:"ovalo",
             estiloMot:"detalles", motPos:"arriba", motTam:"85", adPos:"abajo", adTam:"100",
             ancho:"150", grosor:"3", relieve:"1.2", palLen:"45" },
    palitos:true, bordeOn:true, motivo:"Torta", adorno:"Divisor suave",
    colores:["#f48fb1","#ffffff","#5d3a1a","#ffffff","#5d3a1a"] }
];
var COLECCIONES = {
  elegante: { nombre:"Elegante", familia:"Caligrafía botánica", desc:"Flores, mariposas y filigranas alrededor del nombre." },
  moderna:  { nombre:"Moderna",  familia:"Geometría contemporánea", desc:"Marcos, estrellas y tipografía con contraste." },
  creativa: { nombre:"Creativa", familia:"Personajes con encanto", desc:"Ilustraciones expresivas, globos y rótulos." }
};
