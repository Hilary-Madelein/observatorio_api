var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
// var indexRouter = require('./routes/index').router; // Eliminado (Lógica movida a MqttService y index.routes)
var apiRouter = require('./routes/index.routes');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
var createError = require('http-errors');
var app = express();
const { CronJob } = require('cron');
const MeasurementController = require('./controllers/MeasurementController');
const measurementCtrl = new MeasurementController();
const MqttService = require('./services/MqttService');

// Inicializar servicio MQTT
MqttService.start();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

console.log('API Router loaded');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({ origin: '*' }));

const expression = '0 0 0 * * *';

new CronJob(
  expression,
  async () => {
    const fakeReq = {};
    const fakeRes = {
      status: (code) => ({ json: body => console.log('[Cron]', code, body) })
    };

    try {
      await measurementCtrl.migrateToDaily(fakeReq, fakeRes);
      console.log('[Cron] Migración a daily completada.');

      await measurementCtrl.cleanOldMeasurements(fakeReq, fakeRes);
      console.log('[Cron] Eliminación de measurements antiguos completa.');
    } catch (err) {
      console.error('[Cron] Error en tareas programadas:', err);
    }
  },
  null,
  true,
  'America/Guayaquil'
);


// Mount routes
// app.use('/', indexRouter); // Eliminado
app.use('/api', apiRouter);

app.get('/', (req, res) => {
  res.status(200).send('Hello, World!');
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
// error handler middleware (must be last)
const errorMiddleware = require('./middlewares/error.middleware');
app.use(errorMiddleware);

module.exports = app;
