#!/usr/bin/env python
"""
Very simple HTTP server in python.
Usage::
    ./dummy-web-server.py [<port>]
Send a GET request::
    curl http://localhost
Send a HEAD request::
    curl -I http://localhost
Send a POST request::
    curl -d "foo=bar&bin=baz" http://localhost
"""
from http.server import BaseHTTPRequestHandler, HTTPServer
from pgm import read_pgm
import os
import json
from urllib.parse import urlparse, parse_qs

port = 80
data = dict()


def getKey(name):
    angle = int(int(name.split("_")[0]) / 1000)
    return angle


def readData():
    global data
    for filename in os.listdir("data"):
        if filename.endswith(".pgm"):
            file = open(os.path.join("data/", filename), "rb", newline=None)
            try:
                key = getKey(filename)
                if key not in data:
                    data[key] = []
                print("Reading measurement #%s of angle %s" % (len(data[key]) + 1, key))
                data[key].append(read_pgm(file))
            finally:
                file.close()


class Server(BaseHTTPRequestHandler):
    def read_parameters(self):
        self.endpoint = urlparse(self.path).path
        self.params = parse_qs(urlparse(self.path).query)
        for key, value in self.params.items():
            self.params[key] = int(value[0])
        print(self.params)

    def _set_headers(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

    def do_HEAD(self):
        self._set_headers()

    def do_GET(self):
        self.read_parameters()
        response = ""
        if self.endpoint == "/metadata":
            response = self.get_metadata()
        elif self.endpoint == "/point":
            response = self.get_point()
        if response is None:
            self.send_error(400, "Wrong parameters or endpoint!")
            return
        self._set_headers()
        self.wfile.write(str.encode(response))

    def do_POST(self):
        self.read_parameters()
        response = ""
        if self.endpoint == "/metadata":
            response = self.get_metadata()
        elif self.endpoint == "/point":
            response = self.get_point()
        elif self.endpoint == "/data":
            response = self.get_data()
        # Doesn't do anything with posted data
        if response is None:
            self.send_error(400, "Wrong parameters or endpoint!")
            return
        self._set_headers()
        self.wfile.write(str.encode(response))

    # JSONs
    def get_metadata(self):
        global data
        metadata = dict()
        metadata["angles"] = []
        metadata["measurements"] = []
        for key in sorted(data.keys()):
            metadata["angles"].append(key)
            metadata["measurements"].append(len(data[key]))
        return json.dumps(metadata)

    def get_point(self):
        x = self.params["x1"]
        y = self.params["y1"]
        if x is None or y is None:
            return None
        pointValues = []
        for a in data.keys():
            measurements = data[a]
            if len(measurements) == 0:
                continue

            if x >= measurements[0]["width"] or x < 0 or y >= measurements[0]["height"] or y < 0:
                continue

            point = dict()
            point["a"] = a
            point["x1"] = x
            point["y1"] = y
            point["measurements"] = []

            for i in range(len(measurements)):
                measurement = measurements[i]
                point["measurements"].append({"n": i, "i": measurement["rows"][y][x]})
            pointValues.append(point)
        return json.dumps(pointValues)

    def get_data(self):
        a = self.params["a"]
        n = self.params["n"]
        if a is None or n is None:
            return None
        if a not in data:
            return None
        measurements = data[a]
        if n < 0 or n >= len(measurements):
            return None
        return json.dumps(measurements[n])


def run(server_class=HTTPServer, handler_class=Server, p=port):
    server_address = ('', p)
    httpd = server_class(server_address, handler_class)
    print('Starting httpd...')
    httpd.serve_forever()


if __name__ == "__main__":
    from sys import argv

    readData()
    if len(argv) == 2:
        run(p=int(argv[1]))
    else:
        run()
