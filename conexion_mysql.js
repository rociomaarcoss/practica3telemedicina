// Importar la librería mysql 
const mysql = require('mysql');

// Definimos un objeto de configuración con las credenciales 
const database = {
    host: 'localhost',
    user: 'tele2026', 
    password: '2026tele', 
    database: 'telemedicina2026'
};

// Creamos un objeto de conexión 
const conexion = mysql.createConnection(database);

// Realizamos la conexión y si falla gestionamos el error
conexion.connect(function (err) {
    if (err) {
        console.error('Error en la conexión de la base de datos:', err);
        process.exit(1);
    }
    console.log('Conectado correctamente a la base de datos telemedicina2026');
});

module.exports = conexion;