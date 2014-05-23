# A gpsd logging and replication daemon.

## Typical usage

The typical usage of AGPSD is to send GPSD data over a intermittent network connection from a vehicle to a server, and have the server serve the last known data as well as history to clients. Currently the data can be retrieved using the GPSD protocol and KML.

## Features

AGPSD works like a GPSD router, with caching. It acts as both a GPSD client and server, and stores all NMEA events in an SQLite database. In addition to simply relaying data to clients, it supports replaying old data, and replication of the log between AGPSD servers.

It can initiate connections for replication both from the receiving and the sending end, enabling operation over networks with dynamic ip:s

AGPSD also acts as a web server and serves the recorded data as KML, as well as an OpenLayers based user interface to browse said kml data.

## Installation

Install NodeJS and npm. Then install all depencencies by running the
following inside the agpsd directory:

    npm install


## Usage

    ./server.js OPTIONS

Options with values can be given multiple times to provide more than
one value.

### Available options and applicable values

    --listen=PORT
      Listen for gpsd or agpsd client connections on PORT. Defaults to 4711 if not specified.
    --httplisten=PORT
      Listen for web browser clients on PORT. Defaults to 4812 if not specified.
    --db=FILENAME
      Store data in sqlite database FILENAME. Defaults to "agpsd.db" if not specified.
    --upstream=HOSTNAME:PORT
      Fetch new data from a gpsd or agpsd running at PORT on HOSTNAME
    --downstream=HOSTNAME:PORT
      Publish data to an agpsd running at PORT on HOSTNAME. This uses a
      "role reversed" gpsd protocol, where the client pretends to be the
      server, and vice versa.

    --verbose=connect
      Display new connections
    --verbose=disconnect
      Display disconnects and failed connections
    --verbose=data
      Display received commands and responses

## Example usage

    ./server.js --listen=4711 --db=somedb.db --upstream=localhost:2947 --downstream=someserver:4712

Take GPS input from the gpsd och agpsd running at localhost:2947 and
dump to the (sqlite) database mydb.db. Listen for incoming connections
(gpsd protocol) on 4711. Also try to connect to port 3712 on
someserver and send data to it using a role-reversed gpsd protocol
(client pretends to be server, server pretends to be client).
