const express = require('express');
const hbs = require('hbs');
const path = require('path');
const axios = require('axios');
const moment = require('moment');
const where = require('node-where');
const geolib = require('geolib');
const favicon = require('serve-favicon');

const port = process.env.PORT || 3000;

const leuvenLocation = { latitude: 50.8814, longitude: 4.7157 };
const brusselsNorthLocation = { latitude: 50.86, longitude: 4.361667 };
const leuvenCode = '008833001';
const brusselsNorthCode = '008812005';

const app = express();

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.set('view engine', 'hbs');

// this has to be the FIRST middleware!
// app.use((req, res, next) => res.render('maintenance'));

app.use(express.static(path.join(__dirname, 'public')));


app.enable('trust proxy');

app.use((req, res, next) => {
  where.is(req.ip, (err, result) => {
    req.geoip = result;
    // console.log(typeof req.ip); // ...
    next();
  });
});

app.get('/', (req, res) => {
  const ipLocation = { latitude: req.geoip.get('lat'), longitude: req.geoip.get('lng') };
  const distanceToLeuven = geolib.getDistance(ipLocation, leuvenLocation);
  const distanceToBrusselsNorth = geolib.getDistance(ipLocation, brusselsNorthLocation);

  let fromCode;
  let toCode;
  let from;
  let to;

  if (distanceToLeuven < distanceToBrusselsNorth) {
    fromCode = leuvenCode;
    toCode = brusselsNorthCode;
    from = 'Leuven';
    to = 'Brussel Noord';
  } else {
    fromCode = brusselsNorthCode;
    toCode = leuvenCode;
    from = 'Brussel Noord';
    to = 'Leuven';
  }

  axios.get(`https://api.irail.be/connections/?from=${fromCode}&to=${toCode}&format=json`)
    .then((response) => {
      const pageTitle = `${from} - ${to}`;
      const message = `${from} \u2192 ${to}  `;
      const latestUpdate = moment.unix(response.data.timestamp).format('HH:mm:ss');

      const connections = response.data.connection.map((connection) => {
        const unixTime = parseInt(connection.departure.time, 10);
        const time = moment.unix(unixTime).format('HH:mm');
        const delayMin = connection.departure.delay / 60;
        const unixRealTime = unixTime + (delayMin * 60);
        const realTime = moment.unix(unixRealTime).format('HH:mm');
        const minLeft = moment.unix(unixRealTime).diff(moment.unix(response.data.timestamp), 'minutes');
        const { platform } = connection.departure;
        const direction = connection.departure.direction.name;
        const durationMin = connection.duration / 60;
        const canceled = connection.departure.canceled === '0' ? '' : 'canceled';
        return {
          time, delayMin, realTime, minLeft, platform, direction, durationMin, canceled,
        };
      });

      connections.sort((a, b) => a.unixRealTime - b.unixRealTime);

      res.render('index', {
        pageTitle, message, latestUpdate, connections,
      });
    })
    .catch(e => console.log(e));
});

app.listen(port, () => console.log(`Server is up on port ${port}`));
