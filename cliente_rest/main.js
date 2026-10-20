let estadoApp = {
    usuarioId: null,
    token: null, // Guardaremos aquí el token JWT al iniciar sesión
    maestros: { cat: [], mod: [], ubi: [] }
};
 
// --- VARIABLES PARA WEBSOCKET (Parte 3) ---
var wsConexion = null;   // conexión WebSocket activa
var nombreGestor = "";   // nombre completo del gestor, para identificarse en el WS
 
document.addEventListener('DOMContentLoaded', () => {
    navegar('login-view');
});
 
function navegar(vistaId) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.getElementById(vistaId).style.display = 'block';
}
 
// INICIAR SESIÓN (LOGIN)
function handleLogin() {
    const u = document.getElementById('login-u').value;
    const p = document.getElementById('login-p').value;
    
    // Petición pública: devuelve { id, token }
    rest.post('/api/gestores/login', { login: u, password: p }, function(status, response) {
        if (status === 200) {
            estadoApp.usuarioId = response.id; // Guardamos el ID del gestor
            estadoApp.token = response.token;  // Guardamos el Token JWT
            cargarMaestrosYEntrar();
        } else {
            alert("Credenciales incorrectas");
        }
    });
}
 
function logout() {
    // Cerramos la conexión WebSocket antes de salir
    if (wsConexion !== null) wsConexion.close();
    location.reload(); 
}
 
// CARGA DE DATOS MAESTROS (Con ?token=...)
function cargarMaestrosYEntrar() {
    rest.get('/api/categorias?token=' + estadoApp.token, function(statusCat, resCat) {
        if (statusCat === 200) estadoApp.maestros.cat = resCat;
        
        rest.get('/api/modelos?token=' + estadoApp.token, function(statusMod, resMod) {
            if (statusMod === 200) estadoApp.maestros.mod = resMod;
            
            rest.get('/api/ubicaciones?token=' + estadoApp.token, function(statusUbi, resUbi) {
                if (statusUbi === 200) estadoApp.maestros.ubi = resUbi;
                
                // Cuando terminan de descargar los 3, cargamos la vista
                cargarComboFiltros(); 
                navegar('home-view');
                cargarTablaRecursos(); // Cargamos la tabla vacía inicialmente
                cargarRankingMinisterio();

                // Obtenemos los datos del gestor para saludarle y para el WebSocket
                rest.get('/api/gestores/' + estadoApp.usuarioId + '?token=' + estadoApp.token, function(statusGestor, resGestor) {
                    if (statusGestor === 200) {
                        nombreGestor = resGestor.nombre + " " + resGestor.apellidos;
                        document.getElementById('welcome-user').innerText = `Bienvenido ${resGestor.nombre} ${resGestor.apellidos}`;
                        // Abrimos la conexión WebSocket ahora que tenemos todos los datos
                        conectarWS();
                    }
                });
            });
        });
    });
}
 
// --- FUNCIONES WEBSOCKET (Parte 3) ---
function conectarWS() {
    wsConexion = new WebSocket("ws://localhost:4444", "hospital-avisos");
 
    wsConexion.addEventListener("open", function () {
        wsConexion.send(JSON.stringify({
            operacion: "conectar",
            id: estadoApp.usuarioId,
            tipo: "gestor",
            nombre: nombreGestor
        }));
    });
 
    wsConexion.addEventListener("message", function (event) {
        var msg = JSON.parse(event.data);
        if (msg.operacion === "aviso") {
            recibirAviso(msg);
        }
    });
}
 
function recibirAviso(msg) {
    var tbody = document.getElementById('tbody-avisos');
    var fila = document.createElement('tr');

    var colorFondo = '#ffffff';
    if (msg.color === 'azul')  colorFondo = '#9bc9f9';
    if (msg.color === 'verde') colorFondo = '#89e89f';

    fila.style.backgroundColor = colorFondo;
    fila.innerHTML = '<td>' + new Date(msg.fecha).toLocaleString() + '</td>' +
                     '<td>' + msg.origen + '</td>' +
                     '<td>' + msg.texto + '</td>';
    tbody.appendChild(fila);
}
// --- FIN FUNCIONES WEBSOCKET ---
 
