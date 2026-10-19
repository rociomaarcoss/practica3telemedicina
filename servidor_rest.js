var conexion = require("./conexion_mysql.js");
var express = require("express");
var cors = require("cors");
var jwt = require("jwt-simple"); // Módulo para JWT
var clave = "miSecretoMasOscuro"; // Clave para codificar / decodificar el token

// Importar el cliente de Supabase
const {createClient} = require('@supabase/supabase-js');

// Configurar con la URL y Public Key
const supabaseUrl = 'https://ahbztuflnthqiselzajz.supabase.co';
const supabaseKey = 'sb_publishable_trXeaIZvOlmuRuoN4FJFpA_VghOLDRd';
const supabase = createClient(supabaseUrl, supabaseKey);


var app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('cliente_rest'));

// =========================================================================
// --- SERVICIOS PÚBLICOS (Antes del middleware: NO necesitan token) ---
// =========================================================================

// Login de gestores: valida credenciales y devuelve el ID y el Token
app.post("/api/gestores/login", function (req, res) {
    var login = req.body.login;
    var password = req.body.password;
    var sql = "SELECT id FROM gestores WHERE usuario = '" + login + "' AND password = '" + password + "'";
    
    conexion.query(sql, function (err, resultados) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            if (resultados.length > 0) {
                var idGestor = resultados[0].id;

                // Crear el token (igual que en el ejemplo del profesor)
                var contenido = {
                    usuario: idGestor,
                    expira: Date.now() + 60 * 60 * 1000 // expira dentro de 1 hora (en ms)
                };
                var token = jwt.encode(contenido, clave);

                // Devolvemos el id del gestor y el token generado
                res.status(200).json({ id: idGestor, token: token });
            } else {
                res.status(403).send();
            }
        }
    });
});

// Registro de nuevo gestor: público para poder crear cuenta desde la pantalla de acceso
app.post("/api/gestores", function (req, res) {
    var gestor = req.body;
    var sql = "INSERT INTO gestores (nombre, apellidos, usuario, password) VALUES('" + gestor.nombre + "','" + gestor.apellidos + "','" + gestor.usuario + "','" + gestor.password + "')";
    
    conexion.query(sql, function (err, resultado) {
        if (err) {
            console.log("Error al realizar el insert", err);
            if (err.code === 'ER_DUP_ENTRY') {
                res.status(400).json({error: "Usuario ya existe"});
            } else {
                res.status(500).json("Error al realizar la insercion");
            }
        } else {
            res.status(201).json(resultado.insertId);
        }
    });
});

// =========================================================================
// --- MIDDLEWARE DE VALIDACIÓN DE TOKEN (Protege los servicios privados) ---
// =========================================================================
app.use("/api", function (req, res, next) {
    var token = req.query.token; // obtenemos el token de la query: ?token=XXXXXXXX
    if (!token) {
        res.status(301).json("No se ha encontrado token");
        return;
    }

    // Decodificar el token
    try {
        var contenidoToken = jwt.decode(token, clave);
    } catch (error) {
        res.status(301).json("El token es incorrecto");
        return;
    }

    // console.log("El contenido del token es:", contenidoToken);

    // Validar el formato del token
    if (!contenidoToken || !contenidoToken.expira || !contenidoToken.usuario) {
        res.status(301).json("El formato del token no es adecuado");
        return;
    }

    // Comprobar la fecha de expiración
    if (contenidoToken.expira < Date.now()) {
        res.status(301).json("El token ha expirado");
        return;
    }

    // Todo ha ido bien, continuamos con el procesado del servicio
    next();
});

// =========================================================================
// --- SERVICIOS PRIVADOS (Después del middleware: TODOS exigen token) ---
// =========================================================================

