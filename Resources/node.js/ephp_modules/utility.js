var sugar = require('sugar');

var readParam = function(parameters, parameter, default_value) {
    out = '';
    start = parameters.search(parameter);
    if (start > 0) {
        start += parameter.length;
        out = parameters.substr(start);
        end = out.search('\n');
        if (end > 0) {
            out = out.substr(0, end).trim();
        } else {
            out = out.trim();
        }
    }
    if (out.search(/^null$/i) >= 0 || out === '') {
        out = default_value;
    } else if (out.search(/^(true|yes)$/i) >= 0) {
        out = true;
    } else if (out.search(/^(false|no)$/i) >= 0) {
        out = false;
    }
    return out;
};

var serializePhp = function(mixed_value) {
    var val, key, okey,
            ktype = '', vals = '', count = 0,
            _utf8Size = function(str) {
        var size = 0,
                i = 0,
                l = str.length,
                code = '';
        for (i = 0; i < l; i++) {
            code = str.charCodeAt(i);
            if (code < 0x0080) {
                size += 1;
            }
            else if (code < 0x0800) {
                size += 2;
            }
            else {
                size += 3;
            }
        }
        return size;
    },
            _getType = function(inp) {
        var match, key, cons, types, type = typeof inp;

        if (type === 'object' && !inp) {
            return 'null';
        }
        if (type === 'object') {
            if (!inp.constructor) {
                return 'object';
            }
            cons = inp.constructor.toString();
            match = cons.match(/(\w+)\(/);
            if (match) {
                cons = match[1].toLowerCase();
            }
            types = ['boolean', 'number', 'string', 'array'];
            for (key in types) {
                if (cons == types[key]) {
                    type = types[key];
                    break;
                }
            }
        }
        return type;
    },
            type = _getType(mixed_value)
            ;

    switch (type) {
        case 'function':
            val = '';
            break;
        case 'boolean':
            val = 'b:' + (mixed_value ? '1' : '0');
            break;
        case 'number':
            val = (Math.round(mixed_value) == mixed_value ? 'i' : 'd') + ':' + mixed_value;
            break;
        case 'string':
            val = 's:' + _utf8Size(mixed_value) + ':"' + mixed_value + '"';
            break;
        case 'array':
        case 'object':
            val = 'a';
            for (key in mixed_value) {
                if (mixed_value.hasOwnProperty(key)) {
                    ktype = _getType(mixed_value[key]);
                    if (ktype === 'function') {
                        continue;
                    }

                    okey = (key.match(/^[0-9]+$/) ? parseInt(key, 10) : key);
                    vals += this.serializePhp(okey) + this.serializePhp(mixed_value[key]);
                    count++;
                }
            }
            val += ':' + count + ':{' + vals + '}';
            break;
        case 'undefined':
        default:
            val = 'N';
            break;
    }
    if (type !== 'object' && type !== 'array') {
        val += ';';
    }
    return val;
}

var unserializePhp = function(data) {
    if (data === 'n;' || data === 'N;') {
        return null;
    }
    var that = this,
            utf8Overhead = function(chr) {
        var code = chr.charCodeAt(0);
        if (code < 0x0080) {
            return 0;
        }
        if (code < 0x0800) {
            return 1;
        }
        return 2;
    },
            error = function(type, msg, filename, line) {
        throw new that.window[type](msg, filename, line);
    },
            read_until = function(data, offset, stopchr) {
        var i = 2, buf = [], chr = data.slice(offset, offset + 1);

        while (chr != stopchr) {
            if ((i + offset) > data.length) {
                error('Error', 'Invalid');
            }
            buf.push(chr);
            chr = data.slice(offset + (i - 1), offset + i);
            i += 1;
        }
        return [buf.length, buf.join('')];
    },
            read_chrs = function(data, offset, length) {
        var i, chr, buf;

        buf = [];
        for (i = 0; i < length; i++) {
            chr = data.slice(offset + (i - 1), offset + i);
            buf.push(chr);
            length -= utf8Overhead(chr);
        }
        return [buf.length, buf.join('')];
    },
            _unserialize = function(data, offset) {
        var dtype, dataoffset, keyandchrs, keys, contig,
                length, array, readdata, readData, ccount,
                stringlength, i, key, kprops, kchrs, vprops,
                vchrs, value, chrs = 0,
                typeconvert = function(x) {
            return x;
        };

        if (!offset) {
            offset = 0;
        }
        dtype = (data.slice(offset, offset + 1)).toLowerCase();

        dataoffset = offset + 2;

        switch (dtype) {
            case 'i':
                typeconvert = function(x) {
                    return parseInt(x, 10);
                };
                readData = read_until(data, dataoffset, ';');
                chrs = readData[0];
                readdata = readData[1];
                dataoffset += chrs + 1;
                break;
            case 'b':
                typeconvert = function(x) {
                    return parseInt(x, 10) !== 0;
                };
                readData = read_until(data, dataoffset, ';');
                chrs = readData[0];
                readdata = readData[1];
                dataoffset += chrs + 1;
                break;
            case 'd':
                typeconvert = function(x) {
                    return parseFloat(x);
                };
                readData = read_until(data, dataoffset, ';');
                chrs = readData[0];
                readdata = readData[1];
                dataoffset += chrs + 1;
                break;
            case 'n':
                readdata = null;
                break;
            case 's':
                ccount = read_until(data, dataoffset, ':');
                chrs = ccount[0];
                stringlength = ccount[1];
                dataoffset += chrs + 2;

                readData = read_chrs(data, dataoffset + 1, parseInt(stringlength, 10));
                chrs = readData[0];
                readdata = readData[1];
                dataoffset += chrs + 2;
                if (chrs != parseInt(stringlength, 10) && chrs != readdata.length) {
                    error('SyntaxError', 'String length mismatch');
                }
                break;
            case 'a':
                readdata = {};

                keyandchrs = read_until(data, dataoffset, ':');
                chrs = keyandchrs[0];
                keys = keyandchrs[1];
                dataoffset += chrs + 2;

                length = parseInt(keys, 10);
                contig = true;

                for (i = 0; i < length; i++) {
                    kprops = _unserialize(data, dataoffset);
                    kchrs = kprops[1];
                    key = kprops[2];
                    dataoffset += kchrs;

                    vprops = _unserialize(data, dataoffset);
                    vchrs = vprops[1];
                    value = vprops[2];
                    dataoffset += vchrs;

                    if (key !== i)
                        contig = false;

                    readdata[key] = value;
                }

                if (contig) {
                    array = new Array(length);
                    for (i = 0; i < length; i++)
                        array[i] = readdata[i];
                    readdata = array;
                }

                dataoffset += 1;
                break;
            default:
                error('SyntaxError', 'Unknown / Unhandled data type(s): ' + dtype);
                break;
        }
        return [dtype, dataoffset - offset, typeconvert(readdata)];
    }
    ;

    return _unserialize((data + ''), 0)[2];
}

var guid = function(server_number) {
    var dataHex = Date.create('now').getTime().toString(16);
    return dataHex.to(8) + '-' + server_number + dataHex.from(8) + '-xxxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : r & 0x3 | 0x8;
        return v.toString(16);
    });
};

function is_int(input) {
    return typeof(input) === 'number' && parseInt(input) === input;
}

function is_float(input) {
    return typeof(input) === 'number' && parseInt(input) !== input;
}

function is_string(input) {
    return typeof(input) === 'string';
}

function is_array(input) {
    return typeof(input) === 'object';
}

exports.readParam = readParam;
exports.serializePhp = serializePhp;
exports.unserializePhp = unserializePhp;
exports.guid = guid;
exports.is_int = is_int;
exports.is_float = is_float;
exports.is_string = is_string;
exports.is_array = is_array;