function cargarComboFiltros() {
    llenarSelect('filtro-cat', estadoApp.maestros.cat, true);
    llenarSelect('filtro-mod', estadoApp.maestros.mod, true);
    llenarSelect('filtro-ubi', estadoApp.maestros.ubi, true);
}
 
function llenarSelect(idDom, datos, opcionTodos = false) {
    const sel = document.getElementById(idDom);
    if(opcionTodos){
        sel.innerHTML = '<option value="Todos">Todos</option>';
    } else {
        sel.innerHTML = '';
    }
    datos.forEach(d => {
        sel.innerHTML += `<option value="${d.id}">${d.nombre}</option>`;
    });
}
 
function actualizarModelos(modo) {
    let idCat, idMod, incluyeTodos;
 
    if (modo === 'filtro') {
        idCat = 'filtro-cat';
        idMod = 'filtro-mod';
        incluyeTodos = true; 
    } else {
        idCat = 'form-cat';
        idMod = 'form-mod';
        incluyeTodos = false; 
    }
 
    const idCatElegida = document.getElementById(idCat).value;
 
    if (idCatElegida === "Todos") {
        llenarSelect(idMod, estadoApp.maestros.mod, incluyeTodos);
    } else {
        const modelosFiltrados = estadoApp.maestros.mod.filter(m => m.categoria == idCatElegida);
        llenarSelect(idMod, modelosFiltrados, incluyeTodos);
    }
}
 
// LISTADO DE RECURSOS (Con token incluido en los queryParams)
function cargarTablaRecursos() {
    const categoria = document.getElementById('filtro-cat').value;
    const modelo = document.getElementById('filtro-mod').value;
    const ubicacion = document.getElementById('filtro-ubi').value;
    const estado = document.getElementById('filtro-est').value;
 
    // Construimos la URL de filtros incluyendo siempre el token
    let queryParams = ["token=" + estadoApp.token];
    if (categoria !== "Todos") queryParams.push("categoria=" + categoria);
    if (modelo !== "Todos" && modelo !== "") queryParams.push("modelo=" + modelo);
    if (ubicacion !== "Todos") queryParams.push("ubicacion=" + ubicacion);
    if (estado !== "Todos") queryParams.push("estado=" + estado);
 
    let url = '/api/recursos?' + queryParams.join('&');
 
    rest.get(url, function(status, recursos) {
        if (status === 200) {
            const tbody = document.getElementById('tabla-recursos');
            tbody.innerHTML = '';
 
            recursos.forEach(r => {
                const modeloObj = estadoApp.maestros.mod.find(m => m.id == r.modelo);
                const modNombre = modeloObj ? modeloObj.nombre : '-';
                const catNombre = modeloObj ? (estadoApp.maestros.cat.find(c => c.id == modeloObj.categoria)?.nombre || '-') : '-';
                const ubiNombre = estadoApp.maestros.ubi.find(u => u.id == r.ubicacion)?.nombre || '-';
                
                let estTexto = "";
                if (r.estado === 0) estTexto = "Operativo";
                else if (r.estado === 1) estTexto = "Baja";
                else if (r.estado === 2) estTexto = "Mantenimiento";
 
                tbody.innerHTML += `
                    <tr>
                        <td>${r.numero_serie}</td>
                        <td>${catNombre}</td>
                        <td>${modNombre}</td>
                        <td>${ubiNombre}</td>
                        <td>${estTexto}</td>
                        <td>
                            <button onclick="verDetalle(${r.id})">Abrir</button>
                            <button onclick="borrar(${r.id})">X</button>
                        </td>
                    </tr>
                `;
            });
        }
    });
}
 