app.put("/api/gestores/:id", function (req, res) {
    var idGestor = req.params.id;
    var gestor = req.body;
    var sql = "UPDATE gestores SET nombre = '" + gestor.nombre + "', apellidos = '" + gestor.apellidos + "', usuario = '" + gestor.usuario + "', password = '" + gestor.password + "' WHERE id = " + idGestor;
    
    conexion.query(sql, function (err, resultado) {
        if (err) {
            console.log("Error al realizar el update", err);
            if (err.code === 'ER_DUP_ENTRY') {
                res.status(400).json({error: "Usuario ya existe"});
            } else {
                res.status(500).json("Error al realizar la actualización");
            }
        } else {
            res.status(200).json("Gestor actualizado");
        }
    });
});

app.get("/api/gestores/:id", function (req, res) {
    var idGestor = req.params.id;
    var sql = "SELECT id, nombre, apellidos, usuario FROM gestores WHERE id = " + idGestor;
    conexion.query(sql, function (err, gestores) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            if (gestores.length === 1) {
                res.status(200).json(gestores[0]);
            } else {
                res.status(404).json("No se ha encontrado el gestor");
            }
        }
    });
});

// --- SERVICIOS SANITARIOS ---
app.get("/api/sanitarios/:id", function (req, res) {
    var idSanitario = req.params.id;
    var sql = "SELECT id, nombre, apellidos, usuario FROM sanitarios WHERE id = " + idSanitario;
    conexion.query(sql, function (err, sanitarios) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            if (sanitarios.length === 1) {
                res.status(200).json(sanitarios[0]);
            } else {
                res.status(404).json("No se ha encontrado el sanitario");
            }
        }
    });
});

// --- SERVICIOS MAESTROS ---
app.get("/api/ubicaciones", function (req, res) {
    var sql = "SELECT * FROM ubicaciones";
    conexion.query(sql, function (err, ubicaciones) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            res.json(ubicaciones);
        }
    });
});

app.get("/api/categorias", function (req, res) {
    var sql = "SELECT * FROM categorias";
    conexion.query(sql, function (err, categorias) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            res.json(categorias);
        }
    });
});

app.get("/api/modelos", function (req, res) {
    var sql = "SELECT * FROM modelos";
    conexion.query(sql, function (err, modelos) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            res.json(modelos);
        }
    });
});

// --- SERVICIOS RECURSOS ---
app.get("/api/recursos", function (req, res) {
    var sql = "SELECT r.* FROM recursos r";
    var hasWhere = false;

    if (req.query.categoria && req.query.categoria !== 'Todos') {
        sql += " JOIN modelos m ON r.modelo = m.id WHERE m.categoria = " + req.query.categoria;
        hasWhere = true;
    }

    if (req.query.modelo && req.query.modelo !== 'Todos') {
        if (hasWhere) {
            sql += " AND r.modelo = " + req.query.modelo;
        } else {
            sql += " WHERE r.modelo = " + req.query.modelo;
            hasWhere = true;
        }
    }

    if (req.query.ubicacion && req.query.ubicacion !== 'Todos') {
        if (hasWhere) {
            sql += " AND r.ubicacion = " + req.query.ubicacion;
        } else {
            sql += " WHERE r.ubicacion = " + req.query.ubicacion;
            hasWhere = true;
        }
    }

    if (req.query.estado && req.query.estado !== 'Todos') {
        if (hasWhere) {
            sql += " AND r.estado = " + req.query.estado;
        } else {
            sql += " WHERE r.estado = " + req.query.estado;
            hasWhere = true;
        }
    }

    conexion.query(sql, function (err, recursos) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            res.json(recursos);
        }
    });
});

app.get("/api/recursos/:id", function (req, res) {
    var idRecurso = req.params.id;
    var sql = "SELECT * FROM recursos WHERE id = " + idRecurso;
    conexion.query(sql, function (err, recursos) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            if (recursos.length === 1) {
                res.status(200).json(recursos[0]);
            } else {
                res.status(404).json("No se ha encontrado el recurso");
            }
        }
    });
});

