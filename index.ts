import fs from "fs";
import iconv from 'iconv-lite';

const Encoding: {
    [key: string]: any
} = {
    [0x00]: 'latin1',
    [0x01]: 'ucs2'
}

export class ID3Header {
    identifier: string;
    version: string;
    flags: { 'Unsynchronisation': number; 'ExtendedHeader': number; 'ExperimentalIndicator': number; };
    size: number;
    extendedHeader: { size: number; crc: number; flags: number[]; padding: number[]; } = {
        size: 0,
        crc: 0,
        flags: [
            0x00,
            0x00
        ],
        padding: [
            0x00,
            0x00,
            0x00,
            0x00
        ]
    };
    constructor(stream: Buffer) {
        const buf = stream
        this.identifier = buf.toString('ucs2', 0, 3)
        this.version = buf.toString('hex', 3, 4).replace(/0/g, '')
        this.flags = 
            {
                'Unsynchronisation': buf[5] >> 7 & 0x1,
                'ExtendedHeader': buf[5] >> 6 & 0x1,
                'ExperimentalIndicator': buf[5] >> 5 & 0x1,
            }
        this.size = (
            (buf[6] & 0x7f) * 0x200000 +
            (buf[7] & 0x7f) * 0x4000 +
            (buf[8] & 0x7f) * 0x80 +
            (buf[9] & 0x7f)
        )
        if (this.flags.ExtendedHeader) {
            this.extendedHeader = {
                size: (
                    (buf[10] & 0x7f) * 0x200000 +
                    (buf[11] & 0x7f) * 0x4000 +
                    (buf[12] & 0x7f) * 0x80 +
                    (buf[13] & 0x7f)
                ),
                crc: buf[14] >> 7 & 0x1,
                flags: [
                    buf[14],
                    buf[15]
                ],
                padding: [
                    buf[16],
                    buf[17],
                    buf[18],
                    buf[19]
                ]
            }
        }
    }
}

export class TagFrame {
    id: string;
    size: number;
    flags: { 'TagAlterPreservation': number; 'FileAlterPreservation': number; 'ReadOnly': number; 'Compression': number; 'Encryption': number; 'GroupingIdentity': number; };
    frame: {
        [key: string]: any
    }
    constructor(buf: Buffer) {
        this.id = buf.toString('ucs2', 0, 4)
        this.size = (
            (buf[4] & 0x7f) * 0x200000 +
            (buf[5] & 0x7f) * 0x4000 +
            (buf[6] & 0x7f) * 0x80 +
            (buf[7] & 0x7f)
        )
        this.flags = {
            'TagAlterPreservation': buf[8] >> 7 & 0x1,
            'FileAlterPreservation': buf[8] >> 6 & 0x1,
            'ReadOnly': buf[8] >> 5 & 0x1,
            'Compression': buf[9] >> 7 & 0x1,
            'Encryption': buf[9] >> 6 & 0x1,
            'GroupingIdentity': buf[9] >> 5 & 0x1,
        }
        this.frame = this.getFrame(buf, this.id, this.size)
    }