function borrar(id) {
    if (confirm("¿Estás seguro de eliminar este recurso?")) {
        rest.delete('/api/recursos/' + id + '?token=' + estadoApp.token, function(status) {
            if (status === 200) {
                cargarTablaRecursos();
            }
        });
    }
}
 
function nuevoRecurso() {
    document.getElementById('form-id').value = ""; 
    document.getElementById('form-serie').value = "";
    
    llenarSelect('form-cat', estadoApp.maestros.cat);
    llenarSelect('form-ubi', estadoApp.maestros.ubi);
    actualizarModelos('formulario');
    document.getElementById('form-est').value = 0;
 
    document.getElementById('panel-historial').style.display = 'none';
    navegar('detalle-view');
}
 
function verDetalle(id) {
    rest.get('/api/recursos/' + id + '?token=' + estadoApp.token, function(status, r) {
        if (status === 200 && r) {
            llenarSelect('form-cat', estadoApp.maestros.cat);
            llenarSelect('form-mod', estadoApp.maestros.mod);
            llenarSelect('form-ubi', estadoApp.maestros.ubi);
 
            document.getElementById('form-id').value = r.id;
            document.getElementById('form-serie').value = r.numero_serie;
            
            const modeloObj = estadoApp.maestros.mod.find(m => m.id == r.modelo);
            if(modeloObj) {
                document.getElementById('form-cat').value = modeloObj.categoria;
                actualizarModelos('formulario');
            }
            
            document.getElementById('form-mod').value = r.modelo;
            document.getElementById('form-ubi').value = r.ubicacion;
            document.getElementById('form-est').value = r.estado;
 
            document.getElementById('panel-historial').style.display = 'block';
            
            pintarReservas(id, function() {
                pintarResenyas(id, function() {
                    navegar('detalle-view');
                });
            });
        }
    });
}
 
function guardar() {
    const id = document.getElementById('form-id').value;
    const datos = {
        modelo: parseInt(document.getElementById('form-mod').value),
        ubicacion: parseInt(document.getElementById('form-ubi').value),
        numero_serie: document.getElementById('form-serie').value,
        estado: parseInt(document.getElementById('form-est').value)
    };
    
    if (id) {
        // EDITAR recurso existente (Con token)
        rest.put('/api/recursos/' + id + '?token=' + estadoApp.token, datos, function(status) {
            if (status === 200) {
                alert("Guardado correctamente");
                cargarTablaRecursos();
                navegar('home-view');
            } else alert("Error al guardar");
        });
    } else {
        // CREAR nuevo recurso (Con token)
        rest.post('/api/recursos?token=' + estadoApp.token, datos, function(status, nuevoRecursoId) {
            if (status === 201) {
                var modeloObj = estadoApp.maestros.mod.find(m => m.id == datos.modelo);
                var catObj = estadoApp.maestros.cat.find(c => c.id == modeloObj.categoria);
                
                if (wsConexion !== null && wsConexion.readyState === WebSocket.OPEN) {
                    wsConexion.send(JSON.stringify({
                        operacion: "crearRecurso",
                        idRecurso: nuevoRecursoId,
                        nombreCategoria: catObj.nombre,
                        nombreModelo: modeloObj.nombre,
                        codigoRecurso: datos.numero_serie
                    }));
                }
                alert("Guardado correctamente");
                cargarTablaRecursos();
                navegar('home-view');
            } else alert("Error al guardar");
        });
    }
}
 