app.post("/api/recursos", function (req, res) {
    var recurso = req.body;
    var sql = "INSERT INTO recursos (modelo, ubicacion, numero_serie, estado) VALUES(" + recurso.modelo + "," + recurso.ubicacion + ",'" + recurso.numero_serie + "'," + recurso.estado + ")";
    
    conexion.query(sql, function (err, resultado) {
        if (err) {
            console.log("Error al realizar el insert", err);
            res.status(500).json("Error al realizar la insercion");
        } else {
            res.status(201).json(resultado.insertId);
        }
    });
});

app.put("/api/recursos/:id", function (req, res) {
    var idRecurso = req.params.id;
    var recurso = req.body;
    var sql = "UPDATE recursos SET modelo = " + recurso.modelo + ", ubicacion = " + recurso.ubicacion + ", numero_serie = '" + recurso.numero_serie + "', estado = " + recurso.estado + " WHERE id = " + idRecurso;
    
    conexion.query(sql, function (err, resultado) {
        if (err) {
            console.log("Error al realizar el update", err);
            res.status(500).json("Error al realizar la actualización");
        } else {
            if (resultado.affectedRows === 0) {
                res.status(404).json("No se ha encontrado el recurso");
            } else {
                res.status(200).json("Recurso actualizado");
            }
        }
    });
});

app.delete("/api/recursos/:id", function (req, res) {
    var idRecurso = req.params.id;
    var sql = "DELETE FROM recursos WHERE id = " + idRecurso;
    
    conexion.query(sql, function (err, resultado) {
        if (err) {
            console.log("Error al realizar el delete", err);
            res.status(500).json("Error al realizar el borrado");
        } else {
            if (resultado.affectedRows === 0) {
                res.status(404).json("No se ha encontrado el recurso");
            } else {
                res.status(200).json("Recurso eliminado");
            }
        }
    });
});

app.get("/api/recursos/:id/reservas", function (req, res) {
    var idRecurso = req.params.id;
    var sql = "SELECT r.*, CONCAT(s.nombre, ' ', s.apellidos) AS nombreSanitario FROM reservas r JOIN sanitarios s ON r.sanitario = s.id WHERE r.recurso = " + idRecurso;
    
    conexion.query(sql, function (err, reservas) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            if (reservas.length === 0) {
                var sqlRecurso = "SELECT id FROM recursos WHERE id = " + idRecurso;
                conexion.query(sqlRecurso, function(err2, recursos){
                    if (err2) {
                        console.log("Error al realizar la select", err2);
                        res.status(500).json("Error al realizar la consulta");
                    } else if (recursos.length === 0) {
                        res.status(404).json("No se ha encontrado el recurso");
                    } else {
                        res.json(reservas);
                    }
                });
            } else {
                res.json(reservas);
            }
        }
    });
});

app.get("/api/recursos/:id/resenyas", function (req, res) {
    var idRecurso = req.params.id;
    var sql = "SELECT r.*, CONCAT(s.nombre, ' ', s.apellidos) AS nombreSanitario FROM resenyas r JOIN sanitarios s ON r.sanitario = s.id WHERE r.recurso = " + idRecurso;
    
    conexion.query(sql, function (err, resenyas) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            if (resenyas.length === 0) {
                var sqlRecurso = "SELECT id FROM recursos WHERE id = " + idRecurso;
                conexion.query(sqlRecurso, function(err2, recursos){
                    if (err2) {
                        console.log("Error al realizar la select", err2);
                        res.status(500).json("Error al realizar la consulta");
                    } else if (recursos.length === 0) {
                        res.status(404).json("No se ha encontrado el recurso");
                    } else {
                        res.json(resenyas);
                    }
                });
            } else {
                res.json(resenyas);
            }
        }
    });
});

app.listen(3000, function () {
    console.log("Servidor REST de Telemedicina en el puerto 3000");
});
