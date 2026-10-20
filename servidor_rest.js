var express = require("express");
var cors = require("cors");
var jwt = require("jwt-simple"); // Módulo para JWT
var clave = "miSecretoMasOscuro"; // Clave para codificar / decodificar el token

// Importar el cliente de Supabase
const { createClient } = require('@supabase/supabase-js');

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
app.post("/api/gestores/login", async function (req, res) {
    var login = req.body.login;
    var password = req.body.password;

    const { data: resultados, error } = await supabase
        .from('gestores')
        .select('id')
        .eq('usuario', login)
        .eq('password', password); // Si tu columna en Supabase se llama 'contrasena', pon .eq('contrasena', password)

    if (error) {
        console.log("Error al realizar la select", error);
        res.status(500).json("Error al realizar la consulta");
    } else {
        if (resultados && resultados.length > 0) {
            var idGestor = resultados[0].id;

            // Crear el token
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

// Registro de nuevo gestor: público para poder crear cuenta desde la pantalla de acceso
app.post("/api/gestores", async function (req, res) {
    var gestor = req.body;

    const { data, error } = await supabase
        .from('gestores')
        .insert([{
            nombre: gestor.nombre,
            apellidos: gestor.apellidos,
            usuario: gestor.usuario,
            password: gestor.password // Cambia a 'contrasena' si tu columna se llama así
        }])
        .select();

    if (error) {
        console.log("Error al realizar el insert", error);
        if (error.code === '23505') { // Código de duplicado en PostgreSQL
            res.status(400).json({ error: "Usuario ya existe" });
        } else {
            res.status(500).json("Error al realizar la insercion");
        }
    } else {
        res.status(201).json(data[0].id);
    }
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

app.put("/api/gestores/:id", async function (req, res) {
    var idGestor = req.params.id;
    var gestor = req.body;

    const { data, error } = await supabase
        .from('gestores')
        .update({
            nombre: gestor.nombre,
            apellidos: gestor.apellidos,
            usuario: gestor.usuario,
            password: gestor.password // Cambia a 'contrasena' si tu columna se llama así
        })
        .eq('id', idGestor)
        .select();

    if (error) {
        console.log("Error al realizar el update", error);
        if (error.code === '23505') {
            res.status(400).json({ error: "Usuario ya existe" });
        } else {
            res.status(500).json("Error al realizar la actualización");
        }
    } else {
        res.status(200).json("Gestor actualizado");
    }
});

app.get("/api/gestores/:id", async function (req, res) {
    var idGestor = req.params.id;

    const { data: gestores, error } = await supabase
        .from('gestores')
        .select('id, nombre, apellidos, usuario')
        .eq('id', idGestor);

    if (error) {
        console.log("Error al realizar la select", error);
        res.status(500).json("Error al realizar la consulta");
    } else {
        if (gestores && gestores.length === 1) {
            res.status(200).json(gestores[0]);
        } else {
            res.status(404).json("No se ha encontrado el gestor");
        }
    }
});

// --- SERVICIOS SANITARIOS ---
app.get("/api/sanitarios/:id", async function (req, res) {
    var idSanitario = req.params.id;

    const { data: sanitarios, error } = await supabase
        .from('sanitarios')
        .select('id, nombre, apellidos, usuario')
        .eq('id', idSanitario);

    if (error) {
        console.log("Error al realizar la select", error);
        res.status(500).json("Error al realizar la consulta");
    } else {
        if (sanitarios && sanitarios.length === 1) {
            res.status(200).json(sanitarios[0]);
        } else {
            res.status(404).json("No se ha encontrado el sanitario");
        }
    }
});

// --- SERVICIOS MAESTROS ---
app.get("/api/ubicaciones", async function (req, res) {
    const { data: ubicaciones, error } = await supabase
        .from('ubicaciones')
        .select('*');

    if (error) {
        console.log("Error al realizar la select", error);
        res.status(500).json("Error al realizar la consulta");
    } else {
        res.json(ubicaciones);
    }
});

app.get("/api/categorias", async function (req, res) {
    const { data: categorias, error } = await supabase
        .from('categorias')
        .select('*');

    if (error) {
        console.log("Error al realizar la select", error);
        res.status(500).json("Error al realizar la consulta");
    } else {
        res.json(categorias);
    }
});

app.get("/api/modelos", async function (req, res) {
    const { data: modelos, error } = await supabase
        .from('modelos')
        .select('*');

    if (error) {
        console.log("Error al realizar la select", error);
        res.status(500).json("Error al realizar la consulta");
    } else {
        res.json(modelos);
    }
});

// --- SERVICIOS RECURSOS ---
app.get("/api/recursos", async function (req, res) {
    let query = supabase.from('recursos').select('*');

    // Si filtran por categoría, buscamos primero los IDs de los modelos de esa categoría
    if (req.query.categoria && req.query.categoria !== 'Todos') {
        const { data: modelosCat, error: errMod } = await supabase
            .from('modelos')
            .select('id')
            .eq('categoria', req.query.categoria);

        if (errMod) {
            console.log("Error al filtrar modelos por categoría", errMod);
            return res.status(500).json("Error al realizar la consulta");
        }
        const idsModelos = modelosCat.map(m => m.id);
        query = query.in('modelo', idsModelos);
    }

    if (req.query.modelo && req.query.modelo !== 'Todos') {
        query = query.eq('modelo', req.query.modelo);
    }

    if (req.query.ubicacion && req.query.ubicacion !== 'Todos') {
        query = query.eq('ubicacion', req.query.ubicacion);
    }

    if (req.query.estado && req.query.estado !== 'Todos') {
        query = query.eq('estado', req.query.estado);
    }

    const { data: recursos, error } = await query;

    if (error) {
        console.log("Error al realizar la select", error);
        res.status(500).json("Error al realizar la consulta");
    } else {
        res.json(recursos);
    }
});

app.get("/api/recursos/:id", async function (req, res) {
    var idRecurso = req.params.id;

    const { data: recursos, error } = await supabase
        .from('recursos')
        .select('*')
        .eq('id', idRecurso);

    if (error) {
        console.log("Error al realizar la select", error);
        res.status(500).json("Error al realizar la consulta");
    } else {
        if (recursos && recursos.length === 1) {
            res.status(200).json(recursos[0]);
        } else {
            res.status(404).json("No se ha encontrado el recurso");
        }
    }
});

app.post("/api/recursos", async function (req, res) {
    var recurso = req.body;

    const { data, error } = await supabase
        .from('recursos')
        .insert([{
            modelo: recurso.modelo,
            ubicacion: recurso.ubicacion,
            numero_serie: recurso.numero_serie,
            estado: recurso.estado
        }])
        .select();

    if (error) {
        console.log("Error al realizar el insert", error);
        res.status(500).json("Error al realizar la insercion");
    } else {
        res.status(201).json(data[0].id);
    }
});

app.put("/api/recursos/:id", async function (req, res) {
    var idRecurso = req.params.id;
    var recurso = req.body;

    const { data, error } = await supabase
        .from('recursos')
        .update({
            modelo: recurso.modelo,
            ubicacion: recurso.ubicacion,
            numero_serie: recurso.numero_serie,
            estado: recurso.estado
        })
        .eq('id', idRecurso)
        .select();

    if (error) {
        console.log("Error al realizar el update", error);
        res.status(500).json("Error al realizar la actualización");
    } else {
        if (!data || data.length === 0) {
            res.status(404).json("No se ha encontrado el recurso");
        } else {
            res.status(200).json("Recurso actualizado");
        }
    }
});

app.delete("/api/recursos/:id", async function (req, res) {
    var idRecurso = req.params.id;

    const { data, error } = await supabase
        .from('recursos')
        .delete()
        .eq('id', idRecurso)
        .select();

    if (error) {
        console.log("Error al realizar el delete", error);
        res.status(500).json("Error al realizar el borrado");
    } else {
        if (!data || data.length === 0) {
            res.status(404).json("No se ha encontrado el recurso");
        } else {
            res.status(200).json("Recurso eliminado");
        }
    }
});

app.get("/api/recursos/:id/reservas", async function (req, res) {
    var idRecurso = req.params.id;

    const { data: reservas, error } = await supabase
        .from('reservas')
        .select('*, sanitarios(nombre, apellidos)')
        .eq('recurso', idRecurso);

    if (error) {
        console.log("Error al realizar la select", error);
        res.status(500).json("Error al realizar la consulta");
    } else {
        if (!reservas || reservas.length === 0) {
            const { data: recursos, error: err2 } = await supabase
                .from('recursos')
                .select('id')
                .eq('id', idRecurso);

            if (err2) {
                console.log("Error al realizar la select", err2);
                res.status(500).json("Error al realizar la consulta");
            } else if (!recursos || recursos.length === 0) {
                res.status(404).json("No se ha encontrado el recurso");
            } else {
                res.json([]);
            }
        } else {
            // Formateamos nombreSanitario igual que hacía el CONCAT de MySQL
            const reservasFormateadas = reservas.map(r => {
                const nombreCompleto = r.sanitarios ? (r.sanitarios.nombre + ' ' + r.sanitarios.apellidos) : '';
                return {
                    ...r,
                    nombreSanitario: nombreCompleto
                };
            });
            res.json(reservasFormateadas);
        }
    }
});

app.get("/api/recursos/:id/resenyas", async function (req, res) {
    var idRecurso = req.params.id;

    const { data: resenyas, error } = await supabase
        .from('resenyas')
        .select('*, sanitarios(nombre, apellidos)')
        .eq('recurso', idRecurso);

    if (error) {
        console.log("Error al realizar la select", error);
        res.status(500).json("Error al realizar la consulta");
    } else {
        if (!resenyas || resenyas.length === 0) {
            const { data: recursos, error: err2 } = await supabase
                .from('recursos')
                .select('id')
                .eq('id', idRecurso);

            if (err2) {
                console.log("Error al realizar la select", err2);
                res.status(500).json("Error al realizar la consulta");
            } else if (!recursos || recursos.length === 0) {
                res.status(404).json("No se ha encontrado el recurso");
            } else {
                res.json([]);
            }
        } else {
            const resenyasFormateadas = resenyas.map(r => {
                const nombreCompleto = r.sanitarios ? (r.sanitarios.nombre + ' ' + r.sanitarios.apellidos) : '';
                return {
                    ...r,
                    nombreSanitario: nombreCompleto
                };
            });
            res.json(resenyasFormateadas);
        }
    }
});

var puerto = process.env.PORT || 3000;
app.listen(puerto, function () {
    console.log("Servidor REST de Telemedicina en el puerto " + puerto);
});