function pintarReservas(idRecurso, callback) {
    rest.get(`/api/recursos/${idRecurso}/reservas?token=${estadoApp.token}`, function(status, reservas) {
        if (status === 200) {
            const tbody = document.getElementById('tabla-reservas');
            tbody.innerHTML = '';
 
            reservas.forEach(res => {
                let claseColor = 'fila-blanca';
                const fInicio = res.fecha_inicio ? new Date(res.fecha_inicio) : null;
                const fFin = res.fecha_fin ? new Date(res.fecha_fin) : null;
                const ahora = new Date(); 
 
                if (!fInicio) {
                    claseColor = 'fila-verde'; 
                } else if (!fFin) {
                    const horaLimite = new Date(fInicio.getTime() + (res.horas_estimadas * 60 * 60 * 1000));
                    if (ahora > horaLimite) claseColor = 'fila-roja'; 
                    else claseColor = 'fila-azul';
                } 
 
                tbody.innerHTML += `
                    <tr class="${claseColor}">
                        <td>${res.nombreSanitario} </td>
                        <td>${res.horas_estimadas}h</td>
                        <td>${new Date(res.fecha_peticion).toLocaleString()}</td>
                        <td>${fInicio ? fInicio.toLocaleString() : 'Pendiente'}</td>
                        <td>${fFin ? fFin.toLocaleString() : 'En curso'}</td>
                    </tr>
                `;
            });
        }
        if(callback) callback();
    });
}
 
function pintarResenyas(idRecurso, callback) {
    rest.get(`/api/recursos/${idRecurso}/resenyas?token=${estadoApp.token}`, function(status, resenyas) {
        if (status === 200) {
            const tbody = document.getElementById('tabla-resenyas');
            tbody.innerHTML = '';
 
            resenyas.forEach(r => {
                tbody.innerHTML += `
                    <tr>
                        <td>${new Date(r.fecha).toLocaleDateString()}</td>
                        <td>${r.nombreSanitario}</td>
                        <td>${r.valor}</td>
                        <td>${r.descripcion}</td>
                    </tr>
                `;
            });
        }
        if(callback) callback();
    });
}
 
// --- FUNCIONES DEL GESTOR (REGISTRO Y EDICIÓN) ---
 
function mostrarRegistro() {
    document.getElementById('gestor-id').value = "";
    document.getElementById('gestor-n').value = "";
    document.getElementById('gestor-a').value = "";
    document.getElementById('gestor-u').value = "";
    document.getElementById('gestor-p').value = "";
    navegar('gestor-view');
}
 
function mostrarEdicion() {
    rest.get('/api/gestores/' + estadoApp.usuarioId + '?token=' + estadoApp.token, function(status, gestor) {
        if (status === 200 && gestor) {
            document.getElementById('gestor-id').value = gestor.id;
            document.getElementById('gestor-n').value = gestor.nombre;
            document.getElementById('gestor-a').value = gestor.apellidos;
            document.getElementById('gestor-u').value = gestor.usuario;
            document.getElementById('gestor-p').value = ""; 
            navegar('gestor-view');
        }
    });
}
 
function guardarGestor() {
    const id = document.getElementById('gestor-id').value;
    const datos = {
        nombre: document.getElementById('gestor-n').value,
        apellidos: document.getElementById('gestor-a').value,
        usuario: document.getElementById('gestor-u').value,
        password: document.getElementById('gestor-p').value
    };
 
    if (id) {
        // Editar perfil de gestor existente (Privado: lleva token)
        rest.put('/api/gestores/' + id + '?token=' + estadoApp.token, datos, function(status) {
            if(status === 200) {
                alert("Datos guardados correctamente");
                document.getElementById('welcome-user').innerText = `Bienvenido ${datos.nombre} ${datos.apellidos}`;
                navegar('home-view');
            } else alert("Error: Revisa los datos (Quizás el usuario ya existe)");
        });
    } else {
        // Registrar un nuevo gestor (Público: no necesita token)
        rest.post('/api/gestores', datos, function(status) {
            if(status === 201) {
                alert("Gestor registrado correctamente");
                navegar('login-view');
            } else alert("Error: Revisa los datos (Quizás el usuario ya existe)");
        });
    }
}
 
function cancelarGestor() {
    const id = document.getElementById('gestor-id').value;
    if (id) navegar('home-view'); 
    else navegar('login-view');
}

// =========================================================================
// --- PRÁCTICA 3 - PARTE 1: INTEGRACIÓN CON EL MINISTERIO DE SANIDAD ---
// =========================================================================

