// Web Worker for Markov.

var prefix = "MRKV_";  // Incoming command prefix.
var namespace = "";    // localStorage key namespace.

var loop = false;
onmessage = function(e) {
    var pre = new RegExp('^'+prefix);
    if (!e.data.match(pre)) return;
    var data = JSON.parse(e.data.replace(pre, ''));
    var [command, args, id] = data;
    loop = loop || new EventLoop();
    loop.add(command, args, id);
};

// These things need to return an estimate of the number of iterations,
// and the generator (or the result).
var API = {
    count: function(n) {
        /**
         * Example generator - - the deal here is that your API handlers
         * return a generator and their total.
         * If no generator, just return the value.
         */
        var gen = (function*(){ 
            for (let i=1;i<=n;++i) yield(i);
        }());
        return [gen, n];
    },
    echo: function(str) {
        /**
         * If no generator, just return the value.
         *
         * Though if it's long enough to justify putting into a Web Worker,
         * you should really yield the current progress.
         */
        return str;
    }
}

class EventLoop {

    constructor(interval=1000) {
        this._generators = new Map();
        this._counts = new Map();
        this._active = false;
        this._interval = interval;
    }

    add(id, cmd, args) {
        if (!API[cmd]) {
            console.error("Invalid command:", cmd);
            return;
        }
        var result = API[cmd].apply(null, args);
        if (result[0] && result[0].next) {
            let [gen, total] = result;
            let counter = {current:0, total:total};
            postMessage([id, 'start', [null, total]]);
            this._generators.set(id, gen);
            this._counts.set(id, counter);
            this._run_loop();
        } else postMessage([id, 'done', [result]]);
    }

    _run_loop() {
        for (let [id, gen] of this._generators.entries()) {
            let {value, done} = gen.next();
            value = value || null;
            let c = this._counts.get(id);
            postMessage([id, 'progress', [value, c.current, c.total]]);
            if (done == true) {
                postMessage([id, 'done', [value]]);
                this._generators.delete(id);
                this._counts.delete(id);
            } else c.current++;
        }
        if (this._generators.size > 0) {
            this._active = true;
            setTimeout(()=>{ this._run_loop(); }, this._interval);
        } else {
            this._active = false;
        }
    }

}   