    getFrame(buf: Buffer, id: string, size: number) {
        switch (id) {
            case 'UFID':
                var tmp = [];
                var p = 10;
                for (; p < size; p ++) {
                    if (buf[p] !== 0x00) {
                        tmp.push(buf[p])
                    }
                    else {
                        p++
                        break;
                    }
                }
                return {
                    ownerIdentifier: iconv.decode(Buffer.from(tmp), 'ucs2'),
                    identifier: buf.slice(p, 10 + size)
                }
            case 'TXXX':
                var tmp = [];
                var p = 11;
                for (; p < size; p ++) {
                    if (buf[p] !== 0x00) {
                        tmp.push(buf[p])
                    }
                    else {
                        p++
                        break;
                    }
                }
                return {
                    encoding: buf[10],
                    description: iconv.decode(Buffer.from(tmp), Encoding[buf[10]]),
                    value: iconv.decode(buf.slice(p, 10 + size), 'ucs2')
                }
            case 'WXXX':
                var tmp = [];
                var p = 11;
                for (; p < size; p ++) {
                    if (buf[p] !== 0x00) {
                        tmp.push(buf[p])
                    }
                    else {
                        p++
                        break;
                    }
                }
                var desc = iconv.decode(Buffer.from(tmp), Encoding[buf[10]])
                return {
                    encoding: buf[10],
                    description: desc,
                    url: iconv.decode(buf.slice(p, 10 + size), 'ucs2')
                }
            case 'IPLS':
                return {
                    encoding: buf[10],
                    list: iconv.decode(buf.slice(11, 10 + size), Encoding[buf[10]])
                }
            case 'MCDI':
                return {
                    bin: buf.slice(10, 10 + size)
                }
            case 'ETCO':
                return {
                    timestampFormat: buf[10]
                }
            case 'SYTC':
                return {
                    timestampFormat: buf[10],
                    tempoData: buf.slice(11, 10 + size)
                }
            case 'MLLT':
                return {
                    mpegFramesBetweenReference: buf.slice(10, 14),
                    bytesBetweenReference: buf.slice(14, 17),
                    millisecendsBetweenReference: buf.slice(17, 18),
                    bitsForBytesDeviation: buf.slice(18, 19),
                    bitsForMillisecendsDev: buf.slice(19, 20)
                }
            case 'USLT':
                var tmp = [];
                var p = 14;
                for (; p < size; p ++) {
                    if (buf[p] !== 0x00) {
                        tmp.push(buf[p])
                    }
                    else {
                        p++
                        break;
                    }
                }
                return {
                    encoding: buf[10],
                    language: iconv.decode(buf.slice(11, 14), 'ucs2'),
                    content: iconv.decode(Buffer.from(tmp), Encoding[buf[10]]),
                    lyrics: iconv.decode(buf.slice(p, 10 + size), Encoding[buf[10]])
                }
            case 'SYLT':
                return {
                    encoding: buf[10],
                    language: buf.toString('ucs2', 11, 14),
                    timestampFormat: buf[14],
                    contentType: buf[15],
                    lyrics: iconv.decode(buf.slice(16, 10 + size), Encoding[buf[10]])
                }
            case 'COMM':
                var tmp = [];
                var p = 14;
                for (; p < size; p ++) {
                    if (buf[p] !== 0x00) {
                        tmp.push(buf[p])
                    }
                    else {
                        p++
                        break;
                    }
                }
                return {
                    encoding: buf[10],
                    language: buf.toString('ucs2', 11, 14),
                    shortDesc: iconv.decode(Buffer.from(tmp), Encoding[buf[10]]),
                    text: iconv.decode(buf.slice(p, 10 + size), Encoding[buf[10]])
                }
            case 'RVAD':
                // todo
                return {}
            case 'EQUA':
                return {
                    adjustment: buf[10]
                }
            case 'RVRB':
                return {
                    left: [buf[10], buf[11]],
                    right: [buf[12], buf[13]],
                    bouncesLeft: buf[14],
                    bouncesRight: buf[15],
                    feedbackLeft2Left: buf[16],
                    feedbackLeft2Right: buf[17],
                    feedbackRight2Right: buf[18],
                    feedbackRight2Light: buf[19],
                    premixLeft2Right: buf[20],
                    premixRight2Light: buf[21]
                }
            case 'APIC': {
                var tmp = [];
                var p = 14;
                for (; p < size; p ++) {
                    if (buf[p] !== 0x00) {
                        tmp.push(buf[p])
                    }
                    else {
                        p++
                        break;
                    }
                }
                var mime = Buffer.from(tmp).toString('ucs2')
                var type = buf[p];
                tmp = []
                p = p + 1
                for (; p < size; p ++) {
                    if (buf[p] !== 0x00) {
                        tmp.push(buf[p])
                    }
                    else {
                        p++
                        break;
                    }
                }
                var desc = iconv.decode(Buffer.from(tmp), Encoding[buf[10]])
                // todo
                var bin = null
                return {
                    encoding: buf[10],
                    mime,
                    type,
                    desc,
                    // todo
                    bin
                }
            }
            case 'GEOB': {
                var tmp = [];
                var p = 11;
                for (; p < size; p ++) {
                    if (buf[p] !== 0x00) {
                        tmp.push(buf[p])
                    }
                    else {
                        p++
                        break;
                    }
                }
                var mime = Buffer.from(tmp).toString('ucs2')
                tmp = []
                for (; p < size; p ++) {
                    if (buf[p] !== 0x00) {
                        tmp.push(buf[p])
                    }
                    else {
                        p++
                        break;
                    }
                }
                var filename = iconv.decode(Buffer.from(tmp), Encoding[buf[10]])
                tmp = []
                for (; p < size; p ++) {
                    if (buf[p] !== 0x00) {
                        tmp.push(buf[p])
                    }
                    else {
                        p++
                        break;
                    }
                }
                var desc = iconv.decode(Buffer.from(tmp), Encoding[buf[10]])
                return {
                    encoding: buf[10],
                    mime,
                    filename,
                    desc,
                    // todo
                    obj: null
                }
            }
            case 'PCNT': {
                return {
                    counter: 0
                }
            }
            case 'POPM': {
                var tmp = [];
                var p = 11;
                for (; p < size; p ++) {
                    if (buf[p] !== 0x00) {
                        tmp.push(buf[p])
                    }
                    else {
                        p++
                        break;
                    }
                }
                var email = Buffer.from(tmp).toString('ucs2')
                return {
                    email,
                    rating: buf[p],
                    // todo
                    counter: 0,
                }
            }
            case 'RBUF': {
                return {
                    bufferSize: [buf[10], buf[11], buf[12]],
                    embeddedInfoFlag: buf[13],
                    offsetToNextTag: [buf[14],buf[15],buf[16],buf[17]]
                }
            }
            case 'AENC': {
                var tmp = [];
                var p = 10;
                for (; p < size; p ++) {
                    if (buf[p] !== 0x00) {
                        tmp.push(buf[p])
                    }
                    else {
                        p++
                        break;
                    }
                }
                var identifier = Buffer.from(tmp).toString('ucs2')
                return {
                    identifier,
                    previewStart: [buf[p], buf[p + 1]],
                    previewLength: [buf[p + 2], buf[p + 3]],
                    // todo
                    encryption: null
                }
            }
            case 'LINK': {
                var tmp = [];
                var p = 13;
                for (; p < size; p ++) {
                    if (buf[p] !== 0x00) {
                        tmp.push(buf[p])
                    }
                    else {
                        p++
                        break;
                    }
                }
                var url = Buffer.from(tmp).toString('ucs2')
                return {
                    frameIdentifier: [buf[10], buf[11], buf[12]],
                    url: url,
                    idAndAdditionalData: buf.toString('ucs2', p, 10 + size)
                }
            }
            case 'POSS': {
                return {
                    timestempFormat: buf[10],
                    position: buf.slice(11, 10 + size)
                }
            }
            case 'USER': {
                return {
                    encoding: buf[10],
                    language: [buf[11], buf[12], buf[13]],
                    text: iconv.decode(buf.slice(14, 10 + size), Encoding[buf[10]])
                }
            }
            case 'OWNE': {
                var tmp = [];
                var p = 11;
                for (; p < size; p ++) {
                    if (buf[p] !== 0x00) {
                        tmp.push(buf[p])
                    }
                    else {
                        p++
                        break;
                    }
                }
                var pricePayed = Buffer.from(tmp).toString('ucs2')
                return {
                    encoding: buf[10],
                    pricePayed: pricePayed,
                    text: iconv.decode(buf.slice(p, 10 + size), Encoding[buf[10]])
                }
            }
            case 'COMR': {
                // todo
                return {}
            }
            case 'ENCR': {
                var tmp = [];
                var p = 10;
                for (; p < size; p ++) {
                    if (buf[p] !== 0x00) {
                        tmp.push(buf[p])
                    }
                    else {
                        p++
                        break;
                    }
                }
                var identifier = Buffer.from(tmp).toString('ucs2')
                return {
                    identifier,
                    methodSymbol: buf[p],
                    // todo
                    encryption: null
                }
            }
            case 'GRID': {
                var tmp = [];
                var p = 10;
                for (; p < size; p ++) {
                    if (buf[p] !== 0x00) {
                        tmp.push(buf[p])
                    }
                    else {
                        p++
                        break;
                    }
                }
                var identifier = Buffer.from(tmp).toString('ucs2')
                return {
                    identifier,
                    groupSymbol: buf[p],
                    // todo
                    groupDependentData: null
                }
            }
            case 'PRIV': {
                var tmp = [];
                var p = 10;
                for (; p < size; p ++) {
                    if (buf[p] !== 0x00) {
                        tmp.push(buf[p])
                    }
                    else {
                        p++
                        break;
                    }
                }
                var identifier = Buffer.from(tmp).toString('ucs2')
                return {
                    identifier,
                    // todo
                    privateData: null
                }
            }
            default:
                if (id.match(/^T/)) {
                    return {
                        encoding: buf[10],
                        content: iconv.decode(buf.slice(11, 10 + size), Encoding[buf[10]]),
                    }
                }
                if (id.match(/^W/)) {
                    return {
                        url: buf.toString('ucs2', 10, 10 + size)
                    }
                }
                return {
                    unknown: 1
                }
        }
    }
}