const AREAS_MEDICAS = {
    1: "Alergología",
    2: "Anestesiología",
    3: "Cardiología",
    4: "Cirugía General",
    5: "Dermatología",
    6: "Aparato Digestivo",
    7: "Endocrinología",
    8: "Ginecología",
    9: "Hematología",
    10: "Medicina Interna",
    11: "Neumología",
    12: "Neurología",
    13: "Oftalmología",
    14: "Oncología",
    15: "Pediatría",
    16: "Psiquiatría",
    17: "Traumatología",
    18: "Urología"
};

// Obtener y pintar la clasificacion
function cargarRankingMinisterio() {
    // Hacemos una petición al servidor externo del ministerio
    rest.get('https://undefined.ua.es/telemedicina/api/datos', function(status, resultado) {
        // Comprobamos que la peticion haya ido bien (200) y que el resultado sea un array
        if (status === 200 && Array.isArray(resultado)) {
            let conteoPorArea = {};
            // Inicializamos las áreas a 0
            for (let id in AREAS_MEDICAS) {
                conteoPorArea[id] = 0;
            }

            // Recorremos cada objeto que se ha subido al ministerio
            resultado.forEach(objeto => {
                const area = objeto.id_area;
                // Comprobamos que el objeto tenga un id_area, que ese número de área esté entre 1-18 y que datos sea un array
                if (area && conteoPorArea[area] !== undefined && Array.isArray(objeto.datos)) {
                    // Sumamos el número de reservas de ese envío
                    conteoPorArea[area] += objeto.datos.length;
                }
            });

            // Como un objeto no se puede ordenar con .sort, metemos los resultados de las áreas en un array
            let listaRanking = [];
            for (let id in conteoPorArea) {
                listaRanking.push({
                    id_area: id,
                    nombreArea: AREAS_MEDICAS[id],
                    totalReservas: conteoPorArea[id]
                });
            }

            // Ordenamos el array de mayor a menor según el número de reservas
            // Al restar b-a, si el número es positivo significa que b tiene más 
            // reservas que a, por lo que b se coloca antes en la lista 
            listaRanking.sort((a, b) => b.totalReservas - a.totalReservas);

            // Buscamos el cuerpo de la tabla en el html y lo vaciamos
            const tbody = document.getElementById('tbody-ranking');
            tbody.innerHTML = '';

            // Rellenamos la tabla (una fila <tr> por cada área) --> ojo que index empieza en 0 y por ello sumamos 1 para que sea del 1-18
            listaRanking.forEach((item, index) => {
                tbody.innerHTML += `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${item.nombreArea}</td>
                        <td>${item.totalReservas}</td>
                    </tr>
                `;
            });
        } else {
            console.error("Error al obtener los datos del Ministerio:", status);
        }
    });
}

function formatearFechaMinisterio(fechaOriginal) {
    // Si la fecha viene vacia se devuelve null
    if (!fechaOriginal){
        return null;
    } 
    // Se intenta obtener la fecha en milisegundos --> si es un texto inválido, devolverá NaN
    const f = new Date(fechaOriginal);
    
    if (isNaN(f.getTime())){
        return null;
    } 
    
    const anio = f.getFullYear();
    // Como los meses van del 0-11, le sumamos 1 y si es un solo número, le pone un 0 delante (3 --> 03)
    const mes = String(f.getMonth() + 1).padStart(2, '0');
    const dia = String(f.getDate()).padStart(2, '0');
    // Unimos la fecha con guiones
    return `${anio}-${mes}-${dia}`;
}

