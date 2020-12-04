
export default function assert(val) {
    return {
        value: val,
        msg: null,
        equal: function (expect) {
            if(val !== expect) {
                if(this.msg) throw this.msg;
                else throw `Expected ${val} to be ${expect}`;
            }
        },
        greater: function (expect) {
            if(val < expect) {
                if(this.msg) throw this.msg;
                else throw `Expected ${val} greater or equal to ${expect}`;
            }
        },
        message: function (msg) { this.msg = msg; return this }
    }
}