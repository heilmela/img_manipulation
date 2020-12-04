import * as pako from 'https://unpkg.com/pako@latest?module';
import assert from './assert.js';


const CHUNK_TYPE = {
    PLTE: {
        name: 'Palette',
        code: [80,76,84,69],
        toString: function() {return this.name}
    },
    IHDR: {
        name: 'Header',
        code: [73,72,68,82],
        toString: function() {return this.name}
    },
    IDAT: {
        name: 'Image Data',
        code: [73,68,65,84],
        toString: function() {return this.name}
    },
    IEND: {
        name: 'Image Trailer',
        code: [73,69,78,68],
        toString: function() {return this.name}
    }
}

//PALETTE has always 8 bit sample depth while in other cases the sample depth is always
//equal to the bit depth
const COLOR_TYPE = {
    GRAYSCALE: {
        name: 'Grayscale',
        code: 0,
        allowed_bit_depths: [1,2,4,8,16],
        toString: function() {return this.name}
    },
    RGB: {
        name: 'RGB',
        code: 2,
        allowed_bit_depths: [8,16],
        toString: function() {return this.name}
    },
    PALETTE: {
        name: 'Palette',
        code: 3,
        allowed_bit_depths: [1,2,4,8],
        toString: function() {return this.name}
    },
    ALPHA_GRAYSCALE: {
        name: 'Grayscale with alpha channel',
        code: 4,
        allowed_bit_depths: [8,16],
        toString: function() {return this.name}
    },
    ALPHA_RGB: {
        name: 'Grayscale with alpha channel',
        code: 6,
        allowed_bit_depths: [8,16],
        toString: function() {return this.name}
    }
}

