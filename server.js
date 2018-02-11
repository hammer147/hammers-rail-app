const express = require('express');
const hbs = require('hbs');
const path = require('path');
const axios = require('axios');
const moment = require('moment');
const where = require('node-where');
const geolib = require('geolib');

const port = process.env.PORT || 3000;

const leuvenLocation = { latitude: 50.8814, longitude: 4.7157};
const brusselsNorthLocation = { latitude: 50.86, longitude: 4.361667};
const leuvenCode = '008833001';
const brusselsNorthCode = '008812005';

const app = express();

app.set('view engine', 'hbs');

// this has to be the FIRST middleware!
// app.use((req, res, next) => res.render('maintenance'));

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  where.is(req.ip, (err, result) => {
    req.geoip = result;
    console.log(result);
    next();
  });
});

app.get('/', (req, res) => {

  const ipLocation = { latitude: req.geoip.get('lat'), longitude: req.geoip.get('lng') };
  const distanceToLeuven = geolib.getDistance(ipLocation, leuvenLocation);
  const distanceToBrusselsNorth = geolib.getDistance(ipLocation, brusselsNorthLocation);

  // console.log('leuven:', distanceToLeuven, 'brussels:', distanceToBrusselsNorth);
  // console.log(ipLocation);

  const from = '008833001'; // Leuven
  const to = '008812005'; // Brussel-Noord

  axios.get(`https://api.irail.be/connections/?from=${from}&to=${to}&format=json`)
    .then((response) => {
      const pageTitle = 'Leuven - Brussel';
      const message = 'Leuven \u2192 Brussel-Noord    ';
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
        return { time, delayMin, realTime, minLeft, platform, direction, durationMin };
      });

      connections.sort((a, b) => a.unixRealTime - b.unixRealTime);

      res.render('index', { pageTitle, message, latestUpdate, connections, distanceToLeuven, distanceToBrusselsNorth });
    })
    .catch(e => console.log(e));
});

app.listen(port, () => console.log(`Server is up on port ${port}`));
