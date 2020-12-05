export default class BitReadStream {
    /** 
    *  @param {Uint8Array} data The bits to stream
    *  @return {BitReadStream} The stream object to read
    *  @description Offers a simple stream interface for Uint8Arrays 
    */ 
    constructor(data) {
        this.data = data;
        this.pos = 0;
	    this.pending = 0;
    }

	read(bits) {
		 let recursiveRead = function (bits, buffer) {
			if (typeof buffer == "undefined") { buffer = 0; }
			if (bits == 0) { return buffer; }
			var partial;
			var consumed;
			if (this.pending > 0) {
				var byte = this.data[this.pos - 1] & (0xff >> (8 - this.pending));
				consumed = Math.min(this.pending, bits);
				this.pending -= consumed;
				partial = byte >> this.pending;
			} else {
				consumed = Math.min(8, bits);
				this.pending = 8 - consumed;
				partial = this.data[this.pos++] >> this.pending;
			}
			bits -= consumed;
			buffer = (buffer << consumed) | partial;
			return (bits > 0) ? this.read(bits, buffer) : buffer;
		}
		return recursiveRead(bits);
	}

	
}

