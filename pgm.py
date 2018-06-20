#!/usr/bin/env python3

import struct
import os

def write_to_csv(file, raster):
    file.write("intensity\n")
    for x in range(raster["width"]):
        for y in range(raster["height"]):
            file.write("{0}\n".format(raster["rows"][y][x]))

def read_element(f):
    string = ""
    x = f.read(1).decode("ascii")
    while x != " " and x != "\n":
        string += x
        x = f.read(1).decode("ascii")
    return string

def read_pgm_header(pgmf):
    x = read_element(pgmf)
    assert x == "P5"

    width = int(read_element(pgmf))
    height = int(read_element(pgmf))
    depth = int(read_element(pgmf))
    return width, height, depth

def read_pgm_raster(pgmf, raster):
    raster["rows"] = []
    for y in range(raster["height"]):
        row = []
        for x in range(raster["width"]):
            intensity = struct.unpack(">H", pgmf.read(2))[0]
            row.append(intensity)
        raster["rows"].append(row)

def read_pgm(pgmf):
    raster = dict()
    (raster["width"], raster["height"], raster["depth"]) = read_pgm_header(pgmf)
    #print("Processing image {0} with width {1}, height {2} and depth {3}".format(os.path.basename(pgmf.name), raster["width"], raster["height"], raster["depth"]))
    read_pgm_raster(pgmf, raster)
    return raster

if __name__ == "__main__":
    for filename in os.listdir("Convert"):
        if filename.endswith(".pgm"):
            file = open(os.path.join("Convert/", filename), "rb", newline=None)
            output = open("Converted/" + filename + ".csv", "w")
            try:
                raster = read_pgm(file)
                write_to_csv(output, raster)
            finally:
                file.close()
                output.close()