export default {
    /** 
    *  @param {ArrayBuffer} buffer Raw png data stream 
    *  @return {Object} The decoded image data 
    *  @description Decodes the data stream into a javascript 
    *               object containing the reference image
    */ 
    decode(buffer) {
        const img = {};
        const header = new Uint8Array(buffer, 0, 8);
        //Assert the PNG Header (ASCII: \211PNG\r\n\032\n)
        assert(header[0]).equal(0x89); //\211
        assert(header[1]).equal(0x50); //P
        assert(header[2]).equal(0x4e); //N
        assert(header[3]).equal(0x47); //G
        assert(header[4]).equal(0x0d); ///r
        assert(header[5]).equal(0x0a); ///n
        assert(header[6]).equal(0x1a); ///032
        assert(header[7]).equal(0x0a); ///n
        
        //IHDR
        const IHDR = this.decodeIHDR(new Uint8Array(buffer, 8,  21));
        img.IHDR = IHDR;

        //PLTE 
        let plteIndices = this.getChunkIndex(buffer,CHUNK_TYPE.PLTE);
        if(plteIndices.length > 1) throw 'Found multiple PLTE chunks, which is not supported'
        if(plteIndices.length > 0) {
            let plteLength = this.number(new Uint8Array(buffer, plteIndices[0], 4));
            img.PLTE = decodePLTE(new Uint8Array(buffer, plteIndices[0], plteLength))
        }

        //IDAT
        let dataIndices = this.getChunkIndex(buffer, CHUNK_TYPE.IDAT);
        if(dataIndices.length == 0) throw 'No IDAT chunk found'
        else {
            img.scanlines = [];
            dataIndices.forEach((x) => {
                let length = this.number(new Uint8Array(buffer, x, 4));
                img.scanlines.push(this.decodeIDAT(new Uint8Array(buffer, x, length)));
            });
        }

        return img;
    },
    /** 
    *  @param {Uint8Array} chunk Raw chunk data 
    *  @return {Object} The decoded chunk data
    *  @description Decodes the chunk into a javascript object
    */ 
    decodeIHDR(chunk) {
        //The spec required the IHDR header to appear first
        //First comes the length of the chunk then the chunk type & chunk data
    
        /* Chunk length        4 bytes  13 bytes (always)
        *  Chunk type          4 bytes  
        *  IHDR content        13 bytes
        *  Width:              4 bytes
        *  Height:             4 bytes
        *  Bit depth:          1 byte
        *  Color type:         1 byte
        *  Compression method: 1 byte
        *  Filter method:      1 byte
        *  Interlace method:   1 byte
        */
        const decode = {};
        const length = this.number(chunk.slice(0,4));
        assert(length).equal(13);
        assert(chunk[4]).message('Expected IHDR header').equal(CHUNK_TYPE.IHDR.code[0]);
        assert(chunk[5]).message('Expected IHDR header').equal(CHUNK_TYPE.IHDR.code[1]);
        assert(chunk[6]).message('Expected IHDR header').equal(CHUNK_TYPE.IHDR.code[2]);
        assert(chunk[7]).message('Expected IHDR header').equal(CHUNK_TYPE.IHDR.code[3]);
        decode.width = this.number(chunk.slice(8,12));
        decode.height = this.number(chunk.slice(12,16));
        decode.depth = this.number(chunk.slice(16,17));
        let colorCode = this.number(chunk.slice(17,18));
        decode.colorType = this.decodeColorType(colorCode);
        decode.compression = this.number(chunk.slice(18,19));
        decode.filter = this.number(chunk.slice(19,20));
        decode.interlace = this.number(chunk.slice(20,21));
        return decode;
    },
    /** 
    *  @param {Uint8Array} chunk Raw chunk data 
    *  @return {Array} The decoded chunk data (palette)
    *  @description Decodes the chunk into an array 
    *               containing the palette rgb values
    */ 
    decodePLTE(chunk) {
        //The spec required the PLTE header to appear zero or one times
        //First comes the length of the chunk then the chunk type & chunk data
        // The length should be divisible by 3
        // 1 to 256 Entries (each 3 bytes long)
        /* Chunk length        4 bytes 
        *  Chunk type          4 bytes  
        *  R                   1 byte
        *  G                   1 byte
        *  B                   1 byte
        */
       const decode = [];
       const length = this.number(chunk.slice(0,4));
       assert(length % 3).message('Malformed PLTE chunk, the length is not divisble by 3').equal(0);
       assert(chunk[4]).message('Expected PLTE header').equal(CHUNK_TYPE.PLTE.code[0]);
       assert(chunk[5]).message('Expected PLTE header').equal(CHUNK_TYPE.PLTE.code[1]);
       assert(chunk[6]).message('Expected PLTE header').equal(CHUNK_TYPE.PLTE.code[2]);
       assert(chunk[7]).message('Expected PLTE header').equal(CHUNK_TYPE.PLTE.code[3]);
       const steps = Math.floor(length / 3);
       let data = chunk.slice(8,chunk.length);
       for (let i = 0; i <= steps; i++) {
           let rgb = [];
           rgb.push(data[1*i]);
           rgb.push(data[2*i]);
           rgb.push(data[3*i]);
           decode.push(rgb);
       }
       return decode;
    },
        /** 
    *  @param {Uint8Array} chunk Raw chunk data 
    *  @return {Array} The decoded chunk data (palette)
    *  @description Decodes the chunk into an array 
    *               containing the palette rgb values
    */ 
   decodeIDAT(chunk) {
    //The spec required the PLTE header to appear zero or one times
    //First comes the length of the chunk then the chunk type & chunk data
    // The length should be divisible by 3
    // 1 to 256 Entries (each 3 bytes long)
    /* Chunk length        4 bytes 
    *  Chunk type          4 bytes  
    *  R                   1 byte
    *  G                   1 byte
    *  B                   1 byte
    */
   const length = this.number(chunk.slice(0,4));
   assert(chunk[4]).message('Expected IDAT header').equal(CHUNK_TYPE.IDAT.code[0]);
   assert(chunk[5]).message('Expected IDAT header').equal(CHUNK_TYPE.IDAT.code[1]);
   assert(chunk[6]).message('Expected IDAT header').equal(CHUNK_TYPE.IDAT.code[2]);
   assert(chunk[7]).message('Expected IDAT header').equal(CHUNK_TYPE.IDAT.code[3]);
   let decode;
   try {
    let payload = chunk.slice(8, length)
    let test = pako.deflate(new Uint8Array([0,1,2,3,4]));
    decode = pako.inflate(payload);
   } catch (error) {
       throw error
   }
  
   return decode;
},
    /** 
    *  @param {int} code The bytes allocated for a number
    *  @return {COLOR_TYPE} Return the unsigned int 
    *  @description returns the COLOR_TYPE struct for the uint 
    */ 
    decodeColorType(code) {
        let type = Object.keys(COLOR_TYPE).find(x => COLOR_TYPE[x].code == code);
        if(!type) throw `Unsupported Color type: ${code}`
        return COLOR_TYPE[type];
    },
        /** 
    *  @param {ArrayBuffer} buffer Raw image data 
    *  @param {CHUNK_TYPE} chunkType chunk type as an array of 4 unsigned ints
    *  @return {Array} Array of starting indices of each chunk in the data stream
    *  @description Returns either the start indice of the chunks corresponding the 
    *               to the given chunk type or an empty array
    *               if no chunk is present in the data stream 
    */ 
   getChunkIndex(buffer, chunkType) {
        let type = chunkType.code;
        let data = new Uint8Array(buffer);
        let findings = [];
        for (let i = 0; i < data.length; i++) {
        //   if(i == 37 && chunkType == CHUNK_TYPE.IDAT) {
        //     console.log(i);
        //   };
          if(data[i] == type[0] && data[i+1] == type[1] && data[i+2] == type[2] && data[i+3] == type[3]) {
              assert(i-4).message('Malformed chunk layout, found chunk type without length byte').greater(0);
              findings.push(i-4);
          } 
        }
        if(findings.length == 0) return [];
        else return findings;
    },
    /** 
    *  @param {Uint8Array} bytes The bytes allocated for a number
    *  @return {Number} Return the unsigned int 
    *  @description Shifts the bits/bytes corresponding to network order (MSB first)
    *               as defined by the png spec
    */ 
     number(bytes) {
        let result = 0;
        for (let i = 0; i < bytes.length; i++) {
            let exp = (bytes.length - (i+1)) * 8;
            result += bytes[i] << exp
        }
        return result;
    }
}

