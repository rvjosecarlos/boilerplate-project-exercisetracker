const express = require('express')
const app = express()
const cors = require('cors')
const mongoose = require('mongoose');
//const { MONGODB } = require('dotenv').config().parsed;
const MONGODB = process.env['MONGODB'];
const bodyParser = require('body-parser');

// CONEXION A LA BD Mongo
(
  async function() {

    try {
      await mongoose.connect(MONGODB, { useNewUrlParser: true, useUnifiedTopology: true });
    }
    catch (error) {
      console.error(error);
    };
  })();

// DEFINE un esquema para los documentos
const usuariosEsquema = new mongoose.Schema({

  username: {
    type: String,
    require: true
  },
  count: {
    type: Number,
    require: true
  },
  log: [
    {
      description: {
        type: String,
        require: true
      },
      duration: {
        type: Number,
        require: true
      },
      date: {
        type: Date,
        require: true
      }
    }
  ]

});

// MODELO que representa la coleccion de documentos en mongo de acuerdo al esquema
const Usuarios = mongoose.model('Usuarios', usuariosEsquema);

app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// Habilitar post desde el formulario
app.use(bodyParser.urlencoded({ extended: true }));

// Define un router para las peticiones post y get al mismo path para NUEVOS USUARIOS
app
  .route('/api/users')
  .get(obtenerUsuarios)
  .post(agregarUsuario);


// Middlerware del manjeador GET '/api/users' consulta de todos los usuarios
async function obtenerUsuarios(req, res) {

  try {

    const usuarios = await Usuarios.find().select({
      _id: 1,
      username: 1,
      __v: 1
    });
    res.json(usuarios);

  }
  catch (error) {
    console.error(error);
  }

}


// Middleware del manejador POST '/api/users' para ingresar un nuevo usuario
async function agregarUsuario(req, res) {
  const { username } = req.body;

  if (!username) {
    res.json({ error: 'username is required' });
    return;
  };

  const nuevoUsuario = {
    username,
    count: 0,
    log: []
  };

  try {
    const usuarioCreado = await Usuarios.create(nuevoUsuario);

    //console.log( usuarioCreado );
    res.json({ username: usuarioCreado.username, _id: usuarioCreado._id });
  }
  catch (error) {
    console.error(error);
  }

}

// Define el manejador de peticiones post para ingresar EJERCICIOS

app.post('/api/users/:_id/exercises', agregarTarea);

// Define el middleware para agregar nuevas tareas EJERCICIOS
async function agregarTarea(req, res) {
  const { _id } = req.params;
  const { description, duration, date } = req.body;
  const errorObj = { error: 'Invalid _id' };
  let existeUsuario;

  // Obten la fecha separada para crear la fecha con el dia correcto
  let fecha;
  if (date) {
    fecha = (date);
  }
  else {
    fecha = new Date();
  };
  console.log('FECHAS',date, fecha);


  try {
    existeUsuario = await Usuarios.findOne({ _id });
    //console.log('EXISTE', existeUsuario);

    const nuevaTarea = {
      description: description,
      duration: parseInt(duration),
      date: new Date(fecha).toDateString()
    };

    //console.log( 'OBJ NUEVA TAREA',nuevaTarea );
    existeUsuario.count++;
    existeUsuario.log.push(nuevaTarea);

    const usuarioActualizado = await existeUsuario.save();

    //console.log(' ULTIMO REGISTRO' ,usuarioActualizado.log[ usuarioActualizado.log.length - 1 ]);

    console.log('TAREA NUEVA');
    const { username } = usuarioActualizado;

    res.json({
      _id,
      username,
      date: new Date(fecha).toDateString(),
      duration: nuevaTarea.duration,
      description: nuevaTarea.description
    });

  }
  catch (error) {
    res.json(errorObj);
    return;
  };

  if (!existeUsuario) {
    res.json(errorObj);
    return;
  };

}

// Define el manejador para peticiones
app.get('/api/users/:id/logs', obtenerTareas);

// Middleware del manejador get para OBTENER TAREAS
async function obtenerTareas(req, res) {

  const { id } = req.params;

  const { from, to, limit } = req.query;

  try {

    const usuario = await Usuarios.findById(id);
    const { _id, username, count, log } = usuario;

    if (from && to && limit) {


      const desdeSF = formatearFecha(from);
      const hastaSF = formatearFecha(to);

      const desde = new Date(desdeSF);
      const hasta = new Date(hastaSF);
      const limite = parseInt(limit);

      
      const filtroTareas = log.filter((tarea, indice) => tarea.date >= desde && tarea.date <= hasta && indice <= limite)  
                              .map(tarea => {
                                const { description, duration, date } = tarea;
                                return {
                                  description,
                                  duration,
                                  date: date.toDateString()
                                }
                              });

      //console.log( filtroTareas );

      res.json({
        _id,
        username,
        from: desde.toDateString(),
        to: hasta.toDateString(),
        count: filtroTareas.length,
        log: filtroTareas
      });
      return;
    }
    else if (limit !== '0' && limit) {
      //console.log('Entra', limit)
      const limite = parseInt(limit);
      const limiteArr = log.filter((tarea, indice) => indice < limite)
        .map(tarea => {
          const { description, duration, date } = tarea;
          return {
            description,
            duration,
            date: date.toDateString()
          }
        });

      res.json({
        _id,
        username,
        count: limiteArr.length,
        log: limiteArr
      });
      return;
    }

    //console.log(usuario);

    const filtroTareas = log.map(tarea => {
      const { description, duration, date } = tarea;
      return {
        description,
        duration,
        date: date.toDateString()
      }
    });
    //console.log('COMPLETAS',filtroTareas);

    res.json({
      _id,
      username,
      count,
      log: filtroTareas
    });

  }
  catch (error) {
    res.json({ error: 'Invalid id' });
  }

}

function formatearFecha(date) {
  const datosFecha = date.match(/[0-9]{2,4}/g);
  const year = datosFecha[0];
  const mes = datosFecha[1];
  const dia = datosFecha[2] > 8 ? parseInt(datosFecha[2]) + 1 : '0' + (parseInt(datosFecha[2]) + 1);
  return `${year}-${mes}-${dia}`;
}


const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
});