function enviarDatosMinisterio() {
    // Obtenemos TODOS los recursos del hospital pasando el token
    rest.get('/api/recursos?token=' + estadoApp.token, function(statusRec, recursos) {
        if (statusRec !== 200 || !Array.isArray(recursos)) {
            alert("Error al obtener los recursos del hospital");
            return;
        }

        if (recursos.length === 0) {
            alert("No hay recursos registrados.");
            return;
        }

        // Creamos un array para guardar cada reserva 
        let arrayDatosReservas = [];
        // Creamos una variable para controlar cuantos recursos hay en total
        // Cada vez que revisemos un recurso, restaremos uno a este contador 
        let recursosPendientes = recursos.length;

        // Recorremos cada recurso para pedir sus reservas pasando el token
        recursos.forEach(recurso => {
            const modeloObj = estadoApp.maestros.mod.find(m => m.id == recurso.modelo);
            const catObj = modeloObj ? estadoApp.maestros.cat.find(c => c.id == modeloObj.categoria) : null;
            const nombreCategoria = catObj ? catObj.nombre : "Sin categoría";

            // Pedimos todas las reservas que tenga el recurso
            rest.get(`/api/recursos/${recurso.id}/reservas?token=${estadoApp.token}`, function(statusRes, reservas) {
                if (statusRes === 200 && Array.isArray(reservas) && reservas.length > 0) {
                    let reservasPendientes = reservas.length;

                    // Por cada reserva, necesitamos el nombre y apellidos del sanitario
                    reservas.forEach(res => {
                        rest.get(`/api/sanitarios/${res.sanitario}?token=${estadoApp.token}`, function(statusSan, sanitarioObj) {
                            let nombreSan = "";
                            let apellidosSan = "";

                            if (statusSan === 200 && sanitarioObj) {
                                nombreSan = sanitarioObj.nombre;
                                apellidosSan = sanitarioObj.apellidos;
                            } 
                            // Por si el servidor falla 
                            else if (res.nombreSanitario) {
                                let partes = res.nombreSanitario.split(" ");
                                nombreSan = partes[0] || "";
                                apellidosSan = partes.slice(1).join(" ") || "";
                            }

                            arrayDatosReservas.push({
                                nombre: nombreSan,
                                apellidos: apellidosSan,
                                categoria: nombreCategoria,
                                horas_estimadas: res.horas_estimadas,
                                fec_pet: formatearFechaMinisterio(res.fecha_peticion),
                                fec_ini: formatearFechaMinisterio(res.fecha_inicio),
                                fecha_fin: formatearFechaMinisterio(res.fecha_fin)
                            });

                            reservasPendientes--;
                            // Si ya hemos revisado todas las reservas de este recurso
                            if (reservasPendientes === 0) {
                                recursosPendientes--;
                                comprobarYEnviar();
                            }
                        });
                    });
                } else {
                    // Si el recurso no tiene reservas, simplemente lo marcamos como revisado y llamamos a comprobarYEnviar
                    recursosPendientes--;
                    comprobarYEnviar();
                }
            });
        });

        // Enviamos el POST al servidor del Ministerio (este es externo, no lleva nuestro token)
        // Esta función se ejecuta cada vez que termina un recurso pero solo entra en el if
        // cuando el último recurso ha terminado de recopilar todas sus reservas
        function comprobarYEnviar() {
            if (recursosPendientes === 0) {
                // Construimos el objeto para enviarlo
                const objetoEnvio = {
                    id_area: 9, // Área 9 asignada: Hematología
                    fecha: formatearFechaMinisterio(new Date()),
                    datos: arrayDatosReservas
                };

                console.log("Enviando objeto al Ministerio:", objetoEnvio);

                // Enviamos el objeto a la url del ministerio
                rest.post('https://undefined.ua.es/telemedicina/api/datos', objetoEnvio, function(statusPost, respuestaPost) {
                    // Si nos responde con codigo de exito (200/201)
                    if (statusPost >= 200 && statusPost < 300) {
                        // Mostramos el alert de  comprobación y refrescamos la tabla
                        alert(`¡Se han enviado ${arrayDatosReservas.length} reservas de Hematología (Área 9) correctamente!`);
                        cargarRankingMinisterio();
                    } else {
                        alert("Error al enviar los datos al Ministerio. Código: " + statusPost);
                        console.error("Detalle del error:", respuestaPost);
                    }
                });
            }
        }
    });
}
 
